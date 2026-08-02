/**
 * IPC handler 注册工具
 *
 * 对 ipcMain.handle / ipcMain.on 的封装，提供：
 *   - channel 参数类型约束（InvokeChannelName / SendChannelName），编译期通道名校验 + 方向校验
 *   - 调用耗时监控（超过 1s 记录 warn 日志）
 *   - 异常自动捕获与日志记录
 *
 * 使用方式：
 *   import { registerHandle } from '../utils/registerIpcHandler'
 *   import { CHANNELS } from '@shared/ipc/channels'
 *
 *   // registerHandle 只接受 invoke 方向通道（renderer invoke → main handle）
 *   registerHandle(CHANNELS.KERNEL_GET_STATE, async (_event, ...args) => {
 *     return kernelManager.getState()
 *   })
 *
 *   // registerOn 只接受 send 方向通道（renderer send → main on）
 *   registerOn(CHANNELS.APP_HIDE, () => { ... })
 */

import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import type { InvokeChannelName, SendChannelName } from '@shared/ipc/channels'
import log from './logger'

/**
 * 注册 ipcMain.handle（请求-响应模式，仅限 invoke 方向通道）
 *
 * 支持类型参数 T 约束返回值类型，自动记录耗时与异常。
 * 若传入非 invoke 方向通道，编译期即报错。
 */
export function registerHandle<T = never>(
  channel: InvokeChannelName,
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
 * 注册 ipcMain.on（单向通知模式，仅限 send 方向通道）
 *
 * 自动捕获并记录 handler 中抛出的异常。
 * 若传入非 send 方向通道，编译期即报错。
 */
export function registerOn(
  channel: SendChannelName,
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
