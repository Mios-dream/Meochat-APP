/**
 * 聊天框控制 IPC 通道定义
 *
 * 方向说明：
 *   send   — 窗口控制命令（renderer → main）
 *   invoke — 置顶状态查询（请求-响应）
 */

import { defineSend, defineInvoke } from './helpers'

export const chatBoxChannels = {
  /** 创建聊天框 */
  CHATBOX_CREATE: defineSend('chat-box:create'),
  /** 关闭聊天框 */
  CHATBOX_CLOSE: defineSend('chat-box:close'),
  /** 隐藏聊天框 */
  CHATBOX_HIDE: defineSend('chat-box:hide'),
  /** 显示聊天框 */
  CHATBOX_SHOW: defineSend('chat-box:show'),
  /** 切换聊天框置顶 */
  CHATBOX_TOGGLE_PIN: defineInvoke('chat-box:toggle-pin'),
  /** 获取聊天框置顶状态 */
  CHATBOX_GET_PIN_STATUS: defineInvoke('chat-box:get-pin-status')
} as const
