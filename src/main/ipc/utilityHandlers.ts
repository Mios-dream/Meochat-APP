import { ipcMain, shell, Notification, dialog } from 'electron'
import fs from 'fs'
import log from '../utils/logger'

/**
 * 设置工具IPC
 */
export function setupUtilityIPC(): void {
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

  // 选择文件
  ipcMain.handle('tool:select-file', async (_event, options) => {
    try {
      const result = await dialog.showOpenDialog({
        title: options?.title || '选择文件',
        defaultPath: options?.defaultPath,
        buttonLabel: options?.buttonLabel || '选择',
        filters: options?.filters || [{ name: '所有文件', extensions: ['*'] }],
        properties: ['openFile']
      })

      if (result.canceled) {
        return { success: false, error: '取消选择' }
      }

      if (!result.filePaths[0]) {
        return { success: false, error: '未选择任何文件' }
      }

      return {
        success: true,
        filePath: result.filePaths[0],
        filePaths: result.filePaths
      }
    } catch (error) {
      log.error('选择文件失败:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  // 选择文件夹
  ipcMain.handle('tool:select-folder', async (_event, options) => {
    try {
      const result = await dialog.showOpenDialog({
        title: options?.title || '选择文件夹',
        defaultPath: options?.defaultPath,
        buttonLabel: options?.buttonLabel || '选择',
        properties: ['openDirectory']
      })

      if (result.canceled) {
        return { success: false, error: '取消选择' }
      }

      if (!result.filePaths[0]) {
        return { success: false, error: '未选择任何文件夹' }
      }

      return {
        success: true,
        folderPath: result.filePaths[0],
        folderPaths: result.filePaths
      }
    } catch (error) {
      log.error('选择文件夹失败:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  // 检查本地路径是否存在
  ipcMain.handle('tool:path-exists', async (_event, targetPath: string) => {
    try {
      if (typeof targetPath !== 'string' || !targetPath.trim()) {
        return { success: false, error: '路径不能为空' }
      }

      const normalizedPath = targetPath.trim()
      if (!fs.existsSync(normalizedPath)) {
        return { success: true, exists: false, isFile: false }
      }

      const stat = fs.statSync(normalizedPath)
      return { success: true, exists: true, isFile: stat.isFile() }
    } catch (error) {
      log.error('检查路径失败:', error)
      return { success: false, error: (error as Error).message }
    }
  })
}
