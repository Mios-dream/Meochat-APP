import { contextBridge, ipcRenderer } from 'electron'
import globalAPI from './sharePreload'

// 文件选择工具API
const fileSelectAPI = {
  // 选择单个文件
  selectFile: (options) => ipcRenderer.invoke('tool:select-file', options),
  // 选择文件夹
  selectFolder: (options) => ipcRenderer.invoke('tool:select-folder', options),
  // 检查本地路径是否存在
  pathExists: (targetPath: string) => ipcRenderer.invoke('tool:path-exists', targetPath)
}

contextBridge.exposeInMainWorld('api', {
  ...globalAPI,
  fileSelectAPI,
  // 主窗口专用 API
  getAssistantStatus: () => ipcRenderer.invoke('assistant:get-status'),
  setAutoStartOnBoot: (enable) => ipcRenderer.invoke('set-auto-start-on-boot', enable),

  // 更新相关 API
  getCurrentVersion: () => ipcRenderer.invoke('updater:get-current-version'),
  checkForUpdate: () => ipcRenderer.invoke('updater:check-for-update'),
  confirmUpdate: () => ipcRenderer.invoke('updater:confirm-update'),
  onStatus: (callback) => ipcRenderer.on('updater:update-status', (_, msg) => callback(msg)),
  onProgress: (callback) =>
    ipcRenderer.on('updater:update-progress', (_, percent) => callback(percent)),
  checkCloudVersion: () => ipcRenderer.invoke('updater:check-cloud-version'),

  // 内核管理 API
  kernel: {
    getState: () => ipcRenderer.invoke('kernel:get-state'),
    getCurrentVersion: () => ipcRenderer.invoke('kernel:get-current-version'),
    getActivePath: () => ipcRenderer.invoke('kernel:get-active-path'),
    getPythonConfig: () => ipcRenderer.invoke('kernel:get-python-config'),
    checkUpdate: () => ipcRenderer.invoke('kernel:check-update'),
    updateToLatest: () => ipcRenderer.invoke('kernel:update-to-latest'),
    onStateUpdate: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, state: unknown): void => callback(state)
      ipcRenderer.on('kernel:state-update', handler)
      return () => ipcRenderer.removeListener('kernel:state-update', handler)
    },
    onNeedRestart: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, data: unknown): void => callback(data)
      ipcRenderer.on('kernel:need-restart', handler)
      return () => ipcRenderer.removeListener('kernel:need-restart', handler)
    },
    resetState: () => ipcRenderer.invoke('kernel:reset-state'),
    checkEnvironment: () => ipcRenderer.invoke('kernel:check-environment'),
    setupEnvironment: () => ipcRenderer.invoke('kernel:setup-environment'),
    downloadModels: () => ipcRenderer.invoke('kernel:download-models'),
    getLogs: () => ipcRenderer.invoke('kernel:get-logs'),
    startBackend: () => ipcRenderer.invoke('kernel:start-backend'),
    stopBackend: () => ipcRenderer.invoke('kernel:stop-backend'),
    restartBackend: () => ipcRenderer.invoke('kernel:restart-backend'),
    getBackendStatus: () => ipcRenderer.invoke('kernel:get-backend-status'),
    getBackendLogs: () => ipcRenderer.invoke('kernel:get-backend-logs'),
    checkBackendHealth: () => ipcRenderer.invoke('kernel:check-backend-health'),
    onServiceState: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, state: unknown): void => callback(state)
      ipcRenderer.on('kernel:service-state', handler)
      return () => ipcRenderer.removeListener('kernel:service-state', handler)
    }
  },

  // 助手相关 API
  initAssistant: () => ipcRenderer.invoke('assistant:init'),
  // 下载助手资产
  downloadAssistantAsset: async ({ assistantName, onProgress }) => {
    // 监听进度事件
    const progressListener = (
      _event,
      { assistantName: name, progress }: { assistantName: string; progress: number }
    ): void => {
      if (name === assistantName && onProgress) {
        onProgress(progress)
      }
    }

    ipcRenderer.on('assistant:download-progress', progressListener)

    try {
      // 调用主进程方法
      const result = await ipcRenderer.invoke('assistant:download-assistant-asset', {
        assistantName
      })
      return result
    } finally {
      // 清理事件监听器
      ipcRenderer.removeListener('assistant:download-progress', progressListener)
    }
  },
  // 注册聊天框快捷键
  registerChatShortcut: (shortcut) =>
    ipcRenderer.invoke('assistant:register-chat-shortcut', shortcut),
  // 加载助手数据
  loadAssistantData: () => ipcRenderer.invoke('assistant:load-assistant-data'),
  // 添加助手
  addAssistant: (assistant) => ipcRenderer.invoke('assistant:add-assistant', assistant),
  // 更新助手信息
  updateAssistant: (assistant, options) =>
    ipcRenderer.invoke('assistant:update-assistant', assistant, options),
  // 删除助手
  deleteAssistant: (name) => ipcRenderer.invoke('assistant:delete-assistant', name),
  // 上传助手资产进度
  onUploadProgress: (callback) => {
    const listener = (
      _,
      data: {
        assistantName: string
        progress: number
      }
    ): void => callback(data)
    ipcRenderer.on('assistant:upload-progress', listener)
    return () => ipcRenderer.removeListener('assistant:upload-progress', listener)
  },
  // 检查助手资产是否需要更新
  isNeedsUpdate: (assistant) => ipcRenderer.invoke('assistant:need-update', assistant),
  // 获取当前助手信息
  getCurrentAssistant: () => ipcRenderer.invoke('assistant:get-current-assistant'),
  // 从云端刷新当前助手数据（好感度等）
  refreshCurrentAssistant: () => ipcRenderer.invoke('assistant:refresh-current'),
  // 切换当前助手
  switchAssistant: (name) => ipcRenderer.invoke('assistant:switch-assistant', name),
  // 资产管理相关API
  // 获取助手资产配置文件
  getAssistantAssets: (assistantName) => ipcRenderer.invoke('assistant:get-assets', assistantName),
  // 保存助手资产配置文件
  saveAssistantAssets: (assets) => ipcRenderer.invoke('assistant:save-assets', assets),
  // 上传并提取Live2D模型资产
  saveAndExtractLive2DModel: (fileData, assistantName) =>
    ipcRenderer.invoke('assistant:save-extract-live2d', fileData, assistantName),
  // 助手图片上传API
  saveAssistantImageFile: (fileData, assistantName, fileName) =>
    ipcRenderer.invoke('assistant:save-image-file', fileData, assistantName, fileName),
  // 助手通用资源文件上传API
  saveAssistantResourceFile: (fileData, assistantName, subDir, fileName, oldRelativePath) =>
    ipcRenderer.invoke(
      'assistant:save-resource-file',
      fileData,
      assistantName,
      subDir,
      fileName,
      oldRelativePath
    ),
  // 从角色卡片导入助手信息
  importAssistantFromCard: (imagePath) =>
    ipcRenderer.invoke('assistant:import-from-card', imagePath)
})
