/**
 * Tips 窗口 IPC 通道定义
 */

export const tipsChannels = {
  /** 显示提示 */
  TIPS_SHOW: 'tips:show-message',
  /** 更新提示 */
  TIPS_UPDATE: 'tips:update-message',
  /** 隐藏提示 */
  TIPS_HIDE: 'tips:hide-message',
  /** 提示窗口就绪 */
  TIPS_READY: 'tips:ready',
  /** 显示提示事件 */
  TIPS_SHOW_EVENT: 'tips:show',
  /** 隐藏提示事件 */
  TIPS_HIDE_EVENT: 'tips:hide',
  /** 更新提示事件 */
  TIPS_MESSAGE_EVENT: 'tips:message'
} as const
