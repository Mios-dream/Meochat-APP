import { BrowserWindow } from 'electron'
import { MicaBrowserWindow } from 'mica-electron'
import { powerMonitor, app } from 'electron'
// 监听电脑事件
function setupEventIPC() {
  // 监听电源状态变化
  // 使用交流电时
  powerMonitor.on('on-ac', () => {})
  // 使用电池时
  powerMonitor.on('on-battery', () => {})
}

export { setupEventIPC }
