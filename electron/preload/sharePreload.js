import { ipcRenderer } from 'electron'

const globalAPI = {
  // 主窗口专用 API
  minimizeApp: () => ipcRenderer.send('app:minimize'),
  maximizeApp: () => ipcRenderer.send('app:maximize'),
  hideApp: () => ipcRenderer.send('app:hide'),
  quitApp: () => ipcRenderer.send('app:quit'),

  // 助手页面的preload
  // 开启助手窗口
  openAssistant: () => ipcRenderer.send('assistant:create'),
  // 关闭助手窗口
  closeAssistant: () => ipcRenderer.send('assistant:close'),
  hideAssistant: () => ipcRenderer.send('assistant:hide'),
  showAssistant: () => ipcRenderer.send('assistant:show'),
  // 获取屏幕信息等
  getScreenSize: () => ipcRenderer.invoke('assistant:get-screen-size'),

  // 聊天窗口的preload
  hideChatBox: () => ipcRenderer.send('chat-box:hide'),
  showChatBox: () => ipcRenderer.send('chat-box:show'),
  // 创建聊天窗口
  openChatBox: () => ipcRenderer.send('chat-box:create'),
  // 关闭聊天窗口
  closeChatBox: () => ipcRenderer.send('chat-box:close'),

  config: {
    get: (key) => ipcRenderer.invoke('config:get', key),
    set: (key, value) => ipcRenderer.invoke('config:set', key, value),
    onChange: (callback) => ipcRenderer.on('config:changed', (_, config) => callback(config)),
  },

  ipcRenderer: {
    send: (channel, data) => ipcRenderer.send(channel, data),
    invoke: (channel, data) => ipcRenderer.invoke(channel, data),
    on: (channel, listener) => {
      ipcRenderer.on(channel, listener)
      return () => ipcRenderer.removeListener(channel, listener)
    },
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
  },
}

export default globalAPI
