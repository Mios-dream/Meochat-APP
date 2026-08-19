/**
 * 小组件 IPC 处理器
 * 处理小组件相关的所有 IPC 通信
 */

import { ipcMain } from 'electron'
import { CHANNELS } from '@shared/ipc/channels'
import { registerHandle } from '../utils/registerIpcHandler'
import { WidgetService } from '../services/widgetService'
import { windowRegistry } from '../windows'
import { widgetWindowService } from '../services/widgetWindowService'
import log from '../utils/logger'

import type {
  IpcResponse,
  WidgetDataMessage,
  WidgetActionRequest,
  WidgetActionResult
} from '@shared/types/widget'

/**
 * 获取宿主窗口的 webContents。
 *
 * @returns 宿主 webContents，宿主未创建或已销毁时返回 null
 */
function getWidgetHostWebContents(): Electron.WebContents | null {
  const host = windowRegistry.getWindow('widgetHost')
  return host ? host.webContents : null
}

/**
 * 设置小组件相关 IPC 处理器
 */
export function setupWidgetIPC(): void {
  const widgetService = WidgetService.getInstance()

  // 获取所有配置
  registerHandle(CHANNELS.WIDGET_CONFIG_GET_ALL, () => {
    try {
      return { success: true, data: widgetService.getAllConfigs() }
    } catch (error) {
      log.error('获取小组件配置失败:', error)
      return { success: false, error: String(error) }
    }
  })

  // 保存所有配置
  registerHandle(CHANNELS.WIDGET_CONFIG_SAVE, (_, config) => {
    try {
      const success = widgetService.saveAllConfigs(config)
      return { success }
    } catch (error) {
      log.error('保存小组件配置失败:', error)
      return { success: false, error: String(error) }
    }
  })

  // 添加小组件实例
  registerHandle(CHANNELS.WIDGET_INSTANCE_ADD, (_, instance) => {
    try {
      log.info(`收到添加小组件实例请求: ${JSON.stringify(instance)}`)
      const success = widgetService.addInstance(instance)
      log.info(`添加小组件实例结果: ${success}`)
      return { success }
    } catch (error) {
      log.error('添加小组件实例失败:', error)
      return { success: false, error: String(error) }
    }
  })

  // 更新小组件实例
  registerHandle(CHANNELS.WIDGET_INSTANCE_UPDATE, (_, data) => {
    try {
      const { instanceId, updates } = data
      const success = widgetService.updateInstance(instanceId, updates)
      return { success }
    } catch (error) {
      log.error('更新小组件实例失败:', error)
      return { success: false, error: String(error) }
    }
  })

  // 删除小组件实例
  registerHandle(CHANNELS.WIDGET_INSTANCE_DELETE, (_, instanceId) => {
    try {
      // 先关闭窗口
      const win = windowRegistry.getWindow(`widget:${instanceId}`)
      if (win && !win.isDestroyed()) {
        win.close()
      }
      const success = widgetService.deleteInstance(instanceId)
      return { success }
    } catch (error) {
      log.error('删除小组件实例失败:', error)
      return { success: false, error: String(error) }
    }
  })

  // 获取指定实例数据
  registerHandle(CHANNELS.WIDGET_INSTANCE_GET_CURRENT, (_, payload?: { instanceId?: string }) => {
    try {
      const instanceId = payload?.instanceId
      if (!instanceId) {
        return { success: false, error: '缺少 instanceId 参数' }
      }
      const instance = widgetService.getInstance(instanceId)
      return { success: true, data: instance }
    } catch (error) {
      log.error('获取小组件实例失败:', error)
      return { success: false, error: String(error) }
    }
  })

  // 创建小组件独立窗口
  registerHandle(CHANNELS.WIDGET_WINDOW_CREATE, async (_, instanceId) => {
    try {
      log.info(`收到创建小组件窗口请求: ${instanceId}`)
      const instance = widgetService.getInstance(instanceId)
      if (!instance) {
        log.error(`小组件实例不存在: ${instanceId}`)
        return { success: false, error: '小组件实例不存在' }
      }
      log.info(
        `创建小组件窗口: ${instance.widgetId}, 位置: ${JSON.stringify(instance.position)}, 大小: ${JSON.stringify(instance.size)}`
      )
      // 通过宿主窗口 window.open 创建，多个小组件共享同一渲染进程
      await widgetWindowService.createWidgetWindow(instance)
      return { success: true }
    } catch (error) {
      log.error('创建小组件窗口失败:', error)
      return { success: false, error: String(error) }
    }
  })

  // 关闭小组件独立窗口
  registerHandle(CHANNELS.WIDGET_WINDOW_CLOSE, (_, instanceId) => {
    try {
      const win = windowRegistry.getWindow(`widget:${instanceId}`)
      if (win && !win.isDestroyed()) {
        win.close()
      }
      return { success: true }
    } catch (error) {
      log.error('关闭小组件窗口失败:', error)
      return { success: false, error: String(error) }
    }
  })

  // 切换小组件窗口置顶状态
  registerHandle(CHANNELS.WIDGET_WINDOW_TOGGLE_PIN, (_, data) => {
    try {
      const { instanceId, pinned } = data
      const win = windowRegistry.getWindow(`widget:${instanceId}`)
      if (win && !win.isDestroyed()) {
        win.setAlwaysOnTop(pinned, 'screen-saver')
      }
      widgetService.updateInstance(instanceId, { pinned })
      return { success: true }
    } catch (error) {
      log.error('切换小组件窗口置顶失败:', error)
      return { success: false, error: String(error) }
    }
  })

  // 发送数据到指定小组件
  registerHandle(CHANNELS.WIDGET_DATA_SEND, (_, data: WidgetDataMessage) => {
    try {
      // 子窗口无 preload，事件统一发到宿主，由宿主网关按 toId 转发
      if (data.toId) {
        const host = getWidgetHostWebContents()
        if (host) {
          host.send(CHANNELS.WIDGET_DATA_RECEIVED_EVENT, data)
        }
      }
      return { success: true }
    } catch (error) {
      log.error('发送小组件数据失败:', error)
      return { success: false, error: String(error) }
    }
  })

  // 广播数据到所有小组件
  registerHandle(CHANNELS.WIDGET_DATA_BROADCAST, (_, data: Omit<WidgetDataMessage, 'toId'>) => {
    try {
      // 子窗口无 preload，事件统一发到宿主，由宿主网关广播到所有子窗口
      const host = getWidgetHostWebContents()
      if (host) {
        host.send(CHANNELS.WIDGET_DATA_RECEIVED_EVENT, data)
      }
      return { success: true }
    } catch (error) {
      log.error('广播小组件数据失败:', error)
      return { success: false, error: String(error) }
    }
  })

  // 更新全局设置
  registerHandle(CHANNELS.WIDGET_SETTINGS_UPDATE, (_, settings) => {
    try {
      const success = widgetService.updateGlobalSettings(settings)
      return { success }
    } catch (error) {
      log.error('更新小组件全局设置失败:', error)
      return { success: false, error: String(error) }
    }
  })

  // ── 小组件动作协议（LLM 工具调用 → 遥控小组件） ──

  /**
   * 执行小组件动作并等待结果。
   *
   * 主渲染进程通过此 IPC 向目标类型的所有小组件窗口广播动作指令，
   * 等待首个成功响应或全部失败后返回。
   */
  registerHandle(
    CHANNELS.WIDGET_ACTION_EXEC,
    async (
      _,
      payload: {
        widget_type: string
        action: string
        params: Record<string, unknown>
        timeout_ms?: number
      }
    ): Promise<IpcResponse<WidgetActionResult>> => {
      const { widget_type, action, params, timeout_ms = 8000 } = payload
      const actionId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

      // 查找匹配类型且已启用的实例
      const instances = widgetService.getInstancesByType(widget_type)

      if (instances.length === 0) {
        return {
          success: false,
          error: `没有找到已启用的「${widget_type}」小组件实例，请先添加该组件。`
        }
      }

      // 筛选出已打开窗口的实例
      const openWindows: Array<{ instance: (typeof instances)[0]; win: Electron.BrowserWindow }> =
        []
      for (const inst of instances) {
        const win = windowRegistry.getWindow(`widget:${inst.id}`)
        if (win && !win.isDestroyed()) {
          openWindows.push({ instance: inst, win })
        }
      }

      if (openWindows.length === 0) {
        return {
          success: false,
          error: `「${widget_type}」小组件窗口未打开，请先打开该组件。`
        }
      }

      // 广播动作到所有打开的小组件窗口，等待首个响应
      return new Promise<IpcResponse<WidgetActionResult>>((resolve) => {
        let settled = false

        const timer = setTimeout(() => {
          if (!settled) {
            settled = true
            ipcMain.removeListener(CHANNELS.WIDGET_ACTION_RESULT, resultHandler)
            resolve({
              success: false,
              error: `小组件动作执行超时（${timeout_ms}ms），${widget_type} 未响应。`
            })
          }
        }, timeout_ms)

        const resultHandler = (_event: Electron.IpcMainEvent, result: WidgetActionResult): void => {
          // 权限校验：只有 widget / widgetHost（宿主网关代发）窗口可以上报动作结果
          const senderType = windowRegistry.getWindowTypeByWebContentsId(_event.sender.id)
          if (senderType !== 'widget' && senderType !== 'widgetHost') {
            log.warn(`[IPC] 非 widget 窗口尝试上报动作结果: ${String(senderType)}`)
            return
          }
          if (result.action_id !== actionId) return
          if (settled) return

          settled = true
          clearTimeout(timer)
          ipcMain.removeListener(CHANNELS.WIDGET_ACTION_RESULT, resultHandler)

          if (result.success) {
            resolve({ success: true, data: result })
          } else {
            resolve({ success: false, error: result.error ?? '未知错误' })
          }
        }

        ipcMain.on(CHANNELS.WIDGET_ACTION_RESULT, resultHandler)

        const request: WidgetActionRequest = { action_id: actionId, widget_type, action, params }

        // 子窗口无 preload，动作指令统一发到宿主，由宿主网关按 widget_type 广播给对应子窗口
        const host = getWidgetHostWebContents()
        if (host) {
          host.send(CHANNELS.WIDGET_ACTION_RECEIVED_EVENT, request)
        }
      })
    }
  )

  log.info('小组件 IPC 处理器已设置')
}
