import { shell } from 'electron'
import { CHANNELS } from '@shared/ipc/channels'
import { registerOn } from '../utils/registerIpcHandler'
import log from '../utils/logger'
import { resolveLogDir } from '../utils/pathResolve'

/**
 * 设置日志相关IPC处理
 */
export function setupLoggerIPC(): void {
  registerOn(
    CHANNELS.LOGGER_LOG,
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

  registerOn(CHANNELS.LOGGER_OPEN_LOG_DIR, () => {
    try {
      shell.openPath(resolveLogDir())
    } catch (error) {
      log.error('打开日志目录失败:', error)
    }
  })
}
