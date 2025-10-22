import Store from 'electron-store'
import { ipcMain, BrowserWindow, app } from 'electron'
import { MicaBrowserWindow } from 'mica-electron'

const schema = {
  volume: { type: 'number', default: 0.8 },
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
    })
  })
}

export { setupConfigIPC }
