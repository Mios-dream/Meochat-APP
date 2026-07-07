import { ipcMain } from 'electron'
import { WsService } from '../services/wsService'
import type { ClientMessage } from '@shared/types/ws'

/**
 * WebSocket IPC 处理器注册。
 *
 * 建立渲染进程与主进程之间的 WS 通信桥接：
 * - ws:send：渲染进程请求主进程向服务端发送消息
 * - ws:connect：渲染进程请求主进程建立 WS 连接
 * - ws:disconnect：渲染进程请求主进程断开 WS 连接
 * - ws:status：渲染进程查询当前连接状态
 *
 * 主进程通过 webContents.send 向所有渲染窗口推送：
 * - ws:message：服务端推送的原始消息
 * - ws:status-change：连接状态变更通知
 */
export function setupWsIPC(): void {
  const wsService = WsService.getInstance()

  /**
   * 渲染进程 → 主进程：发送消息到服务端。
   *
   * 渲染进程 ChatManager 通过 window.api.ws.send() 调用。
   */
  ipcMain.handle('ws:send', (_event, msg: ClientMessage): void => {
    wsService.send(msg)
  })

  /**
   * 渲染进程 → 主进程：请求建立 WS 连接。
   *
   * 通常在应用启动时由 ChatManager.start() 调用。
   */
  ipcMain.handle('ws:connect', (): void => {
    wsService.connect()
  })

  /**
   * 渲染进程 → 主进程：请求断开 WS 连接。
   *
   * 通常在应用退出时由 ChatManager.stop() 调用。
   */
  ipcMain.handle('ws:disconnect', (): void => {
    wsService.disconnect()
  })

  /**
   * 渲染进程 → 主进程：查询当前连接状态。
   *
   * @returns true 表示已连接
   */
  ipcMain.handle('ws:status', (): boolean => {
    return wsService.isConnected()
  })
}
