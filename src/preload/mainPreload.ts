import { contextBridge, ipcRenderer } from 'electron'
import globalAPI from './sharePreload'

contextBridge.exposeInMainWorld('api', {
  ...globalAPI,
  // 主窗口专用 API
  getAssistantStatus: () => ipcRenderer.invoke('assistant:get-status'),
  setAutoStartOnBoot: (enable) => ipcRenderer.invoke('set-auto-start-on-boot', enable),

  // 更新相关 API
  getCurrentVersion: () => ipcRenderer.invoke('get-current-version'),
  checkForUpdate: () => ipcRenderer.invoke('check-for-update'),
  confirmUpdate: () => ipcRenderer.invoke('confirm-update'),
  onStatus: (callback) => ipcRenderer.on('update-status', (_, msg) => callback(msg)),
  onProgress: (callback) => ipcRenderer.on('update-progress', (_, percent) => callback(percent))
})
