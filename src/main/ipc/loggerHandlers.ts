import { ipcMain, app, shell } from 'electron'
import log from '../utils/logger'

/**
 * 设置日志相关IPC处理
 */
export function setupLoggerIPC(): void {
  // 处理从渲染进程和preload发来的日志消息
  ipcMain.on(
    'logger:log',
    (
      _event,
      {
        level,
        message,
        args
      }: {
        level: string
        message: string
        args?: unknown[]
      }
    ) => {
      switch (level) {
        case 'debug':
          log.debug(message, ...(args || []))
          break
        case 'info':
          log.info(message, ...(args || []))
          break
        case 'warning':
        case 'warn':
          log.warn(message, ...(args || []))
          break
        case 'error':
          log.error(message, ...(args || []))
          break
        default:
          log.info(`[${level}]`, message, ...(args || []))
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
