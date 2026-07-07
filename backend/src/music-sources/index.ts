/**
 * 音源注册表：platform → MusicSource 实例
 *
 * 全部音源由 MusicFree 插件提供（无内置源）。
 * 启动时由 mf-manager.loadAllPlugins() 加载 backend/plugins/*.js 并注册。
 */
import type { MusicSource } from "./types";

/** 运行时注册表：platform → MusicSource */
const SOURCES: Record<string, MusicSource> = {};

/** 旧平台别名映射（旧数据库中可能存的 platform=netease/qq/kugou/kuwo）
 *  这些是历史数据，新数据全部使用 MusicFree 插件的 platform 字段（如"小芸音乐"） */
const LEGACY_ALIAS: Record<string, string> = {
  // 旧的 lx-music 短代码 → 不再映射到任何源（用户需重新选择 MusicFree 插件 platform）
  // 这里保留映射规则占位，未来若需要可扩展
};

/** 按代码或旧别名查找音源 */
export function getSource(code: string): MusicSource | null {
  if (!code) return null;
  const c = code.toLowerCase();
  // 直接匹配（大小写不敏感）
  for (const [key, src] of Object.entries(SOURCES)) {
    if (key.toLowerCase() === c) return src;
  }
  // 旧别名
  const alias = LEGACY_ALIAS[c];
  if (alias && SOURCES[alias]) return SOURCES[alias];
  return null;
}

/** 列出所有可用音源（前端 /api/music/sources 用） */
export function listSources(): MusicSource[] {
  return Object.values(SOURCES);
}

/** 把旧 platform 名标准化（保留兼容，目前为透传） */
export function normalizePlatform(code: string): string {
  const c = String(code || "").toLowerCase();
  return LEGACY_ALIAS[c] || code;
}

/** 判断某 code 是否已注册（保留兼容接口） */
export function isBuiltinSource(_code: string): boolean {
  return false; // 无内置源
}

/** 动态注册插件源（由 mf-manager 调用） */
export function registerSource(code: string, source: MusicSource): void {
  SOURCES[code] = source;
}

/** 注销插件源（由 mf-manager 调用） */
export function unregisterSource(code: string): void {
  delete SOURCES[code];
}
