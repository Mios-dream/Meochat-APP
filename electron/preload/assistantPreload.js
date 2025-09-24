const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('assistantAPI', {
  // assistant专用 API
  moveWindow: (x, y) => ipcRenderer.send('assistant:move', { x, y }),
  openAssistant: () => ipcRenderer.send('assistant:create'),
  closeAssistant: () => ipcRenderer.send('assistant:close'),
  hideAssistant: () => ipcRenderer.send('assistant:hide'),
  showAssistant: () => ipcRenderer.send('assistant:show'),
  startDrag: (offsetX, offsetY) => ipcRenderer.send('assistant:start-drag', { offsetX, offsetY }),
  dragWindow: (screenX, screenY) => ipcRenderer.send('assistant:drag-window', { screenX, screenY }),
  stopDrag: () => ipcRenderer.send('assistant:stop-drag'),

  // 获取屏幕信息等
  getScreenSize: () => ipcRenderer.invoke('assistant:get-screen-size'),
})
