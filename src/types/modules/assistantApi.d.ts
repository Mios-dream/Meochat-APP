export interface AssistantApi {
  // 助手窗口
  openAssistant: () => void
  closeAssistant: () => void
  hideAssistant: () => void
  showAssistant: () => void
  startDrag: () => void
  setIgnoreMouse: (ignore: boolean) => void
  //获取助手开关状态
  getAssistantStatus: () => Promise<boolean>
}
