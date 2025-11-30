import { contextBridge, ipcRenderer } from 'electron'
import globalAPI from './sharePreload'

contextBridge.exposeInMainWorld('api', {
  ...globalAPI,
  // 开始拖拽
  startDrag: () => ipcRenderer.send('assistant:start-drag'),
  // 设置鼠标是否忽略，用于点击穿透
  setIgnoreMouse: (ignore) => ipcRenderer.send('assistant:set-ignore-mouse', ignore),

  // 获取当前助手信息
  getCurrentAssistant: () => ipcRenderer.invoke('assistant:get-current'),
  // 获取助手资产配置
  getAssistantAssets: (assistantName) => ipcRenderer.invoke('assistant:get-assets', assistantName)
})
