import { app, dialog, BrowserWindow } from 'electron'
import { CHANNELS } from '@shared/ipc/channels'
import { registerHandle } from '../utils/registerIpcHandler'
import { getAutoUpdater } from '../utils/appUpdater'
import log from '../utils/logger'
import { request } from '@shared/api/request'

const autoUpdater = getAutoUpdater()

/**
 * 设置更新器IPC
 */
function setupUpdaterIPC(): void {
  // 获取当前版本
  registerHandle(CHANNELS.UPDATER_GET_CURRENT_VERSION, () => {
    return app.getVersion()
  })

  // 检测更新
  registerHandle(CHANNELS.UPDATER_CHECK_FOR_UPDATE, async () => {
    const win = BrowserWindow.getFocusedWindow()

    if (!win) return

    win.webContents.send(CHANNELS.UPDATER_UPDATE_STATUS_EVENT, '正在检查更新...')

    try {
      const result = await autoUpdater.checkForUpdates()

      if (!result) {
        win.webContents.send(CHANNELS.UPDATER_UPDATE_STATUS_EVENT, '更新程序不可用。')
        return { updateAvailable: false }
      }

      if (!result.updateInfo || !result.updateInfo.version) {
        win.webContents.send(CHANNELS.UPDATER_UPDATE_STATUS_EVENT, '当前已是最新版本。')
        return { updateAvailable: false }
      }

      const currentVersion = app.getVersion()
      const latestVersion = result.updateInfo.version

      if (latestVersion === currentVersion) {
        win.webContents.send(CHANNELS.UPDATER_UPDATE_STATUS_EVENT, '已是最新版本。')
        return { updateAvailable: false }
      }

      // 有新版本，显示提示
      win.webContents.send(CHANNELS.UPDATER_UPDATE_STATUS_EVENT, `发现新版本 v${latestVersion}，是否更新？`)
      return {
        updateAvailable: true,
        version: latestVersion,
        releaseNotes: result.updateInfo.releaseNotes
      }
    } catch (error) {
      const errorObj = error as Error
      win.webContents.send(
        CHANNELS.UPDATER_UPDATE_STATUS_EVENT,
        `检查更新失败,请到项目仓库查看更新或者使用代理重试。${errorObj.message}`
      )
      log.error(error)
      return { error: errorObj.message }
    }
  })

  // 确认更新
  registerHandle(CHANNELS.UPDATER_CONFIRM_UPDATE, async () => {
    const win = BrowserWindow.getFocusedWindow()

    if (!win) return

    win.webContents.send(CHANNELS.UPDATER_UPDATE_STATUS_EVENT, '正在下载更新...')

    autoUpdater.on('download-progress', (progress) => {
      win.webContents.send(CHANNELS.UPDATER_UPDATE_PROGRESS_EVENT, Math.round(progress.percent))
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
        win.webContents.send(CHANNELS.UPDATER_UPDATE_STATUS_EVENT, '更新已下载，可稍后安装。')
      }
    })

    await autoUpdater.downloadUpdate()
  })

  // 检查云端版本与客户端版本匹配
  registerHandle(CHANNELS.UPDATER_CHECK_CLOUD_VERSION, async () => {
    const currentVersion = app.getVersion()
    try {
      // 调用云端健康检查API
      const response = await request.get('/api/health')
      const cloudVersion = response.data.version

      // 比较前两个版本号（主版本和次版本），忽略最后的小版本
      const currentVersionParts = currentVersion.split('.')
      const cloudVersionParts = cloudVersion.split('.')
      // 提取前两个版本号并拼接
      const currentMajorMinorVersion = `${currentVersionParts[0]}.${currentVersionParts[1] || '0'}`
      const cloudMajorMinorVersion = `${cloudVersionParts[0]}.${cloudVersionParts[1] || '0'}`
      // 检查主版本和次版本是否匹配
      const isVersionMatch = currentMajorMinorVersion === cloudMajorMinorVersion

      return {
        success: true,
        currentVersion,
        cloudVersion,
        isVersionMatch,
        fullVersionMatch: currentVersion === cloudVersion
      }
    } catch (error) {
      const errorObj = error as Error
      log.error('检查云端版本失败:', errorObj.message)
      return {
        success: false,
        error: errorObj.message,
        currentVersion
      }
    }
  })
}

export default setupUpdaterIPC
