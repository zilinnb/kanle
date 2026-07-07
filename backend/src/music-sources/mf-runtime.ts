/**
 * MusicFree 插件运行时沙箱
 *
 * 复刻 MusicFreeDesktop 官方实现：
 *   src/shared/plugin-manager/main/plugin.ts
 *
 * 核心机制：
 * - 用 Function 构造器包裹插件代码（与官方一致，不用 vm/require）
 * - 形参为 (require, __musicfree_require, module, exports, console, env, process)
 * - require 是白名单 shim，仅允许 axios/crypto-js/cheerio/dayjs/big-integer/qs/he/webdav
 * - 关键细节：pkg.default = pkg —— 让 TS 编译产物的 axios_1.default 可用
 * - env 只承载 getUserVariables/os/appVersion/lang，不需要实现 request
 *
 * 所有依赖已在 backend/package.json 中：axios, crypto-js, cheerio, dayjs,
 * big-integer, qs, he。
 */
import axios from "axios";
import CryptoJS from "crypto-js";
import cheerio from "cheerio";
import dayjs from "dayjs";
import bigInt from "big-integer";
import qs from "qs";
import he from "he";

/** axios 默认超时（与官方一致） */
axios.defaults.timeout = 15000;

/** 插件可用的依赖白名单 */
const packages: Record<string, any> = {
  axios,
  "crypto-js": CryptoJS,
  cheerio,
  dayjs,
  "big-integer": bigInt,
  qs,
  he,
  // 空实现：示例插件都没用，但官方提供了
  "@react-native-cookies/cookies": {
    get: async () => ({}),
    set: async () => {},
    clear: async () => {},
  },
};

/** 每次调用前给每个包注入 default 指向自身（让 TS 编译产物可用） */
function ensureDefault(pkg: any): any {
  if (pkg && pkg.default === undefined) {
    pkg.default = pkg;
  }
  return pkg;
}

/**
 * 创建白名单 require 函数
 * - 命中白名单：返回对应包（已注入 default）
 * - 未命中：返回 null（与官方一致，不抛错）
 */
export function makeRequire(): (name: string) => any {
  return (packageName: string) => {
    const pkg = packages[packageName];
    if (pkg) {
      return ensureDefault(pkg);
    }
    return null;
  };
}

/** 创建 env 对象（插件可读取的环境信息） */
export function makeEnv(pluginPlatform?: string): any {
  return {
    getUserVariables: () => ({}),
    os: process.platform,
    appVersion: "1.0.0",
    lang: "zh-CN",
  };
}

/** 创建 process 对象 */
export function makeProcess(env: any): any {
  return {
    platform: process.platform,
    version: "1.0.0",
    env,
    ensurePluginInitialized: Promise.resolve(),
  };
}

/**
 * 简单内存存储（musicfree/storage polyfill）
 * 按 pluginPlatform 隔离，避免插件间数据污染
 */
export function makePluginStorage(pluginPlatform: string) {
  const store = new Map<string, any>();
  return {
    set(key: string, value: any) {
      store.set(key, value);
    },
    get<T = any>(key: string): T | null {
      return (store.get(key) as T) ?? null;
    },
    remove(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

/**
 * 用 Function 构造器执行插件代码，返回 module.exports
 *
 * 与官方 MusicFreeDesktop 完全一致的实现方式：
 *   const fn = Function(`'use strict'; return function(...) { ${code} }`)();
 *   fn(_require, _require, _module, _module.exports, console, env, _process);
 *
 * @param code 插件源代码
 * @param pluginPlatform 插件 platform 字段（用于 env/storage 隔离）
 * @param fileName 文件名（仅用于错误堆栈）
 * @returns module.exports（可能是 IPluginDefine 或 { default: IPluginDefine }）
 */
export function executePluginCode(
  code: string,
  pluginPlatform: string = "unknown",
  fileName: string = "plugin.js"
): any {
  const _module: { exports: any; loaded: boolean } = {
    exports: {},
    loaded: false,
  };
  const _require = makeRequire();
  const env = makeEnv(pluginPlatform);
  const _process = makeProcess(env);

  // 用 Function 构造器包裹，与官方 MusicFreeDesktop 一致
  const wrappedCode = `
    'use strict';
    return function(require, __musicfree_require, module, exports, console, env, process) {
      ${code}
    };
  `;

  let fn: Function;
  try {
    fn = new Function(wrappedCode)();
  } catch (err: any) {
    throw new Error(
      `插件代码编译失败 (${fileName}): ${err?.message || err}`
    );
  }

  if (typeof fn !== "function") {
    throw new Error(`插件代码未返回函数 (${fileName})`);
  }

  try {
    fn(_require, _require, _module, _module.exports, console, env, _process);
  } catch (err: any) {
    throw new Error(
      `插件代码执行失败 (${fileName}): ${err?.message || err}`
    );
  }

  _module.loaded = true;
  // TS 编译产物可能写 module.exports.default
  return _module.exports.default || _module.exports;
}
