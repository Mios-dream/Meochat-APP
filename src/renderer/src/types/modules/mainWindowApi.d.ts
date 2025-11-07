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

  checkForUpdate: () => Promise<{
    updateAvailable: boolean
    version?: string
    releaseNotes?: string
    error?: string
  }>

  confirmUpdate: () => Promise<void>
  onStatus: (callback: (msg: string) => void) => void
  onProgress: (callback: (percent: number) => void) => void
}
