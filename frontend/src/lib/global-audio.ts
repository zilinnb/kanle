/**
 * 全局音频单例：顶栏与动态音乐共用同一个 <audio> 元素。
 * 这样点击动态音乐时能在用户手势同步上下文中调用 play()（iOS Safari 必须），
 * 同时保证同一时间只有一路音频在播。
 */
let _audio: HTMLAudioElement | null = null;

export function getGlobalAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!_audio) {
    _audio = new Audio();
    _audio.preload = "auto";
    _audio.setAttribute("playsinline", "");
  }
  return _audio;
}
