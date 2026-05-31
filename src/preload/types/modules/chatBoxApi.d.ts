export interface ChatBoxApi {
  // 聊天窗口
  openChatBox: () => void
  closeChatBox: () => void
  hideChatBox: () => void
  showChatBox: () => void

  // 聊天框专用 API（chatBoxPreload）
  startDrag?: () => void
  sendMessage?: (message: string) => Promise<unknown>
  getChatHistory?: () => Promise<unknown>
  clearChatHistory?: () => Promise<unknown>
}
