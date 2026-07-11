/**
 * 统一调度中心 IPC 通道定义
 */

export const dispatchChannels = {
  /** 向目标窗口发送消息 */
  DISPATCH_SEND_TO: 'dispatch:send-to',
  /** 调度调用（renderer → main） */
  DISPATCH_INVOKE: 'dispatch:invoke',
  /** 调度推送（main → renderer） */
  DISPATCH_INVOKE_EVENT: 'dispatch:invoke',
  /** 调度动作 */
  DISPATCH_ACTION_EVENT: 'dispatch:action',
  /** 调度响应 */
  DISPATCH_RESPOND: 'dispatch:respond'
} as const
