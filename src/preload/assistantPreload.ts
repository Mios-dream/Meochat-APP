import { contextBridge, ipcRenderer } from 'electron'
import globalAPI from './sharePreload'

contextBridge.exposeInMainWorld('api', {
  ...globalAPI,
  // 开始拖拽
  startDrag: () => ipcRenderer.send('assistant:start-drag'),
  // 设置鼠标是否忽略，用于点击穿透
  setIgnoreMouse: (ignore) => ipcRenderer.send('assistant:set-ignore-mouse', ignore),

  // 加载助手数据
  loadAssistantData: () => ipcRenderer.invoke('assistant:load-assistant-data'),
  // 获取当前助手信息
  getCurrentAssistant: () => ipcRenderer.invoke('assistant:get-current'),
  // 获取助手资产配置
  getAssistantAssets: (assistantName) => ipcRenderer.invoke('assistant:get-assets', assistantName),
  // 扫描 Live2D 表情文件
  scanLive2dExpressions: () => ipcRenderer.invoke('assistant:scan-live2d-expressions'),

  // Tips窗口相关API
  showTips: (message: string, avatarUrl?: string) =>
    ipcRenderer.send('tips:show-message', { message, avatarUrl }),
  updateTips: (message: string, avatarUrl?: string) =>
    ipcRenderer.send('tips:update-message', { message, avatarUrl }),
  hideTips: () => ipcRenderer.send('tips:hide-message'),
  // 检查助手窗口是否可见（用于决定是否显示Tips窗口）
  isAssistantVisible: () => ipcRenderer.invoke('assistant:check-visible'),
  // 从云端刷新当前助手数据（好感度等）
  refreshCurrentAssistant: () => ipcRenderer.invoke('assistant:refresh-current')
})
