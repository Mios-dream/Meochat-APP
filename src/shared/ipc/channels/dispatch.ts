/**
 * 统一调度中心 IPC 通道定义
 *
 * 方向说明：
 *   send  — renderer → main 的单向调度（send-to）
 *   invoke — renderer → main 的请求-响应调度（invoke）
 *   event — main → renderer 的事件推送（action / invoke 转发）
 */

import { defineSend, defineInvoke, defineEvent } from './helpers'

export const dispatchChannels = {
  /** 向目标窗口发送消息 */
  DISPATCH_SEND_TO: defineSend('dispatch:send-to'),
  /** 调度调用（renderer → main 请求，main 处理后返回回执） */
  DISPATCH_INVOKE: defineInvoke('dispatch:invoke'),
  /** 调度推送（main → renderer 转发 invoke 请求） */
  DISPATCH_INVOKE_EVENT: defineEvent('dispatch:invoke-event'),
  /** 调度动作 */
  DISPATCH_ACTION_EVENT: defineEvent('dispatch:action')
} as const
