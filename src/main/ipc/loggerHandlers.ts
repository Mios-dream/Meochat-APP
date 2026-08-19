import { CHANNELS } from '@shared/ipc/channels'
import { registerOn } from '../utils/registerIpcHandler'
import { windowRegistry } from '../windows/registry'
import log from '../utils/logger'

/**
 * 获取发送日志的窗口标识（key），用于区分多窗口日志来源。
 *
 * 单例窗口返回类型名（如 main / assistant / tips），多实例窗口返回
 * `类型:实例ID`（如 widget:xxx）；未知来源（如系统级调用）返回 unknown。
 *
 * @param webContentsId 发送方 webContents.id
 * @returns 窗口 key
 */
function getSenderWindowKey(webContentsId: number): string {
  const type = windowRegistry.getWindowTypeByWebContentsId(webContentsId)
  if (!type) return 'unknown'
  const instanceId = windowRegistry.getInstanceIdByWebContentsId(webContentsId)
  return instanceId ? `${type}:${instanceId}` : type
}

/**
 * 设置日志相关IPC处理
 *
 * 接收渲染进程经 preload（window.api.log）或小组件宿主网关转发的日志，
 * 统一写入主进程 electron-log。日志消息自动附加来源窗口标识，便于排查多窗口问题。
 */
export function setupLoggerIPC(): void {
  registerOn(
    CHANNELS.LOGGER_LOG,
    (
      event,
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
      const source = getSenderWindowKey(event.sender.id)
      const prefixed = `[${source}] ${message}`
      switch (level) {
        case 'debug':
          log.debug(prefixed, ...(args || []))
          break
        case 'info':
          log.info(prefixed, ...(args || []))
          break
        case 'warning':
        case 'warn':
          log.warn(prefixed, ...(args || []))
          break
        case 'error':
          log.error(prefixed, ...(args || []))
          break
        default:
          log.info(`[${level}]`, prefixed, ...(args || []))
      }
    }
  )
}
