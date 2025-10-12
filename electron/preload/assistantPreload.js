const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('assistantAPI', {
  hideAssistant: () => ipcRenderer.send('assistant:hide'),
  showAssistant: () => ipcRenderer.send('assistant:show'),
  // 获取屏幕信息等
  getScreenSize: () => ipcRenderer.invoke('assistant:get-screen-size'),
  // 开启助手窗口
  openAssistant: () => ipcRenderer.send('assistant:create'),
  // 关闭助手窗口
  closeAssistant: () => ipcRenderer.send('assistant:close'),

  startDrag: () => ipcRenderer.send('assistant:start-drag'),

  setIgnoreMouse: (ignore) => ipcRenderer.send('assistant:set-ignore-mouse', ignore),

  ipcRenderer: {
    invoke: (channel, data) => ipcRenderer.invoke(channel, data),
    send: (channel, data) => ipcRenderer.send(channel, data),
    on: (channel, listener) => {
      ipcRenderer.on(channel, listener)
      return () => ipcRenderer.removeListener(channel, listener)
    },
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
  },
})

contextBridge.exposeInMainWorld('chatBoxAPI', {
  hideChatBox: () => ipcRenderer.send('chat-box:hide'),
  showChatBox: () => ipcRenderer.send('chat-box:show'),
  // 创建聊天窗口
  openChatBox: () => ipcRenderer.send('chat-box:create'),
  // 关闭聊天窗口
  closeChatBox: () => ipcRenderer.send('chat-box:close'),

  ipcRenderer: {
    send: (channel, data) => ipcRenderer.send(channel, data),
    invoke: (channel, data) => ipcRenderer.invoke(channel, data),
    on: (channel, listener) => {
      ipcRenderer.on(channel, listener)
      return () => ipcRenderer.removeListener(channel, listener)
    },
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
  },
})
