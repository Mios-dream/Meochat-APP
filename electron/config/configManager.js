import Store from 'electron-store'
import { ipcMain, BrowserWindow, app } from 'electron'
import { MicaBrowserWindow } from 'mica-electron'

// 配置项的默认值
const schema = {
  // 基础配置
  baseUrl: { type: 'string', default: '127.0.0.1:8001' },
  autoStartOnBoot: { type: 'boolean', default: false },
  autoUpdate: { type: 'boolean', default: true },
  debugMode: { type: 'boolean', default: false },
  silentMode: { type: 'boolean', default: false },
  // 助手配置
  volume: { type: 'number', default: 0.8 },
  autoChat: { type: 'boolean', default: false },

  idleEvent: { type: 'boolean', default: true },
  idleTime: { type: 'number', default: 2 },
}

const store = new Store({ schema })

function setupConfigIPC() {
  // 监听配置更新并广播给所有渲染进程
  store.onDidAnyChange(() => {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('config:changed', store.store)
    })

    MicaBrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('config:changed', store.store)
    })
  })
  // 提供 IPC 接口
  ipcMain.handle('config:get', (_, key) => {
    return key ? store.get(key) : store.store
  })
  ipcMain.handle('config:set', (_, key, value) => {
    store.set(key, value)
  })

  // 保留原有的开机启动逻辑
  ipcMain.handle('set-auto-start-on-boot', (_, value) => {
    app.setLoginItemSettings({
      openAtLogin: value,
      openAsHidden: false,
      args: value ? ['--auto-start'] : [],
    })
  })
}

export { setupConfigIPC }
