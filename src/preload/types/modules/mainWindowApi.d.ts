export interface MainWindowApi {
  // 主窗口
  /**
   * 最小化应用
   */
  minimizeApp: () => void
  /**
   * 最大化应用
   */
  maximizeApp: () => void
  /**
   * 隐藏应用
   */
  hideApp: () => void
  /**
   * 退出应用
   */
  quitApp: () => void
  /**
   * 设置开机自启
   */
  setAutoStartOnBoot: (status: boolean) => Promise<void>

  /**
   * 发送系统通知
   * @param data 通知数据
   */
  notify: (data: {
    title: string
    body: string
    icon?: string
    silent?: boolean
    subtitle?: string
    sound?: string
  }) => void

  /**
   * 打开外部链接
   * @param url 外部链接地址
   */
  openExternal: (url: string) => void

  // 更新相关api
  /**
   * 获取当前版本信息
   */
  getCurrentVersion: () => Promise<string>
  /**
   * 检查是否有可用更新
   */
  checkForUpdate: () => Promise<{
    updateAvailable: boolean
    version?: string
    releaseNotes?: string
    error?: string
  }>
  /**
   * 确认更新
   */
  confirmUpdate: () => Promise<void>
  /**
   * 监听更新状态
   */
  onStatus: (callback: (msg: string) => void) => void
  /**
   * 监听更新进度
   */
  onProgress: (callback: (percent: number) => void) => void

  // 助手相关 API
  /**
   * 获取桌宠开关状态
   */
  getAssistantStatus: () => Promise<boolean>

  /**
   * 注册聊天框快捷键，用于打开/关闭聊天框
   * @param shortcut 快捷键字符串，例如 "Ctrl+Shift+A"
   */
  registerChatShortcut: (shortcut: string) => Promise<boolean>

  /**
   * 从服务器加载所有助手数据
   * @returns 助手信息数组
   */
  loadAssistantData: () => Promise<AssistantInfo[]>
  /**
   * 添加助手，并上传助手资产到服务器
   * @param assistant 助手信息
   * @param onProgress 进度回调函数
   */
  addAssistant: (
    assistant: AssistantInfo,
    onProgress?: (progress: number) => void
  ) => Promise<{ success: boolean; error?: string }>
  /**
   * 更新助手信息，并上传助手资产到服务器
   * @param assistant 助手信息
   */
  updateAssistantInfo: (assistant: AssistantInfo) => Promise<boolean>
  /**
   * 从服务器删除助手
   * @param name 助手名称
   */
  deleteAssistant: (name: string) => Promise<{ success: boolean; message?: string }>

  /**
   * 监听助手资产上传进度
   */
  onUploadProgress: (callback: (data: { assistantName: string; progress: number }) => void) => void

  /**
   * 检查助手资产是否需要更新
   * @param assistant 助手信息
   */
  isNeedUpdate: (assistant: AssistantInfo) => Promise<boolean>

  /**
   * 从服务器获取当前助手信息
   * @returns 助手信息或错误信息
   */
  getCurrentAssistant: () => Promise<
    { success: true; data: AssistantInfo } | { success: false; error: string }
  >
  /**
   * 请求服务器切换当前助手
   * @param name 助手名称
   * @returns 切换结果
   */
  switchAssistant: (
    name: string
  ) => Promise<{ success: boolean; data?: AssistantInfo; error?: string }>

  // 助手资产管理相关API
  /**
   * 下载助手资产
   */
  downloadAssistantAsset: (params: {
    assistantName: string
    onProgress?: (progress: number) => void
  }) => Promise<string>
  /**
   * 保存助手图片文件
   * @param fileData 图片文件数据
   * @param assistantName 助手名称
   * @param fileName 文件名
   */
  saveAssistantImageFile: (
    fileData: ArrayBuffer,
    assistantName: string,
    fileName: string
  ) => Promise<{ success: true; path: string } | { success: false; error: string }>

  /**
   * 获取助手资产
   * @param assistantName 助手名称
   */
  getAssistantAssets: (
    assistantName: string
  ) => Promise<{ success: boolean; data?: AssistantAssets; error?: string }>
  /**
   * 保存助手资产文件
   * @param assets 助手资产
   */
  saveAssistantAssets: (assets: AssistantAssets) => Promise<{ success: boolean; error?: string }>
  /**
   * 上传并提取Live2D模型到助手资产目录
   * @param fileData 模型文件数据
   * @param assistantName 助手名称
   */
  uploadAndExtractLive2dModel: (
    fileData: Buffer | ArrayBuffer,
    assistantName: string
  ) => Promise<{ success: boolean; path?: string; mainJsonPath?: string; error?: string }>

  // 日志相关API
  log: {
    debug: (message: string, details?: string) => void
    info: (message: string, details?: string) => void
    warn: (message: string, details?: string) => void
    error: (message: string, details?: string) => void
  }
}
