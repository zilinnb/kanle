/**
 * MusicFree 插件管理器
 *
 * - 启动时扫描 backend/plugins/ 目录，加载所有 .js 文件
 * - 支持 .js 单文件安装（上传/在线 URL）
 * - 支持 .json 订阅（一次安装多个插件）
 * - 安装时校验 platform / version，相同 platform 旧版本拒绝安装
 * - 文件名用 platform 派生（加上短 hash 后缀避免重名）
 * - 通过 registerSource() 把适配后的 MusicSource 注入到全局注册表
 * - 监听目录变化（fs.watch）实现热重载
 *
 * 文件命名：backend/plugins/{platform}_{shorthash}.js
 * 原因：相同 platform 的不同版本插件需要共存（直到旧版被删）
 */
import fs from "fs";
import path from "path";
import axios from "axios";
import { loadPluginFromCode, hashCode, compareVersion } from "./mf-loader";
import { adaptPlugin } from "./mf-adapter";
import { registerSource, unregisterSource } from "./index";
import type { LoadedMusicFreePlugin } from "./mf-types";
import type { IPluginSubscription } from "./mf-types";

/** 插件目录：backend/plugins/（编译后 __dirname=dist/music-sources，需上溯两级到 backend/） */
const PLUGINS_DIR = path.join(__dirname, "..", "..", "plugins");

/** 已加载插件的内存记录：key = fileName */
const loadedPlugins = new Map<string, LoadedMusicFreePlugin>();

/** platform → fileName 反向索引（用于版本比较/重复检测） */
const platformIndex = new Map<string, string>();

/** 确保插件目录存在 */
export function ensurePluginsDir(): void {
  if (!fs.existsSync(PLUGINS_DIR)) {
    fs.mkdirSync(PLUGINS_DIR, { recursive: true });
  }
}

/** 列出所有已加载插件（前端 admin API 用） */
export function listPlugins(): Array<{
  id: string;
  platform: string;
  version: string;
  author: string;
  description?: string;
  srcUrl?: string;
  primaryKey?: string[];
  supportedSearchType?: string[];
  methods: string[];
  fileName: string;
}> {
  return Array.from(loadedPlugins.values()).map((p) => ({
    id: p.fileName,
    platform: p.platform,
    version: p.instance.version || "0.0.0",
    author: p.instance.author || "",
    description: p.instance.description,
    srcUrl: p.srcUrl,
    primaryKey: p.instance.primaryKey,
    supportedSearchType: p.instance.supportedSearchType,
    methods: Object.keys(p.instance).filter(
      (k) =>
        k !== "platform" &&
        k !== "version" &&
        k !== "author" &&
        k !== "description" &&
        k !== "srcUrl" &&
        k !== "primaryKey" &&
        k !== "supportedSearchType" &&
        k !== "cacheControl" &&
        k !== "hints" &&
        k !== "appVersion" &&
        k !== "defaultSearchType" &&
        k !== "userVariables" &&
        typeof (p.instance as any)[k] === "function"
    ),
    fileName: p.fileName,
  }));
}

/** 文件名净化：只保留字母数字下划线连字符 */
function sanitizeFileName(name: string): string {
  return (
    name
      .replace(/[^\w\-]/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 50) || "plugin"
  );
}

/**
 * 生成唯一文件名：{platform}_{shorthash}.js
 * 同 platform 不同 hash 的插件可以共存
 */
function generateFileName(platform: string, hash: string): string {
  const shortHash = hash.slice(0, 8);
  return `${sanitizeFileName(platform)}_${shortHash}.js`;
}

/** 注册一个已加载插件到内存 + 注册表 */
function registerLoadedPlugin(plugin: LoadedMusicFreePlugin): void {
  loadedPlugins.set(plugin.fileName, plugin);
  platformIndex.set(plugin.platform, plugin.fileName);
  // 适配并注册到全局音源表
  registerSource(plugin.platform, adaptPlugin(plugin));
}

/** 从内存 + 注册表移除一个插件 */
function unregisterLoadedPlugin(fileName: string): void {
  const plugin = loadedPlugins.get(fileName);
  if (!plugin) return;
  // 仅当当前 platform 仍指向此 fileName 时才注销（避免误删新版本）
  if (platformIndex.get(plugin.platform) === fileName) {
    unregisterSource(plugin.platform);
    platformIndex.delete(plugin.platform);
  }
  loadedPlugins.delete(fileName);
}

