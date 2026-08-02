/**
 * Tips 窗口 IPC 通道定义
 *
 * 方向说明：
 *   send  — renderer → main 的命令（show / update / hide / ready）
 *   event — main → renderer 的事件推送（show / hide / message）
 */

import { defineSend, defineEvent } from './helpers'

export const tipsChannels = {
  /** 显示提示 */
  TIPS_SHOW: defineSend('tips:show-message'),
  /** 更新提示 */
  TIPS_UPDATE: defineSend('tips:update-message'),
  /** 隐藏提示 */
  TIPS_HIDE: defineSend('tips:hide-message'),
  /** 显示提示事件 */
  TIPS_SHOW_EVENT: defineEvent('tips:show'),
  /** 隐藏提示事件 */
  TIPS_HIDE_EVENT: defineEvent('tips:hide'),
  /** 更新提示事件 */
  TIPS_MESSAGE_EVENT: defineEvent('tips:message')
} as const
