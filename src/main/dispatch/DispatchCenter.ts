/**
 * 统一中心调度器 —— DispatchCenter
 *
 * 提供跨窗口的定向消息分发能力，避免为每个跨窗口功能创建独立的 IPC 通道。
 * 所有窗口通过统一的 dispatch 通道与主进程和其他窗口通信。
 *
 * 架构：
 *   Renderer → (dispatch:invoke)  → Main Process → (dispatch:action) → 目标窗口
 *   Renderer → (dispatch:send-to) → Main Process → (dispatch:action) → 目标窗口
 *
 * 使用示例：
 *   // 渲染进程：请求执行一个跨窗口操作（invoke 可获取回执）
 *   window.api.dispatch.invoke({ action: 'pet:resize', payload: { scale: 1.5 }, target: 'assistant' })
 *
 *   // 渲染进程：单向发送消息到目标窗口
 *   window.api.dispatch.sendTo('assistant', 'settings:changed', { desktopSpeechBoard: false })
 *
 *   // 主进程：向指定类型窗口发送消息
 *   DispatchCenter.getInstance().sendTo('assistantSettings', 'config:updated', { ... })
 */

import { ipcMain, BrowserWindow } from 'electron'
import { CHANNELS } from '@shared/ipc/channels'
import { registerHandle, registerOn } from '../utils/registerIpcHandler'
import type { WindowType } from '../windows/types'
import { windowRegistry } from '../windows/registry'
import log from '../utils/logger'

/** 调度目标：指定窗口类型或全部窗口 */
export type DispatchTarget = WindowType | 'all'

/** 从渲染进程发来的调度请求 */
export interface DispatchRequest {
  /** 目标窗口类型，为 '*' 或 'all' 时广播到所有窗口 */
  target: DispatchTarget
  /** 动作名称 */
  action: string
  /** 动作携带的数据 */
  payload?: unknown
}

/** 调度响应的回执 */
export interface DispatchResponse {
  /** 是否成功 */
  success: boolean
  /** 返回数据 */
  data?: unknown
  /** 错误信息 */
  error?: string
}

/** invoke 模式的调度请求（带 actionId 用于配对响应） */
export interface DispatchInvokeRequest extends DispatchRequest {
  actionId: string
}

/** invoke 模式的调度响应 */
export interface DispatchInvokeResponse {
  actionId: string
  result: DispatchResponse
}

/**
 * 注册在 DispatchCenter 中的动作处理器
 * 用于在主进程层处理某些动作，无需转发到具体窗口
 */
type ActionHandler = (payload: unknown) => DispatchResponse | Promise<DispatchResponse>

/**
 * 统一中心调度器 —— 单例
 *
 * 核心功能：
 * 1. 向指定类型窗口发送消息（定向分发）
 * 2. 向所有窗口广播消息
 * 3. 支持 invoke 请求-响应模式
 * 4. 支持在主进程注册动作处理器
 */
class DispatchCenter {
  private static instance: DispatchCenter

  /** 注册在主进程的动作处理器映射 */
  private handlers: Map<string, ActionHandler> = new Map()

  /** invoke 超时时间（毫秒） */
  private static readonly INVOKE_TIMEOUT = 10000

  /**
   * 获取 DispatchCenter 单例
   * @returns DispatchCenter 实例
   */
  static getInstance(): DispatchCenter {
    if (!DispatchCenter.instance) {
      DispatchCenter.instance = new DispatchCenter()
    }
    return DispatchCenter.instance
  }

