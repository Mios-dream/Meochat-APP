/**
 * 聊天服务相关的 IPC 通道定义
 */

export const chatChannels = {
  /** 取消消息 */
  CANCEL_MESSAGE: 'chat:cancel-message',
  /** 唤醒词检测 */
  WAKEWORD_DETECTED: 'chat:wakeword-detected',
  /** 工具状态广播 */
  UPDATE_TOOL_STATUS: 'chat:update-tool-status',
  /** 获取聊天历史 */
  GET_HISTORY: 'chat:get-history',
  /** 追加一条消息到历史 */
  APPEND_MESSAGE: 'chat:append-message',
  /** 删除最后一条消息（发送失败回滚） */
  POP_HISTORY: 'chat:pop-history',
  /** 替换全部历史（远端同步后覆盖） */
  REPLACE_HISTORY: 'chat:replace-history',
  /** 清空聊天历史（本地 + 云端） */
  CLEAR_HISTORY: 'chat:clear-history',
  /** 调用聊天（invoke，ChatBox → Main → Assistant → 结果返回） */
  CHAT_INVOKE: 'chat:invoke',
  /** 助理窗口返回聊天调用结果 */
  CHAT_INVOKE_RESULT: 'chat:invoke-result'
} as const
