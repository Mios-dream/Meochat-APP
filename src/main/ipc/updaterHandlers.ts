import { ipcMain, app, dialog, BrowserWindow } from 'electron'
import { getAutoUpdater } from '../utils/appUpdater'
import log from '../utils/logger'

const autoUpdater = getAutoUpdater()

/**
 * 设置更新器IPC
 */
function setupUpdaterIPC(): void {
  // 获取当前版本
  ipcMain.handle('updater:get-current-version', () => {
    return app.getVersion()
  })

  // 检测更新
  ipcMain.handle('updater:check-for-update', async () => {
    const win = BrowserWindow.getFocusedWindow()

    if (!win) return

    win.webContents.send('updater:update-status', '正在检查更新...')

    try {
      const result = await autoUpdater.checkForUpdates()

      if (!result) {
        win.webContents.send('updater:update-status', '更新程序不可用。')
        return { updateAvailable: false }
      }

      if (!result.updateInfo || !result.updateInfo.version) {
        win.webContents.send('updater:update-status', '当前已是最新版本。')
        return { updateAvailable: false }
      }

      const currentVersion = app.getVersion()
      const latestVersion = result.updateInfo.version

      if (latestVersion === currentVersion) {
        win.webContents.send('updater:update-status', '已是最新版本。')
        return { updateAvailable: false }
      }

      // 有新版本，显示提示
      win.webContents.send('updater:update-status', `发现新版本 v${latestVersion}，是否更新？`)
      return {
        updateAvailable: true,
        version: latestVersion,
        releaseNotes: result.updateInfo.releaseNotes
      }
    } catch (error) {
      const errorObj = error as Error
      win.webContents.send(
        'updater:update-status',
        `检查更新失败,请到项目仓库查看更新或者使用代理重试。${errorObj.message}`
      )
      log.error(error)
      return { error: errorObj.message }
    }
  })

  // 确认更新
  ipcMain.handle('updater:confirm-update', async () => {
    const win = BrowserWindow.getFocusedWindow()

    if (!win) return

    win.webContents.send('updater:update-status', '正在下载更新...')

    autoUpdater.on('download-progress', (progress) => {
      win.webContents.send('updater:update-progress', Math.round(progress.percent))
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
        win.webContents.send('updater:update-status', '更新已下载，可稍后安装。')
      }
    })

    await autoUpdater.downloadUpdate()
  })
}

export default setupUpdaterIPC
