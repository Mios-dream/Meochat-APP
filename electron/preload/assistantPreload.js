import globalAPI from './sharePreload.js'

import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  ...globalAPI,
  // 开始拖拽
  startDrag: () => ipcRenderer.send('assistant:start-drag'),
  // 设置鼠标是否忽略，用于点击穿透
  setIgnoreMouse: (ignore) => ipcRenderer.send('assistant:set-ignore-mouse', ignore),
})