/** 加载单个插件文件并注册 */
function loadPluginFile(filePath: string): LoadedMusicFreePlugin {
  const fileName = path.basename(filePath);
  const code = fs.readFileSync(filePath, "utf8");
  const loaded = loadPluginFromCode(code, fileName);

  // 若同 platform 已有更新版本，跳过（不抛错，仅日志）
  const existingFileName = platformIndex.get(loaded.platform);
  if (existingFileName && existingFileName !== fileName) {
    const existing = loadedPlugins.get(existingFileName);
    if (existing) {
      const cmp = compareVersion(
        loaded.instance.version || "0.0.0",
        existing.instance.version || "0.0.0"
      );
      if (cmp < 0) {
        // 新加载的版本更旧，跳过注册
        console.log(
          `[plugins] skip ${fileName}: ${loaded.platform} v${loaded.instance.version} ` +
            `< existing v${existing.instance.version}`
        );
        return loaded;
      }
      // 新版本更升级，先注销旧版本
      unregisterLoadedPlugin(existingFileName);
    }
  }

  registerLoadedPlugin(loaded);
  return loaded;
}

/**
 * 安装插件（从代码字符串）
 * - 若同 platform 已有相同 hash，跳过
 * - 若同 platform 已有更旧版本，先删除旧文件再安装新的
 * @returns 已加载插件记录
 */
export async function installPluginFromCode(
  code: string,
  suggestedName?: string
): Promise<LoadedMusicFreePlugin> {
  ensurePluginsDir();

  // 先加载校验
  const tempName = suggestedName
    ? `${sanitizeFileName(suggestedName)}.js`
    : "plugin.js";
  const loaded = loadPluginFromCode(code, tempName);

  // 检查同 platform + hash 是否已存在
  const existingFileName = platformIndex.get(loaded.platform);
  if (existingFileName) {
    const existing = loadedPlugins.get(existingFileName);
    if (existing && existing.hash === loaded.hash) {
      // 完全相同，跳过
      console.log(
        `[plugins] skip install: ${loaded.platform} already exists with same hash`
      );
      return existing;
    }
    if (existing) {
      const cmp = compareVersion(
        loaded.instance.version || "0.0.0",
        existing.instance.version || "0.0.0"
      );
      if (cmp < 0) {
        throw new Error(
          `插件 ${loaded.platform} v${loaded.instance.version} 低于已安装的 v${existing.instance.version}，拒绝安装`
        );
      }
      // 删除旧文件（新版本将覆盖）
      const oldPath = path.join(PLUGINS_DIR, existingFileName);
      unregisterLoadedPlugin(existingFileName);
      try {
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      } catch (err: any) {
        console.error(`[plugins] failed to delete old file:`, err?.message);
      }
    }
  }

  // 生成文件名并写入
  const fileName = generateFileName(loaded.platform, loaded.hash);
  const fullPath = path.join(PLUGINS_DIR, fileName);

  // 若文件名已存在（极少见，同 platform 同 hash），先清理
  if (fs.existsSync(fullPath)) {
    console.log(`[plugins] overwrite existing file: ${fileName}`);
  }

  fs.writeFileSync(fullPath, code, "utf8");

  // 重新加载（用最终 fileName）
  const finalLoaded = loadPluginFromCode(code, fileName);
  registerLoadedPlugin(finalLoaded);

  console.log(
    `[plugins] installed ${fileName}: ${finalLoaded.platform} v${finalLoaded.instance.version}` +
      (finalLoaded.instance.author ? ` by ${finalLoaded.instance.author}` : "")
  );
  return finalLoaded;
}

/**
 * 从上传的文件安装插件（multipart 上传场景）
 * 用 copy+unlink 而非 renameSync，避免跨文件系统 EXDEV 错误
 */
export async function installPluginFromFile(file: {
  originalname: string;
  path: string;
}): Promise<LoadedMusicFreePlugin> {
  ensurePluginsDir();
  const code = fs.readFileSync(file.path, "utf8");
  const suggestedName = path.basename(file.originalname, ".js");
  const loaded = await installPluginFromCode(code, suggestedName);
  // 清理 multer 临时文件
  try {
    fs.unlinkSync(file.path);
  } catch {
    // ignore
  }
  return loaded;
}

/**
 * 从在线 URL 下载并安装单个 .js 插件
 */