  /**
   * 向指定类型的窗口发送消息
   *
   * @param target 目标窗口类型，'all' 表示所有窗口
   * @param action 动作名称
   * @param payload 附带数据
   */
  sendTo(target: DispatchTarget, action: string, payload?: unknown): void {
    const message = { action, payload }

    if (target === 'all') {
      BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) {
          win.webContents.send(CHANNELS.DISPATCH_ACTION_EVENT, message)
        }
      })
      return
    }

    const windows = windowRegistry.getWindowsByType(target)
    windows.forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send(CHANNELS.DISPATCH_ACTION_EVENT, message)
      }
    })
  }

  /**
   * 向所有窗口广播消息
   *
   * @param action 动作名称
   * @param payload 附带数据
   */
  broadcast(action: string, payload?: unknown): void {
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send(CHANNELS.DISPATCH_ACTION_EVENT, { action, payload })
      }
    })
  }

  /**
   * 注册主进程动作处理器
   * 某些动作不需要转发到窗口，直接在主进程处理即可
   *
   * @param action 动作名称
   * @param handler 处理函数，返回 DispatchResponse
   */
  onAction(action: string, handler: ActionHandler): void {
    this.handlers.set(action, handler)
    log.info(`[DispatchCenter] 注册主进程处理器: ${action}`)
  }

  /**
   * 移除主进程动作处理器
   *
   * @param action 动作名称
   */
  removeAction(action: string): void {
    this.handlers.delete(action)
  }

  /**
   * 初始化 IPC 通道
   * 在应用启动时调用一次即可
   */
  setupIPC(): void {
    // —— 单向发送：renderer → main → 目标窗口 ——
    registerOn(CHANNELS.DISPATCH_SEND_TO, (_event, request: DispatchRequest) => {
      const { target, action, payload } = request
      log.debug(`[DispatchCenter] send-to: ${action} → ${target}`)
      this.sendTo(target, action, payload)
    })

    // —— invoke 请求-响应模式：renderer → main → 目标窗口 → main → renderer ——
    registerHandle(CHANNELS.DISPATCH_INVOKE, async (_event, request: DispatchInvokeRequest) => {
      const { actionId, target, action, payload } = request
      log.debug(`[DispatchCenter] invoke: ${action} → ${target} (${actionId})`)

      // 先检查是否有主进程注册的处理器
      const handler = this.handlers.get(action)
      if (handler) {
        try {
          const result = await handler(payload)
          return { actionId, result }
        } catch (error) {
          return {
            actionId,
            result: { success: false, error: String(error) }
          }
        }
      }

      // 转发到目标窗口并等待回执
      return new Promise<DispatchInvokeResponse>((resolve) => {
        let settled = false

        const responseChannel = `dispatch:response:${actionId}` as string

        const timer = setTimeout(() => {
          if (!settled) {
            settled = true
            ipcMain.removeAllListeners(responseChannel)
            resolve({
              actionId,
              result: { success: false, error: `调度超时 (${DispatchCenter.INVOKE_TIMEOUT}ms)` }
            })
          }
        }, DispatchCenter.INVOKE_TIMEOUT)

        // 监听来自目标窗口的响应
        const responseHandler = (
          _event: Electron.IpcMainEvent,
          response: DispatchResponse
        ): void => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          ipcMain.removeAllListeners(responseChannel)
          resolve({ actionId, result: response })
        }

        ipcMain.on(responseChannel, responseHandler)

        // 向目标窗口发送消息，附带响应通道信息
        const dispatchMessage = {
          action,
          payload,
          responseChannel,
          actionId
        }

        if (target === 'all') {
          BrowserWindow.getAllWindows().forEach((win) => {
            if (!win.isDestroyed()) {
              win.webContents.send(CHANNELS.DISPATCH_INVOKE_EVENT, dispatchMessage)
            }
          })
        } else {
          const windows = windowRegistry.getWindowsByType(target)
          windows.forEach((win) => {
            if (!win.isDestroyed()) {
              win.webContents.send(CHANNELS.DISPATCH_INVOKE_EVENT, dispatchMessage)
            }
          })
        }
      })
    })

    log.info('[DispatchCenter] IPC 通道已初始化')
  }
}

export const dispatchCenter = DispatchCenter.getInstance()
