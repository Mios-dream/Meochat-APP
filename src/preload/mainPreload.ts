import { contextBridge, ipcRenderer } from 'electron'
import globalAPI from './sharePreload'

contextBridge.exposeInMainWorld('api', {
  ...globalAPI,
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

  // 助手相关 API
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

  // 加载助手数据
  loadAssistantData: () => ipcRenderer.invoke('assistant:load-assistant-data'),
  addAssistant: (assistant) => ipcRenderer.invoke('assistant:add-assistant', assistant),
  updateAssistantInfo: (assistant) =>
    ipcRenderer.invoke('assistant:update-assistant-info', assistant),
  deleteAssistant: (name) => ipcRenderer.invoke('assistant:delete-assistant', name),
  // 文件上传API
  saveAssistantImageFile: (fileData, assistantName, fileName) =>
    ipcRenderer.invoke('assistant:save-image-file', fileData, assistantName, fileName),
  onUploadProgress: (callback) =>
    ipcRenderer.on('assistant:upload-progress', (_, percent) => callback(percent)),

  isNeedsUpdate: (assistant) => ipcRenderer.invoke('assistant:need-update', assistant),

  // 新增：获取当前助手信息
  getCurrentAssistant: () => ipcRenderer.invoke('assistant:get-current-assistant'),
  // 新增：切换当前助手
  switchAssistant: (name) => ipcRenderer.invoke('assistant:switch-assistant', name)
})
