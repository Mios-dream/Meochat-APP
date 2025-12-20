import { BrowserWindow } from 'electron'
import { powerMonitor } from 'electron'
// 监听电脑事件
function setupEventIPC(): void {
  // 监听电源状态变化
  // 使用交流电时
  powerMonitor.on('on-ac', () => {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('assistantEvent:on-ac')
    })
  })
  // 使用电池时
  powerMonitor.on('on-battery', () => {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('assistantEvent:on-battery')
    })
  })
}

export { setupEventIPC }
