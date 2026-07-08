import { AssistantInfo, AssistantBaseInfo } from '@shared/types/assistantTypes'
import type { UpdateCheckResult } from '@shared/types/assistantUpdate'
import { PythonServiceStatus, PythonTask } from '@shared/types/pythonService'
import { OnboardingMode, OnboardingProfile, OnboardingState } from '@shared/types/onboarding'

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

  fileSelectAPI: {
    /**
     * 选择单个文件
     * @param options 选择选项
     */
    selectFile: (options?: {
      title?: string
      defaultPath?: string
      buttonLabel?: string
      filters?: Array<{ name: string; extensions: string[] }>
    }) => Promise<
      { success: true; filePath: string; filePaths: string[] } | { success: false; error: string }
    >

    /**
     * 选择文件夹
     * @param options 选择选项
     * @returns 选择的文件夹路径
     */
    selectFolder: (options?: {
      title?: string
      defaultPath?: string
      buttonLabel?: string
    }) => Promise<
      | { success: true; folderPath: string; folderPaths: string[] }
      | { success: false; error: string }
    >

    /**
     * 检查本地路径是否存在
     * @param targetPath 目标路径
     */
    pathExists: (
      targetPath: string
    ) => Promise<
      { success: true; exists: boolean; isFile: boolean } | { success: false; error: string }
    >
  }

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
  onStatus: (callback: (msg: string) => void) => () => void
  /**
   * 监听更新进度
   */
  onProgress: (callback: (percent: number) => void) => () => void

  checkCloudVersion: () => Promise<
    | {
        success: true
        currentVersion: string
        cloudVersion: string
        isVersionMatch: boolean
        fullVersionMatch: boolean
      }
    | {
        success: false
        error: string
        currentVersion: string
      }
  >

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
   * @returns 助手信息、来源和当前助手
   */
  loadAssistantData: () => Promise<{
    success: boolean
    error?: string
    data: AssistantInfo[]
    currentAssistant: AssistantInfo | null
  }>
  /**
   * 添加助手，并上传助手资产到服务器
   * @param assistant 助手信息
   * @param options 可选配置，assetTypes 指定需要上传的资源类型（子目录名），为空则全量上传
   */
  addAssistant: (
    assistant: AssistantInfo,
    options?: { assetTypes?: string[] }
  ) => Promise<{ success: boolean; error?: string }>
  /**
   * 更新助手信息，并上传助手资产到服务器
   * @param assistant 助手信息
   * @param options 可选配置，uploadAssets 是否上传资产，assetTypes 指定需要上传的资源类型（子目录名），为空则全量上传
   */
  updateAssistant: (
    assistant: AssistantInfo,
    options?: { uploadAssets?: boolean; assetTypes?: string[] }
  ) => Promise<{ success: boolean; error?: string }>
  /**
   * 从服务器删除助手
   * @param name 助手名称
   */
  deleteAssistant: (name: string) => Promise<{ success: boolean; error?: string }>

  /**
   * 监听助手资产上传进度
   */
  onUploadProgress: (
    callback: (data: { assistantName: string; progress: number }) => void
  ) => () => void

  /**
   * 检查助手资产是否需要更新
   * @param assistant 助手信息
   * @returns 精细化的更新检查结果，包含各类资源的更新状态
   */
  isNeedUpdate: (assistant: AssistantInfo) => Promise<UpdateCheckResult>

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
  ) => Promise<{ success: true; data: AssistantInfo } | { success: false; error: string }>

  /**
   * 从云端刷新当前助手数据（好感度等）
   */
  refreshCurrentAssistant: () => Promise<
    { success: true; data: AssistantInfo } | { success: false; error: string }
  >

  // 助手资产管理相关API
  /**
   * 下载助手资产
   * @param assistantName 助手名称
   * @param assetTypes 需要下载的资源类型列表（子目录名），为空则下载全部
   * @param onProgress 下载进度回调
   */
  downloadAssistantAsset: (params: {
    assistantName: string
    assetTypes?: string[]
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
   * 保存助手通用资源文件
   * @param fileData 文件数据
   * @param assistantName 助手名称
   * @param subDir 目标子目录（assets 下）
   * @param fileName 文件名（含后缀）
   * @param oldRelativePath 旧资源相对路径，用于替换后删除旧文件
   */
  saveAssistantResourceFile: (payload: {
    fileData: ArrayBuffer
    assistantName: string
    subDir: 'images' | 'audio' | 'live2d' | 'models' | 'other'
    fileName: string
    oldRelativePath?: string
  }) => Promise<{ success: true; path: string } | { success: false; error: string }>

  /**
   * 获取助手资产
   * @param assistantName 助手名称
   */
  getAssistantAssets: (
    assistantName: string
  ) => Promise<{ success: true; data: AssistantAssets } | { success: false; error: string }>
  /**
   * 保存助手资产文件
   * @param assets 助手资产
   */
  saveAssistantAssets: (assets: AssistantAssets) => Promise<{ success: boolean; error?: string }>
  /**
   * 扫描 Live2D 目录下的所有 .exp3.json 表情文件，并读取每个文件的参数 ID。
   * @param assistantName 助手名称
   */
  scanLive2dExpressions: () => Promise<
    Map<
      string,
      {
        parameters: {
          Id: string
          Value: number
          Blend: string
        }[]
      }
    >
  >
  /**
   * 上传并提取Live2D模型到助手资产目录
   * @param fileData 模型文件数据
   * @param assistantName 助手名称
   */
  saveAndExtractLive2DModel: (
    fileData: Buffer | ArrayBuffer,
    assistantName: string
  ) => Promise<
    { success: true; path: string; mainJsonPath: string } | { success: false; error: string }
  >

  /**
   * 监听助手切换事件
   */
  onAssistantSwitched: (callback: (assistant: AssistantInfo) => void) => () => Electron.IpcRenderer

  /**
   * 从角色卡片图片中提取助手信息
   * @param imagePath 角色卡片图片路径
   * @returns 提取到的助手信息
   */
  importAssistantFromCard: (
    fileData: ArrayBuffer
  ) => Promise<{ success: true; data: AssistantBaseInfo } | { success: false; error: string }>

  /**
   * 从 zip 角色压缩包导入助手目录与资源
   * @param zipPath 角色压缩包路径，压缩包内必须包含 info.yaml
   */
  importAssistantFromZip: (
    zipPath: string
  ) => Promise<{ success: true; data: AssistantInfo } | { success: false; error: string }>

  // 日志相关API
  log: {
    debug: (message: string, details?: string) => void
    info: (message: string, details?: string) => void
    warn: (message: string, details?: string) => void
    error: (message: string, details?: string) => void
  }

  /**
   * 获取所有Python服务
   */
  getAllPythonServices: () => Promise<PythonTask[]>

  /**
   * 获取Python服务状态
   * @param serviceId Python服务ID
   */
  getPythonServiceStatus: (serviceId: number) => Promise<PythonServiceStatus>
  /**
   * 启动Python服务
   * @param serviceId Python服务ID
   */
  startPythonService: (serviceId: number) => Promise<{ success: boolean; error?: string }>
  /**
   * 重启Python服务
   * @param serviceId Python服务ID
   */
  restartPythonService: (serviceId: number) => Promise<{ success: boolean; error?: string }>
  /**
   * 停止Python服务
   * @param serviceId Python服务ID
   */
  stopPythonService: (serviceId: number) => Promise<{ success: boolean; error?: string }>
  /**
   * 创建Python服务
   * @param task 任务对象
   */
  createPythonService: (
    task: Omit<PythonTask, 'id'>
  ) => Promise<{ success: boolean; error?: string }>

  /**
   * 更新Python服务
   * @param serviceId Python服务ID
   * @param serviceData 更新的服务数据
   */
  updatePythonService: (
    serviceId: number,
    serviceData: Partial<PythonTask>
  ) => Promise<{ success: boolean; error?: string }>

  /**
   * 删除Python服务
   * @param serviceId Python服务ID
   */
  removePythonService: (serviceId: number) => Promise<{ success: boolean; error?: string }>

  /**
   * 更新Python服务开机启动设置
   * @param serviceId Python服务ID
   * @param autoStart 是否开机启动
   */
  updatePythonServiceAutoStart: (
    serviceId: number,
    autoStart: boolean
  ) => Promise<{ success: boolean; error?: string }>

  // 系统资源相关API
  /**
   * 获取系统资源状态
   */
  getSystemResources: () => Promise<
    { success: true; data: SystemResources } | { success: false; error: string }
  >

  onboarding: {
    getState: () => Promise<OnboardingState>
    setMode: (mode: OnboardingMode) => Promise<OnboardingState>
    saveProfile: (profile: OnboardingProfile) => Promise<OnboardingState>
    markCompleted: () => Promise<OnboardingState>
    reset: () => Promise<OnboardingState>
  }

  /** 小组件动作控制 API。主窗口通过此接口向小组件窗口发送遥控指令。 */
  widgetAction: {
    exec: (
      widgetType: string,
      action: string,
      params: Record<string, unknown>,
      timeoutMs?: number
    ) => Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }>
  }
}
