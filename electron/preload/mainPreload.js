// eslint-disable-next-line @typescript-eslint/no-require-imports
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // 主窗口专用 API
  minimizeApp: () => ipcRenderer.send('app:minimize'),
  maximizeApp: () => ipcRenderer.send('app:maximize'),
  quitApp: () => ipcRenderer.send('app:quit'),
  // 开启助手窗口
  openAssistant: () => ipcRenderer.send('assistant:create'),
  // 关闭助手窗口
  closeAssistant: () => ipcRenderer.send('assistant:close'),
  //获取助手开关状态
  getAssistantStatus: () => ipcRenderer.invoke('assistant:get-status'),
})
