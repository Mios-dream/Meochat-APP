/**
 * IPC handler 注册工具
 *
 * 对 ipcMain.handle / ipcMain.on 的封装，提供：
 *   - channel 参数类型约束（ChannelName），编译期通道名校验
 *   - 调用耗时监控（超过 1s 记录 warn 日志）
 *   - 异常自动捕获与日志记录
 *
 * 使用方式：
 *   import { registerHandle } from '../utils/registerIpcHandler'
 *   import { CHANNELS } from '@shared/ipc/channels'
 *
 *   registerHandle(CHANNELS.KERNEL_GET_STATE, async (_event, ...args) => {
 *     return kernelManager.getState()
 *   })
 */

import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import type { ChannelName } from '@shared/ipc/channels'
import log from './logger'

/**
 * 注册 ipcMain.handle（请求-响应模式）
 *
 * 支持类型参数 T 约束返回值类型，自动记录耗时与异常。
 */
export function registerHandle<T = never>(
  channel: ChannelName,
  handler: (event: IpcMainInvokeEvent, ...args: any[]) => T | Promise<T>
): void {
  ipcMain.handle(channel, async (event, ...args) => {
    const start = Date.now()
    try {
      const result = await handler(event, ...args)
      const duration = Date.now() - start
      if (duration > 1000) {
        log.warn(`[IPC] ${channel} 处理耗时 ${duration}ms`)
      }
      return result
    } catch (error) {
      log.error(`[IPC] ${channel} 处理异常 (${Date.now() - start}ms):`, error)
      throw error
    }
  })
}

/**
 * 注册 ipcMain.on（单向通知模式）
 *
 * 自动捕获并记录 handler 中抛出的异常。
 */
export function registerOn(
  channel: ChannelName,
  handler: (event: Electron.IpcMainEvent, ...args: any[]) => void
): void {
  ipcMain.on(channel, (event, ...args) => {
    try {
      handler(event, ...args)
    } catch (error) {
      log.error(`[IPC] ${channel} 处理异常:`, error)
    }
  })
}
