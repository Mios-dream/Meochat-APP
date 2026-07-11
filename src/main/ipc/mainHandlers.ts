import { app } from 'electron'
import { CHANNELS } from '@shared/ipc/channels'
import { registerOn } from '../utils/registerIpcHandler'
import { windowRegistry } from '../windows'

/**
 * 设置主窗口IPC
 */
export function setupMainIPC(): void {
  registerOn(CHANNELS.APP_SHOW, () => {
    const win = windowRegistry.getWindowByType('main')
    if (win) win.show()
  })

  registerOn(CHANNELS.APP_HIDE, () => {
    const win = windowRegistry.getWindowByType('main')
    if (win) win.hide()
  })

  registerOn(CHANNELS.APP_MINIMIZE, () => {
    const win = windowRegistry.getWindowByType('main')
    if (win) win.minimize()
  })

  registerOn(CHANNELS.APP_MAXIMIZE, () => {
    const win = windowRegistry.getWindowByType('main')
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

  registerOn(CHANNELS.APP_QUIT, () => {
    app.quit()
  })
}
