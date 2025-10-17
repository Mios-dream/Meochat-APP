import { contextBridge, ipcRenderer } from 'electron'
import globalAPI from './sharePreload.js'

contextBridge.exposeInMainWorld('api', {
  ...globalAPI,
  // 主窗口专用 API
  getAssistantStatus: () => ipcRenderer.invoke('assistant:get-status'),
})
