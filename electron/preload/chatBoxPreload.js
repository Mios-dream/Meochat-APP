const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('chatBoxAPI', {
  hideChatBox: () => ipcRenderer.send('chat-box:hide'),
  showChatBox: () => ipcRenderer.send('chat-box:show'),
  // 创建聊天窗口
  openChatBox: () => ipcRenderer.send('chat-box:create'),
  // 关闭聊天窗口
  closeChatBox: () => ipcRenderer.send('chat-box:close'),

  ipcRenderer: {
    send: (channel, data) => ipcRenderer.send(channel, data),
    on: (channel, listener) => {
      ipcRenderer.on(channel, listener)
      return () => ipcRenderer.removeListener(channel, listener)
    },
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
  },
})
