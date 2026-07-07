/**
 * MusicFree 插件加载器
 *
 * 把一段 MusicFree 插件 .js 源代码加载为 LoadedMusicFreePlugin。
 *
 * 加载流程：
 *   1. 用 sha256 计算代码 hash（用于去重）
 *   2. 用 mf-runtime.executePluginCode 在沙箱中执行代码
 *   3. 取出 module.exports，校验必填字段（platform）
 *   4. 返回 LoadedMusicFreePlugin 实例
 *
 * 不做持久化（持久化由 mf-manager 处理）。
 */
import crypto from "crypto";
import { executePluginCode } from "./mf-runtime";
import type { IPluginDefine, LoadedMusicFreePlugin } from "./mf-types";

/** 计算 sha256 hash（用于插件去重） */
export function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

/** 简单版本比较：a > b 返回 1，相等 0，小于 -1；格式 "0.3.0" */
export function compareVersion(a: string, b: string): number {
  const pa = String(a || "0").split(".").map((n) => parseInt(n, 10) || 0);
  const pb = String(b || "0").split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const va = pa[i] || 0;
    const vb = pb[i] || 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

/**
 * 加载一段插件代码
 *
 * @param code 插件源代码
 * @param fileName 文件名（仅用于错误信息）
 * @returns 已加载插件实例
 * @throws 若代码编译失败、执行失败、或缺少 platform 字段
 */
export function loadPluginFromCode(
  code: string,
  fileName: string = "plugin.js"
): LoadedMusicFreePlugin {
  if (!code || code.trim().length < 50) {
    throw new Error(`插件代码过短，可能不是有效插件 (${fileName})`);
  }

  const hash = hashCode(code);
  const instance = executePluginCode(code, "unknown", fileName);

  if (!instance || typeof instance !== "object") {
    throw new Error(
      `插件未导出对象 (${fileName})，module.exports 为 ${typeof instance}`
    );
  }

  const pluginDefine = instance as IPluginDefine;

  if (!pluginDefine.platform || typeof pluginDefine.platform !== "string") {
    throw new Error(
      `插件缺少 platform 字段或类型错误 (${fileName})`
    );
  }

  return {
    platform: pluginDefine.platform,
    instance: pluginDefine,
    rawCode: code,
    hash,
    fileName,
    srcUrl: pluginDefine.srcUrl,
    installedAt: Date.now(),
  };
}

/**
 * 加载并校验插件，返回简洁信息（不含原始代码，用于日志/响应）
 */
export function loadPluginInfo(code: string, fileName: string = "plugin.js"): {
  platform: string;
  version: string;
  author: string;
  description?: string;
  srcUrl?: string;
  primaryKey?: string[];
  supportedSearchType?: string[];
  hash: string;
  methods: string[];
} {
  const loaded = loadPluginFromCode(code, fileName);
  const inst = loaded.instance;

  // 列出插件实际实现的方法
  const allMethods: Array<keyof IPluginDefine> = [
    "search",
    "getMediaSource",
    "getMusicInfo",
    "getLyric",
    "getAlbumInfo",
    "getMusicSheetInfo",
    "getArtistWorks",
    "importMusicSheet",
    "importMusicItem",
    "getTopLists",
    "getTopListDetail",
    "getRecommendSheetTags",
    "getRecommendSheetsByTag",
    "getMusicComments",
  ];
  const methods = allMethods.filter((m) => typeof inst[m] === "function");

  return {
    platform: loaded.platform,
    version: inst.version || "0.0.0",
    author: inst.author || "",
    description: inst.description,
    srcUrl: inst.srcUrl,
    primaryKey: inst.primaryKey,
    supportedSearchType: inst.supportedSearchType,
    hash: loaded.hash,
    methods: methods as string[],
  };
}
