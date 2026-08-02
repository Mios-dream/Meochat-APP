/**
 * 窗口控制 IPC 通道定义
 *
 * 方向说明：均为 send（renderer send → main on）
 */

import { defineSend } from './helpers'

export const appChannels = {
  /** 隐藏当前窗口 */
  APP_HIDE: defineSend('app:hide'),
  /** 最小化当前窗口 */
  APP_MINIMIZE: defineSend('app:minimize'),
  /** 最大化/还原主窗口 */
  APP_MAXIMIZE: defineSend('app:maximize'),
  /** 退出应用 */
  APP_QUIT: defineSend('app:quit')
} as const