export async function installPluginFromUrl(url: string): Promise<LoadedMusicFreePlugin> {
  const resp = await axios.get(url, {
    timeout: 30000,
    responseType: "text",
    maxRedirects: 5,
    validateStatus: () => true,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/javascript, application/javascript, */*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    },
  });
  if (resp.status < 200 || resp.status >= 300) {
    throw new Error(`下载失败: HTTP ${resp.status}`);
  }
  const code = typeof resp.data === "string" ? resp.data : String(resp.data);
  if (!code || code.length < 50) {
    throw new Error("下载的脚本内容过短，可能不是有效的插件");
  }
  return installPluginFromCode(code);
}

/**
 * 订阅插件 JSON（一次安装多个插件）
 *
 * JSON 格式：{ plugins: [{ name, url, version? }] }
 * 单个插件失败不阻断其他插件
 */
export async function subscribePlugins(
  subscriptionUrl: string
): Promise<{
  total: number;
  installed: number;
  skipped: number;
  failed: Array<{ name: string; error: string }>;
}> {
  const resp = await axios.get(subscriptionUrl, {
    timeout: 30000,
    responseType: "json",
    maxRedirects: 5,
    validateStatus: () => true,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "application/json, text/plain, */*",
    },
  });
  if (resp.status < 200 || resp.status >= 300) {
    throw new Error(`订阅失败: HTTP ${resp.status}`);
  }
  const sub = resp.data as IPluginSubscription;
  if (!sub || !Array.isArray(sub.plugins) || sub.plugins.length === 0) {
    throw new Error("订阅 JSON 格式错误：缺少 plugins 数组");
  }

  let installed = 0;
  let skipped = 0;
  const failed: Array<{ name: string; error: string }> = [];

  for (const item of sub.plugins) {
    if (!item.url) {
      failed.push({ name: item.name || "未知", error: "缺少 url 字段" });
      continue;
    }
    try {
      await installPluginFromUrl(item.url);
      installed++;
    } catch (err: any) {
      const msg = err?.message || String(err);
      // 已存在视为跳过（非失败）
      if (/already exists|低于已安装|拒绝安装/.test(msg)) {
        skipped++;
      } else {
        failed.push({ name: item.name || item.url, error: msg });
      }
    }
  }

  return {
    total: sub.plugins.length,
    installed,
    skipped,
    failed,
  };
}

/** 删除插件 */
export function removePlugin(id: string): boolean {
  // id = fileName
  const plugin = loadedPlugins.get(id);
  if (!plugin) return false;

  unregisterLoadedPlugin(id);
  const fullPath = path.join(PLUGINS_DIR, id);
  try {
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  } catch (err: any) {
    console.error(`[plugins] failed to delete file ${id}:`, err?.message);
  }
  console.log(`[plugins] removed ${id}`);
  return true;
}

/** 启动时加载所有插件 */
export async function loadAllPlugins(): Promise<{
  loaded: number;
  failed: Array<{ file: string; error: string }>;
}> {
  ensurePluginsDir();
  const files = fs
    .readdirSync(PLUGINS_DIR)
    .filter((f) => f.toLowerCase().endsWith(".js"));

  let loaded = 0;
  const failed: Array<{ file: string; error: string }> = [];

  for (const file of files) {
    if (loadedPlugins.has(file)) continue; // 已加载
    const fullPath = path.join(PLUGINS_DIR, file);
    try {
      loadPluginFile(fullPath);
      loaded++;
      const p = loadedPlugins.get(file);
      console.log(
        `[plugins] loaded ${file}: ${p?.platform} v${p?.instance.version}`
      );
    } catch (err: any) {
      failed.push({ file, error: err?.message || String(err) });
      console.error(`[plugins] failed to load ${file}:`, err?.message || err);
    }
  }

  return { loaded, failed };
}

/** 重新加载插件（文件变更时调用） */
async function reloadPlugin(fileName: string): Promise<void> {
  const fullPath = path.join(PLUGINS_DIR, fileName);
  if (!fs.existsSync(fullPath)) {
    // 文件被删除，注销
    unregisterLoadedPlugin(fileName);
    console.log(`[plugins] auto-unloaded (file deleted): ${fileName}`);
    return;
  }
  try {
    unregisterLoadedPlugin(fileName);
    loadPluginFile(fullPath);
    const p = loadedPlugins.get(fileName);
    console.log(
      `[plugins] auto-reloaded ${fileName}: ${p?.platform} v${p?.instance.version}`
    );
  } catch (err: any) {
    console.error(
      `[plugins] auto-reload failed for ${fileName}:`,
      err?.message || err
    );
  }
}

/** 监听插件目录变化（热重载） */
let watcher: fs.FSWatcher | null = null;
export function watchPluginsDir(): void {
  ensurePluginsDir();
  if (watcher) return;
  try {
    watcher = fs.watch(PLUGINS_DIR, (eventType, filename) => {
      if (!filename || !filename.toLowerCase().endsWith(".js")) return;
      // 防抖：延迟 300ms 避免写入过程中多次触发
      setTimeout(() => {
        reloadPlugin(filename).catch(() => {});
      }, 300);
    });
  } catch (err: any) {
    console.error("[plugins] fs.watch failed:", err?.message || err);
  }
}
