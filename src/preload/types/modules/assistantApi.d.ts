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

  // 新增API
  getCurrentAssistant: () => Promise<AssistantInfo | null> // 这里应该使用具体的类型
  getAssistantAssets: (assistantName: string) => Promise<AssistantAssets | null> // 这里应该使用具体的类型
  onAssistantSwitched: (callback: (data: AssistantInfo | null) => void) => () => void
}
