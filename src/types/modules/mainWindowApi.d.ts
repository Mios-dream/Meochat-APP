export interface MainWindowApi {
  // 主窗口
  minimizeApp: () => void
  maximizeApp: () => void
  hideApp: () => void
  quitApp: () => void
  setAutoStartOnBoot: (status: boolean) => Promise<void>
  getAssistantStatus: () => Promise<boolean> // 根据实际返回值类型调整

  // 打开外部链接
  openExternal: (url: string) => void
}
