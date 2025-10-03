const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('assistantAPI', {
  moveWindow: (x, y) => ipcRenderer.send('assistant:move', { x, y }),

  hideAssistant: () => ipcRenderer.send('assistant:hide'),
  showAssistant: () => ipcRenderer.send('assistant:show'),
  // 获取屏幕信息等
  getScreenSize: () => ipcRenderer.invoke('assistant:get-screen-size'),
  // 开启助手窗口
  openAssistant: () => ipcRenderer.send('assistant:create'),
  // 关闭助手窗口
  closeAssistant: () => ipcRenderer.send('assistant:close'),

  ipcRenderer: {
    send: (channel, data) => ipcRenderer.send(channel, data),
    on: (channel, listener) => {
      ipcRenderer.on(channel, listener)
      return () => ipcRenderer.removeListener(channel, listener)
    },
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
  },
})
