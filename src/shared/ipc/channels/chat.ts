/**
 * 聊天服务相关的 IPC 通道定义
 *
 * 方向说明：
 *   invoke — 聊天历史的请求-响应（get-history / append-message 等）
 *   send   — 命令（cancel-message / wakeword / 工具状态，renderer → main）
 *   event  — 主进程主动推送（history-changed 等）
 */

import { defineInvoke, defineSend, defineEvent } from './helpers'

export const chatChannels = {
  /** 取消消息 */
  CANCEL_MESSAGE: defineSend('chat:cancel-message'),
  /** 唤醒词检测 */
  WAKEWORD_DETECTED: defineSend('chat:wakeword-detected'),
  /** 获取聊天历史 */
  GET_HISTORY: defineInvoke('chat:get-history'),
  /** 追加一条消息到历史 */
  APPEND_MESSAGE: defineInvoke('chat:append-message'),
  /** 删除最后一条消息（发送失败回滚） */
  POP_HISTORY: defineInvoke('chat:pop-history'),
  /** 替换全部历史（远端同步后覆盖） */
  REPLACE_HISTORY: defineInvoke('chat:replace-history'),
  /** 清空聊天历史（本地 + 云端） */
  CLEAR_HISTORY: defineInvoke('chat:clear-history'),
  /** 调用聊天（invoke，ChatBox → Main → Assistant → 结果返回） */
  CHAT_INVOKE: defineInvoke('chat:invoke'),
  /** 助理窗口返回聊天调用结果 */
  CHAT_INVOKE_RESULT: defineSend('chat:invoke-result'),
  /** 聊天历史已清空事件（main → renderer 广播） */
  CHAT_HISTORY_CLEARED_EVENT: defineEvent('chat:history-cleared')
} as const
