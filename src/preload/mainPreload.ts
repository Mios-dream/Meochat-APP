import { contextBridge, ipcRenderer } from 'electron'
import globalAPI from './sharePreload'
import type { AssistantInfo, AssistantAssets } from '@shared/types/assistantTypes'

// 文件选择工具API
const fileSelectAPI = {
  selectFile: (options?: Electron.OpenDialogOptions) =>
    ipcRenderer.invoke('tool:select-file', options),
  selectFolder: (options?: Electron.OpenDialogOptions) =>
    ipcRenderer.invoke('tool:select-folder', options),
  pathExists: (targetPath: string) => ipcRenderer.invoke('tool:path-exists', targetPath)
}

contextBridge.exposeInMainWorld('api', {
  ...globalAPI,
  fileSelectAPI,

  // 主窗口专用 API
  getAssistantStatus: () => ipcRenderer.invoke('assistant:get-status'),
  setAutoStartOnBoot: (enable: boolean) => ipcRenderer.invoke('set-auto-start-on-boot', enable),

  // 更新相关 API
  getCurrentVersion: () => ipcRenderer.invoke('updater:get-current-version'),
  checkForUpdate: () => ipcRenderer.invoke('updater:check-for-update'),
  confirmUpdate: () => ipcRenderer.invoke('updater:confirm-update'),
  onStatus: (callback: (msg: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, msg: string): void => callback(msg)
    ipcRenderer.on('updater:update-status', handler)
    return () => ipcRenderer.removeListener('updater:update-status', handler)
  },
  onProgress: (callback: (percent: number) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, percent: number): void => callback(percent)
    ipcRenderer.on('updater:update-progress', handler)
    return () => ipcRenderer.removeListener('updater:update-progress', handler)
  },
  checkCloudVersion: () => ipcRenderer.invoke('updater:check-cloud-version'),

  onboarding: {
    getState: () => ipcRenderer.invoke('onboarding:get-state'),
    setMode: (mode) => ipcRenderer.invoke('onboarding:set-mode', mode),
    saveProfile: (profile) => ipcRenderer.invoke('onboarding:save-profile', profile),
    markCompleted: () => ipcRenderer.invoke('onboarding:mark-completed'),
    reset: () => ipcRenderer.invoke('onboarding:reset')
  },

  // 内核管理 API
  kernel: {
    getState: () => ipcRenderer.invoke('kernel:get-state'),
    getCurrentVersion: () => ipcRenderer.invoke('kernel:get-current-version'),
    getActivePath: () => ipcRenderer.invoke('kernel:get-active-path'),
    getPythonConfig: () => ipcRenderer.invoke('kernel:get-python-config'),
    checkUpdate: () => ipcRenderer.invoke('kernel:check-update'),
    updateToLatest: () => ipcRenderer.invoke('kernel:update-to-latest'),
    onStateUpdate: (callback: (state: unknown) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, state: unknown): void => callback(state)
      ipcRenderer.on('kernel:state-update', handler)
      return () => ipcRenderer.removeListener('kernel:state-update', handler)
    },
    resetState: () => ipcRenderer.invoke('kernel:reset-state'),
    checkEnvironment: () => ipcRenderer.invoke('kernel:check-environment'),
    setupEnvironment: () => ipcRenderer.invoke('kernel:setup-environment'),
    downloadModels: () => ipcRenderer.invoke('kernel:download-models'),
    startBackend: () => ipcRenderer.invoke('kernel:start-backend'),
    stopBackend: () => ipcRenderer.invoke('kernel:stop-backend'),
    restartBackend: () => ipcRenderer.invoke('kernel:restart-backend'),
    getBackendStatus: () => ipcRenderer.invoke('kernel:get-backend-status'),
    getBackendLogs: () => ipcRenderer.invoke('kernel:get-backend-logs'),
    getOperationLogs: () => ipcRenderer.invoke('kernel:get-operation-logs'),
    checkBackendHealth: () => ipcRenderer.invoke('kernel:check-backend-health'),
    onServiceState: (callback: (state: unknown) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, state: unknown): void => callback(state)
      ipcRenderer.on('kernel:service-state', handler)
      return () => ipcRenderer.removeListener('kernel:service-state', handler)
    },
    onServiceStream: (callback: (base64: string) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, base64: string): void => {
        callback(base64)
      }
      ipcRenderer.on('kernel:service-stream', handler)
      return () => ipcRenderer.removeListener('kernel:service-stream', handler)
    },
    openLogDir: () => ipcRenderer.invoke('kernel:open-log-dir'),
    checkApiHealth: () => ipcRenderer.invoke('kernel:check-api-health')
  },

  // 助手相关 API

  /** 加载助手数据（初始化） */
  loadAssistantData: () => ipcRenderer.invoke('assistant:load-data'),

  /** 获取所有助手列表（从主进程内存直接读取） */
  getAllAssistants: () => ipcRenderer.invoke('assistant:get-all'),

  /** 注册聊天框快捷键 */
  registerChatShortcut: (shortcut: string) =>
    ipcRenderer.invoke('assistant:register-chat-shortcut', shortcut),

  /** 添加助手 */
  addAssistant: (assistant: AssistantInfo, options?: { assetTypes?: string[] }) =>
    ipcRenderer.invoke('assistant:add-assistant', assistant, options),

  /** 更新助手信息 */
  updateAssistant: (
    assistant: AssistantInfo,
    options?: { uploadAssets?: boolean; assetTypes?: string[] }
  ) => ipcRenderer.invoke('assistant:update-assistant', assistant, options),

  /** 删除助手 */
  deleteAssistant: (name: string) => ipcRenderer.invoke('assistant:delete-assistant', name),

  /** 保存助手图片文件（头像、立绘等） */
  saveAssistantImageFile: (fileData: ArrayBuffer, assistantName: string, fileName: string) =>
    ipcRenderer.invoke('assistant:save-resource-file', {
      fileData,
      assistantName,
      subDir: 'images',
      fileName
    }),

  /** 保存助手资源文件（通用方法，支持图片、音频等） */
  saveAssistantResourceFile: (payload: {
    fileData: Buffer | ArrayBuffer
    assistantName: string
    subDir: 'images' | 'audio' | 'live2d' | 'models' | 'other'
    fileName: string
    oldRelativePath?: string
  }) => ipcRenderer.invoke('assistant:save-resource-file', payload),

  /** 获取助手资产配置 */
  getAssistantAssets: (assistantName: string) =>
    ipcRenderer.invoke('assistant:get-assets', assistantName),

  /** 保存助手资产配置 */
  saveAssistantAssets: (assets: AssistantAssets) =>
    ipcRenderer.invoke('assistant:save-assets', assets),

  /** 上传并解压Live2D模型 */
  saveAndExtractLive2DModel: (fileData: Buffer | ArrayBuffer, assistantName: string) =>
    ipcRenderer.invoke('assistant:save-extract-live2d', fileData, assistantName),

  /** 下载助手资产（支持按类型选择性下载） */
  downloadAssistantAsset: async ({
    assistantName,
    assetTypes,
    onProgress
  }: {
    assistantName: string
    assetTypes?: string[]
    onProgress?: (progress: number) => void
  }) => {
    const progressListener = (
      _event: Electron.IpcRendererEvent,
      { assistantName: name, progress }: { assistantName: string; progress: number }
    ): void => {
      if (name === assistantName && onProgress) {
        onProgress(progress)
      }
    }

    ipcRenderer.on('assistant:download-progress', progressListener)
    try {
      return await ipcRenderer.invoke('assistant:download-asset', { assistantName, assetTypes })
    } finally {
      ipcRenderer.removeListener('assistant:download-progress', progressListener)
    }
  },

  /** 获取当前正在下载资源的助手列表 */
  getDownloadingAssets: () => ipcRenderer.invoke('assistant:get-downloading'),

  /** 获取当前助手信息 */
  getCurrentAssistant: () => ipcRenderer.invoke('assistant:get-current'),

  /** 切换当前助手 */
  switchAssistant: (name: string) => ipcRenderer.invoke('assistant:switch', name),

  /** 从云端刷新当前助手数据（好感度等） */
  refreshCurrentAssistant: () => ipcRenderer.invoke('assistant:refresh-current'),

  /** 从角色卡片导入助手信息 */
  importAssistantFromCard: (imageData: ArrayBuffer) =>
    ipcRenderer.invoke('assistant:import-from-card', imageData),

  /** 从 zip 角色压缩包导入助手 */
  importAssistantFromZip: (zipPath: string) =>
    ipcRenderer.invoke('assistant:import-from-zip', zipPath),

  /** 扫描 Live2D 表情文件 */
  scanLive2dExpressions: () => ipcRenderer.invoke('assistant:scan-live2d-expressions'),

  /** 监听上传进度 */
  onUploadProgress: (callback: (data: { assistantName: string; progress: number }) => void) => {
    const listener = (
      _: Electron.IpcRendererEvent,
      data: { assistantName: string; progress: number }
    ): void => callback(data)
    ipcRenderer.on('assistant:upload-progress', listener)
    return () => ipcRenderer.removeListener('assistant:upload-progress', listener)
  },

  /** 监听助手列表数据更新事件（后台云端同步完成后触发） */
  onAssistantDataUpdated: (
    callback: (data: {
      assistants: AssistantInfo[]
      currentAssistant: AssistantInfo | null
    }) => void
  ) => {
    const listener = (
      _: Electron.IpcRendererEvent,
      data: { assistants: AssistantInfo[]; currentAssistant: AssistantInfo | null }
    ): void => callback(data)
    ipcRenderer.on('assistant:data-updated', listener)
    return () => ipcRenderer.removeListener('assistant:data-updated', listener)
  },

  // ════════════════════════════════════════════════════════════════════════
  // 小组件动作 API · LLM 工具调用时遥控小组件
  // ════════════════════════════════════════════════════════════════════════

  /**
   * 小组件动作控制 API。
   *
   * 主窗口渲染进程通过此 API 向指定类型的小组件窗口发送动作指令，
   * 并等待首个成功响应的执行结果。
   */
  widgetAction: {
    /**
     * 执行小组件动作。
     *
     * 根据 widget_type 查找所有已启用且已打开窗口的小组件实例，
     * 广播动作指令并等待首个响应（或超时）。
     *
     * @param widgetType - 目标小组件类型 ID（weather / todo / note / clock / daily-quote）
     * @param action - 动作名称（set_location / add_item / clear_all 等）
     * @param params - 动作参数对象
     * @param timeoutMs - 超时时间（毫秒），默认 8000ms
     * @returns IpcResponse<WidgetActionResult>
     */
    exec: (
      widgetType: string,
      action: string,
      params: Record<string, unknown>,
      timeoutMs?: number
    ): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }> =>
      ipcRenderer.invoke('widget:action:exec', {
        widget_type: widgetType,
        action,
        params,
        timeout_ms: timeoutMs
      })
  }
})
