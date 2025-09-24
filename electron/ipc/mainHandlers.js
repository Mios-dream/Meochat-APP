// electron/ipc/mainHandlers.js
import { ipcMain, app } from 'electron'
import { getMainWindow } from '../windows/mainWindow.js'

function setupMainIPC() {
  ipcMain.on('app:minimize', () => {
    const win = getMainWindow()
    if (win) win.minimize()
  })

  ipcMain.on('app:maximize', () => {
    const win = getMainWindow()
    if (win) {
      if (win.isMaximized()) {
        win.unmaximize()
      } else {
        win.maximize()
      }
    }
  })

  ipcMain.on('app:quit', () => {
    app.quit()
  })
}

export { setupMainIPC }
