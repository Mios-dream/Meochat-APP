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

  initAssistant: () => ipcRenderer.invoke('assistant:init'),
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
  // 注册聊天框快捷键
  registerChatShortcut: (shortcut) =>
    ipcRenderer.invoke('assistant:register-chat-shortcut', shortcut),
  // 加载助手数据
  loadAssistantData: () => ipcRenderer.invoke('assistant:load-assistant-data'),
  // 添加助手
  addAssistant: (assistant) => ipcRenderer.invoke('assistant:add-assistant', assistant),
  // 更新助手信息
  updateAssistantInfo: (assistant) =>
    ipcRenderer.invoke('assistant:update-assistant-info', assistant),
  // 删除助手
  deleteAssistant: (name) => ipcRenderer.invoke('assistant:delete-assistant', name),
  // 上传助手资产进度
  onUploadProgress: (callback) =>
    ipcRenderer.on('assistant:upload-progress', (_, percent) => callback(percent)),
  // 检查助手资产是否需要更新
  isNeedsUpdate: (assistant) => ipcRenderer.invoke('assistant:need-update', assistant),
  // 获取当前助手信息
  getCurrentAssistant: () => ipcRenderer.invoke('assistant:get-current-assistant'),
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
    ipcRenderer.invoke('assistant:save-image-file', fileData, assistantName, fileName)
})
