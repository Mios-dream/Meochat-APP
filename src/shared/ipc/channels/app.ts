/**
 * 窗口控制 IPC 通道定义
 */

export const appChannels = {
  /** 显示主窗口 */
  APP_SHOW: 'app:show',
  /** 隐藏当前窗口 */
  APP_HIDE: 'app:hide',
  /** 最小化当前窗口 */
  APP_MINIMIZE: 'app:minimize',
  /** 最大化/还原主窗口 */
  APP_MAXIMIZE: 'app:maximize',
  /** 退出应用 */
  APP_QUIT: 'app:quit'
} as const
