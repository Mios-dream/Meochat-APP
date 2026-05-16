import { ipcMain, app } from 'electron'
import { getMainWindow } from '../windows/mainWindow'

/**
 * 设置主窗口IPC
 */
export function setupMainIPC(): void {
  ipcMain.on('app:show', () => {
    const win = getMainWindow()
    if (win) win.show()
  })

  ipcMain.on('app:hide', () => {
    const win = getMainWindow()
    if (win) win.hide()
  })

  ipcMain.on('app:minimize', () => {
    const win = getMainWindow()
    if (win) win.minimize()
  })

  ipcMain.on('app:maximize', () => {
    const win = getMainWindow()
    if (win) {
      if (win.isMaximized()) {
        win.setBounds({ width: 1200, height: 800 })
        win.unmaximize()
      } else {
        win.show()
        win.maximize()
      }
    }
  })

  ipcMain.on('app:quit', () => {
    app.quit()
  })
}
