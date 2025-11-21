export interface MainWindowApi {
  // 主窗口
  minimizeApp: () => void
  maximizeApp: () => void
  hideApp: () => void
  quitApp: () => void
  setAutoStartOnBoot: (status: boolean) => Promise<void>
  getAssistantStatus: () => Promise<boolean> // 根据实际返回值类型调整
  notify: (data: {
    title: string
    body: string
    icon?: string
    silent?: boolean
    subtitle?: string
    sound?: string
  }) => void

  // 打开外部链接
  openExternal: (url: string) => void

  saveAssistantImageFile: (
    fileData: ArrayBuffer,
    assistantName: string,
    fileName: string
  ) => Promise<string>

  // 获取当前版本信息
  getCurrentVersion: () => Promise<string>
  // 获取更新信息
  checkForUpdate: () => Promise<{
    updateAvailable: boolean
    version?: string
    releaseNotes?: string
    error?: string
  }>
  confirmUpdate: () => Promise<void>
  onStatus: (callback: (msg: string) => void) => void
  onProgress: (callback: (percent: number) => void) => void

  // 助手相关 API
  downloadAssistantAsset: (params: {
    assistantName: string
    onProgress?: (progress: number) => void
  }) => Promise<string>

  // 加载助手数据
  loadAssistantData: () => Promise<AssistantInfo[]>
  addAssistant: (
    assistant: AssistantInfo,
    onProgress?: (progress: number) => void
  ) => Promise<boolean>
  updateAssistantInfo: (assistant: AssistantInfo) => Promise<boolean>
  deleteAssistant: (name: string) => Promise<boolean>

  onUploadProgress: (callback: (data: { assistantName: string; progress: number }) => void) => void

  isNeedUpdate: (assistant: AssistantInfo) => Promise<boolean>
}
