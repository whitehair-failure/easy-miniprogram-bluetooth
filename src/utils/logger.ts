/**
 * 统一日志工具
 * 默认静默，通过 setDebugEnabled(true) 开启调试日志输出，
 * 避免库在宿主小程序中污染控制台。
 */

let debugEnabled = true;

/**
 * 设置是否开启调试日志（默认关闭）
 * @param enabled 是否开启
 */
export function setDebugEnabled(enabled: boolean): void {
  debugEnabled = enabled;
}

/**
 * 查询调试日志是否开启
 */
export function isDebugEnabled(): boolean {
  return debugEnabled;
}

/**
 * 调试日志（仅开启时输出 console.log）
 */
export function debugLog(...args: unknown[]): void {
  if (debugEnabled) {
    console.log(...args);
  }
}

/**
 * 调试错误日志（仅开启时输出 console.error）
 */
export function debugError(...args: unknown[]): void {
  if (debugEnabled) {
    console.error(...args);
  }
}

/**
 * 调试警告日志（仅开启时输出 console.warn）
 */
export function debugWarn(...args: unknown[]): void {
  if (debugEnabled) {
    console.warn(...args);
  }
}
