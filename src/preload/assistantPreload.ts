import { contextBridge, ipcRenderer } from 'electron'
import globalAPI from './sharePreload'

contextBridge.exposeInMainWorld('api', {
  ...globalAPI,

  // ===== 助手窗口专用 API =====
  startDrag: () => ipcRenderer.send('assistant:start-drag'),
  setIgnoreMouse: (ignore) => ipcRenderer.send('assistant:set-ignore-mouse', ignore),

  // 助手数据
  loadAssistantData: () => ipcRenderer.invoke('assistant:load-data'),
  getCurrentAssistant: () => ipcRenderer.invoke('assistant:get-current'),
  getAssistantAssets: (assistantName: string) =>
    ipcRenderer.invoke('assistant:get-assets', assistantName),
  scanLive2dExpressions: () => ipcRenderer.invoke('assistant:scan-live2d-expressions'),
  refreshCurrentAssistant: () => ipcRenderer.invoke('assistant:refresh-current'),

  // Tips窗口
  showTips: (message: string, avatarUrl?: string) =>
    ipcRenderer.send('tips:show-message', { message, avatarUrl }),
  updateTips: (message: string, avatarUrl?: string) =>
    ipcRenderer.send('tips:update-message', { message, avatarUrl }),
  hideTips: () => ipcRenderer.send('tips:hide-message'),
  isAssistantVisible: () => ipcRenderer.invoke('assistant:check-visible'),

  // 下载状态监听
  onDownloadProgress: (
    callback: (data: { status: string; assistantName?: string; progress?: number }) => void
  ) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { status: string; assistantName?: string; progress?: number }
    ): void => {
      callback(data)
    }
    ipcRenderer.on('assistant:download-progress', handler)
    return () => {
      ipcRenderer.removeListener('assistant:download-progress', handler)
    }
  },

  // 获取当前正在下载资源的助手列表
  getDownloadingAssets: () => ipcRenderer.invoke('assistant:get-downloading')
})
