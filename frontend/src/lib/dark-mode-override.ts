// 夜间模式手动覆盖时间戳：用户手动切换主题时记录，自动调度器在 2 小时内跳过覆盖
// 持久化到 localStorage，刷新页面后仍能保持手动覆盖窗口
const STORAGE_KEY = "dark_mode_override_time";

export function markManualOverride() {
  if (typeof window === "undefined") return;
  const now = Date.now();
  try {
    localStorage.setItem(STORAGE_KEY, String(now));
  } catch {
    // ignore
  }
}

export function getManualOverrideTime(): number {
  if (typeof window === "undefined") return 0;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v ? Number(v) : 0;
  } catch {
    return 0;
  }
}
