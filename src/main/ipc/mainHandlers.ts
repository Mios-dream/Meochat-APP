import { ipcMain, app, shell, Notification, dialog, BrowserWindow } from 'electron'
import { getMainWindow } from '../windows/mainWindow'
import { getAutoUpdater } from '../utils/appUpdater'
import path from 'path'
import fs from 'fs'
import {
  downloadAssistantAssets,
  ensureAssistantDirExists,
  loadAssistantsData,
  addAssistant,
  updateAssistantInfo,
  deleteAssistant,
  isNeedsUpdate,
  getCurrentAssistant,
  switchAssistant
} from '../services/assistantService'
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

/**
 * 设置助手服务IPC
 */
function setupAssistantServerIPC(): void {
  ipcMain.handle('assistant:add-assistant', async (event, assistantData) => {
    return await addAssistant(assistantData, (progress) => {
      event.sender.send('assistant:upload-progress', {
        assistantName: assistantData.name,
        progress
      })
    })
  })

  /**
   * 更新助手信息
   */
  ipcMain.handle('assistant:update-assistant-info', async (_event, assistantData) => {
    return await updateAssistantInfo(assistantData)
  })

  /**
   * 删除助手
   */
  ipcMain.handle('assistant:delete-assistant', async (_, name) => {
    return await deleteAssistant(name)
  })

  /**
   * 保存助手图片文件
   */
  ipcMain.handle(
    'assistant:save-image-file',
    async (
      _event,
      fileData: Buffer | ArrayBuffer,
      assistantName: string,
      fileName: string
    ): Promise<{ success: true; path: string } | { success: false; error: string }> => {
      try {
        const assistantDir = ensureAssistantDirExists(assistantName)
        const assetsDir = path.join(assistantDir, 'assets', 'images')
        if (!fs.existsSync(assetsDir)) {
          fs.mkdirSync(assetsDir, { recursive: true })
        }
        const filePath = path.join(assetsDir, fileName + '.png')
        // 如果传入的是 ArrayBuffer，则转换为 Buffer
        const bufferData = Buffer.isBuffer(fileData) ? fileData : Buffer.from(fileData)
        // 写入文件
        fs.writeFileSync(filePath, bufferData)

        // 返回相对路径，用于在应用中引用
        return { success: true, path: `assistants/${assistantName}/assets/images/${fileName}.png` }
      } catch (error) {
        log.error('保存助手文件失败:', error)
        return { success: false, error: (error as Error).message }
      }
    }
  )

  /**
   * 下载助手资产文件
   */
  ipcMain.handle(
    'assistant:download-assistant-asset',
    async (event, { assistantName }: { assistantName: string }) => {
      return await downloadAssistantAssets(assistantName, (progress) => {
        event.sender.send('assistant:download-progress', { assistantName, progress })
      })
    }
  )

  /**
   * 加载助手数据
   */
  ipcMain.handle('assistant:load-assistant-data', async (event) => {
    return await loadAssistantsData((assistantName, progress) => {
      event.sender.send('assistant:download-progress', {
        assistantName,
        progress
      })
    })
  })

  /**
   * 检查助手是否需要更新
   */
  ipcMain.handle('assistant:need-update', async (_event, assistant) => {
    return await isNeedsUpdate(assistant)
  })

  /**
   * 获取当前助手信息
   */
  ipcMain.handle('assistant:get-current-assistant', async () => {
    try {
      const assistant = await getCurrentAssistant()
      return { success: true, data: assistant }
    } catch (error) {
      log.error('获取当前助手信息失败:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  /**
   * 切换当前助手
   */
  ipcMain.handle('assistant:switch-assistant', async (_event, assistantName: string) => {
    const result = await switchAssistant(assistantName)
    return result
  })
}

// 添加日志相关 IPC 处理
function setupLoggerIPC(): void {
  // 处理从渲染进程和preload发来的日志消息
  ipcMain.on(
    'logger:log',
    (
      _event,
      {
        level,
        message,
        args = []
      }: {
        level: string
        message: string
        args?
      }
    ) => {
      switch (level) {
        case 'debug':
          log.debug(message, ...args)
          break
        case 'info':
          log.info(message, ...args)
          break
        case 'warning':
        case 'warn':
          log.warn(message, ...args)
          break
        case 'error':
          log.error(message, ...args)
          break
        default:
          log.info(`[${level}]`, message, ...args)
      }
    }
  )

  // 打开日志目录
  ipcMain.on('logger:open-log-dir', () => {
    try {
      shell.openPath(app.getPath('logs'))
    } catch (error) {
      log.error('打开日志目录失败:', error)
    }
  })
}

/**
 * 设置工具IPC
 */
function setupUtilityIPC(): void {
  ipcMain.on('tool:open-external', (_event, url) => {
    shell.openExternal(url)
  })

  ipcMain.on('tool:notify', (_event, data) => {
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
      log.warn('Notification not supported')
    }
  })
}

function setupMainIPC(): void {
  setupUpdaterIPC()
  setupUtilityIPC()
  setupAssistantServerIPC()
  setupLoggerIPC()

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

export { setupMainIPC }
