import { ipcMain, app, shell, Notification, dialog, BrowserWindow } from 'electron'
import { getMainWindow } from '../windows/mainWindow'
import { getAutoUpdater } from '../utils/appUpdater'

const autoUpdater = getAutoUpdater()

function setupMainIPC(): void {
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

  ipcMain.on('open-external', (_event, url) => {
    shell.openExternal(url)
  })

  ipcMain.on('app:notify', (_event, data) => {
    if (Notification.isSupported()) {
      new Notification({
        title: data.title,
        body: data.body,
        subtitle: data.subtitle || 'MoeChat',
        icon: data.icon || null,
        silent: data.silent || false, // 是否静音
        sound: data.sound || null // 自定义音效
      }).show()
    } else {
      console.log('Notification not supported')
    }
  })

  ipcMain.handle('get-current-version', () => {
    return app.getVersion()
  })

  // 检测更新
  ipcMain.handle('check-for-update', async () => {
    const win = BrowserWindow.getFocusedWindow()

    if (!win) return

    win.webContents.send('update-status', '正在检查更新...')

    try {
      const result = await autoUpdater.checkForUpdates()

      if (!result) {
        win.webContents.send('update-status', '更新程序不可用。')
        return { updateAvailable: false }
      }

      if (!result.updateInfo || !result.updateInfo.version) {
        win.webContents.send('update-status', '当前已是最新版本。')
        return { updateAvailable: false }
      }

      const currentVersion = app.getVersion()
      const latestVersion = result.updateInfo.version

      if (latestVersion === currentVersion) {
        win.webContents.send('update-status', '已是最新版本。')
        return { updateAvailable: false }
      }

      // 有新版本，显示提示
      win.webContents.send('update-status', `发现新版本 v${latestVersion}，是否更新？`)
      return {
        updateAvailable: true,
        version: latestVersion,
        releaseNotes: result.updateInfo.releaseNotes
      }
    } catch (error) {
      const errorObj = error as Error
      win.webContents.send(
        'update-status',
        `检查更新失败,请到项目仓库查看更新或者使用代理重试。${errorObj.message}`
      )
      console.error(error)
      return { error: errorObj.message }
    }
  })

  // 确认更新
  ipcMain.handle('confirm-update', async () => {
    const win = BrowserWindow.getFocusedWindow()

    if (!win) return

    win.webContents.send('update-status', '正在下载更新...')

    autoUpdater.on('download-progress', (progress) => {
      win.webContents.send('update-progress', Math.round(progress.percent))
    })

    autoUpdater.on('update-downloaded', () => {
      const choice = dialog.showMessageBoxSync(win, {
        type: 'question',
        buttons: ['立即安装', '稍后'],
        title: '更新完成',
        message: '新版本已下载完成，是否立即安装？'
      })

      if (choice === 0) {
        autoUpdater.quitAndInstall()
      } else {
        win.webContents.send('update-status', '更新已下载，可稍后安装。')
      }
    })

    await autoUpdater.downloadUpdate()
  })
}

export { setupMainIPC }
