/**
 * 聊天框控制 IPC 通道定义
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
  CHATBOX_GET_PIN_STATUS: 'chat-box:get-pin-status',
  /** 发送消息 */
  CHATBOX_SEND_MESSAGE: 'chat-box:send-message',
  /** 取消消息 */
  CHATBOX_CANCEL_MESSAGE: 'chat-box:cancel-message',
  /** 更新状态 */
  CHATBOX_UPDATE_STATUS: 'chat-box:update-status',
  /** 唤醒词检测 */
  CHATBOX_WAKEWORD_DETECTED: 'chat-box:wakeword-detected',
  /** 工具状态广播 */
  CHATBOX_UPDATE_TOOL_STATUS: 'chat-box:update-tool-status',
  /** 获取聊天历史 */
  CHATBOX_GET_HISTORY: 'chat-box:get-history',
  /** 追加一条消息到历史 */
  CHATBOX_APPEND_MESSAGE: 'chat-box:append-message',
  /** 删除最后一条消息（发送失败回滚） */
  CHATBOX_POP_HISTORY: 'chat-box:pop-history',
  /** 替换全部历史（远端同步后覆盖） */
  CHATBOX_REPLACE_HISTORY: 'chat-box:replace-history',
  /** 清空聊天历史 */
  CHATBOX_CLEAR_HISTORY: 'chat-box:clear-history',
  /** 开始拖拽聊天框 */
  CHATBOX_START_DRAG: 'chat-box:start-drag'
} as const
