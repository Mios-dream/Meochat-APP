// eslint-disable-next-line @typescript-eslint/no-require-imports
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // 主窗口专用 API
  openAssistant: () => ipcRenderer.send('assistant:create'),
  closeAssistant: () => ipcRenderer.send('assistant:close'),
  minimizeApp: () => ipcRenderer.send('app:minimize'),
  maximizeApp: () => ipcRenderer.send('app:maximize'),
  quitApp: () => ipcRenderer.send('app:quit'),

  // 通用 API
  onMessage: (channel, callback) => {
    ipcRenderer.on(channel, (event, ...args) => callback(...args))
  },
})
