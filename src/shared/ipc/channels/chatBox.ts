/**
 * 聊天框控制
 *  IPC 通道定义
 */

export const chatBoxChannels = {
  /** 创建聊天框 */
  CHATBOX_CREATE: 'chat-box:create',
  /** 关闭聊天框 */
  CHATBOX_CLOSE: 'chat-box:close',
  /** 隐藏聊天框 */
  CHATBOX_HIDE: 'chat-box:hide',
  /** 显示聊天框 */
  CHATBOX_SHOW: 'chat-box:show',
  /** 切换聊天框置顶 */
  CHATBOX_TOGGLE_PIN: 'chat-box:toggle-pin',
  /** 获取聊天框置顶状态 */
  CHATBOX_GET_PIN_STATUS: 'chat-box:get-pin-status'
} as const
