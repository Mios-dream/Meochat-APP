import { shell, Notification, dialog } from 'electron'
import { CHANNELS } from '@shared/ipc/channels'
import { registerHandle, registerOn } from '../utils/registerIpcHandler'
import fs from 'fs'
import log from '../utils/logger'

/**
 * 设置工具IPC
 */
export function setupUtilityIPC(): void {
  registerOn(CHANNELS.TOOL_OPEN_EXTERNAL, (_event, url) => {
    shell.openExternal(url)
  })

  registerOn(CHANNELS.TOOL_NOTIFY, (_event, data) => {
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
  registerHandle(CHANNELS.TOOL_SELECT_FILE, async (_event, options) => {
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
  registerHandle(CHANNELS.TOOL_SELECT_FOLDER, async (_event, options) => {
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

  // 读取文件并返回 Base64 编码内容
  registerHandle(CHANNELS.TOOL_READ_FILE_BASE64, async (_event, filePath: string) => {
    try {
      if (typeof filePath !== 'string' || !filePath.trim()) {
        return { success: false, error: '文件路径不能为空' }
      }
      const normalizedPath = filePath.trim()
      if (!fs.existsSync(normalizedPath)) {
        return { success: false, error: '文件不存在' }
      }
      const stat = fs.statSync(normalizedPath)
      if (!stat.isFile()) {
        return { success: false, error: '路径不是文件' }
      }
      const fileName = normalizedPath.split('\\').pop()?.split('/').pop() ?? normalizedPath
      const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
      const mimeMap: Record<string, string> = {
        txt: 'text/plain',
        md: 'text/markdown',
        pdf: 'application/pdf',
        json: 'application/json',
        xml: 'application/xml',
        csv: 'text/csv',
        html: 'text/html',
        htm: 'text/html',
        js: 'text/javascript',
        ts: 'text/typescript',
        py: 'text/x-python',
        java: 'text/x-java',
        cpp: 'text/x-c++',
        c: 'text/x-c',
        h: 'text/x-c-header',
        yaml: 'text/yaml',
        yml: 'text/yaml',
        toml: 'text/toml',
        ini: 'text/plain',
        cfg: 'text/plain',
        conf: 'text/plain',
        log: 'text/plain',
        sql: 'text/x-sql',
        sh: 'text/x-shellscript',
        bat: 'text/x-batch',
        ps1: 'text/x-powershell',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        webp: 'image/webp',
        bmp: 'image/bmp',
        svg: 'image/svg+xml',
        ico: 'image/x-icon',
        mp3: 'audio/mpeg',
        wav: 'audio/wav',
        ogg: 'audio/ogg',
        mp4: 'video/mp4',
        webm: 'video/webm',
        zip: 'application/zip',
        rar: 'application/vnd.rar',
        '7z': 'application/x-7z-compressed',
        gz: 'application/gzip',
        doc: 'application/msword',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        xls: 'application/vnd.ms-excel',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ppt: 'application/vnd.ms-powerpoint',
        pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      }
      const mimeType = mimeMap[ext] || 'application/octet-stream'
      const buffer = await fs.promises.readFile(normalizedPath)
      const base64 = buffer.toString('base64')
      return { success: true, name: fileName, content: base64, mimeType }
    } catch (error) {
      log.error('读取文件失败:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  // 检查本地路径是否存在
  registerHandle(CHANNELS.TOOL_PATH_EXISTS, async (_event, targetPath: string) => {
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
