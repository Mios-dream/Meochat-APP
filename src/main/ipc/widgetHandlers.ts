/**
 * 小组件 IPC 处理器
 * 处理小组件相关的所有 IPC 通信
 */

import { ipcMain, BrowserWindow } from 'electron'
import { WidgetService } from '../services/widgetService'
import {
  createMultiInstanceWindow,
  windowRegistry,
  widgetWindowConfig,
  createWidgetOptions
} from '../windows'
import log from '../utils/logger'

import type {
  IpcResponse,
  WidgetDataMessage,
  WidgetActionRequest,
  WidgetActionResult
} from '@shared/types/widget'

/**
 * 设置小组件相关 IPC 处理器
 */
export function setupWidgetIPC(): void {
  const widgetService = WidgetService.getInstance()

  // 获取所有配置
  ipcMain.handle('widget:config:get-all', () => {
    try {
      return { success: true, data: widgetService.getAllConfigs() }
    } catch (error) {
      log.error('获取小组件配置失败:', error)
      return { success: false, error: String(error) }
    }
  })

  // 保存所有配置
  ipcMain.handle('widget:config:save', (_, config) => {
    try {
      const success = widgetService.saveAllConfigs(config)
      return { success }
    } catch (error) {
      log.error('保存小组件配置失败:', error)
      return { success: false, error: String(error) }
    }
  })

  // 添加小组件实例
  ipcMain.handle('widget:instance:add', (_, instance) => {
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
  ipcMain.handle('widget:instance:update', (_, data) => {
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
  ipcMain.handle('widget:instance:delete', (_, instanceId) => {
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

  // 获取小组件实例
  ipcMain.handle('widget:instance:get', (_, instanceId) => {
    try {
      const instance = widgetService.getInstance(instanceId)
      return { success: true, data: instance }
    } catch (error) {
      log.error('获取小组件实例失败:', error)
      return { success: false, error: String(error) }
    }
  })

  // 获取所有小组件实例
  ipcMain.handle('widget:instance:get-all', () => {
    try {
      const instances = widgetService.getAllInstances()
      return { success: true, data: instances }
    } catch (error) {
      log.error('获取小组件实例列表失败:', error)
      return { success: false, error: String(error) }
    }
  })

  // 创建小组件独立窗口
  ipcMain.handle('widget:window:create', (_, instanceId) => {
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
      const options = createWidgetOptions(
        instance.id,
        instance.widgetId,
        instance.position,
        instance.size
      )
      createMultiInstanceWindow(
        widgetWindowConfig,
        instance.id,
        options.query as Record<string, string>,
        options.overrides
      )
      return { success: true }
    } catch (error) {
      log.error('创建小组件窗口失败:', error)
      return { success: false, error: String(error) }
    }
  })

  // 关闭小组件独立窗口
  ipcMain.handle('widget:window:close', (_, instanceId) => {
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
  ipcMain.handle('widget:window:toggle-pin', (_, data) => {
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
  ipcMain.handle('widget:data:send', (_, data: WidgetDataMessage) => {
    try {
      // 如果指定了目标，发送到目标窗口
      if (data.toId) {
        const win = windowRegistry.getWindow(`widget:${data.toId}`)
        if (win && !win.isDestroyed()) {
          win.webContents.send('widget:data:received', data)
        }
      }
      return { success: true }
    } catch (error) {
      log.error('发送小组件数据失败:', error)
      return { success: false, error: String(error) }
    }
  })

  // 广播数据到所有小组件
  ipcMain.handle('widget:data:broadcast', (_, data: Omit<WidgetDataMessage, 'toId'>) => {
    try {
      // 广播到所有小组件窗口
      BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) {
          win.webContents.send('widget:data:received', data)
        }
      })
      return { success: true }
    } catch (error) {
      log.error('广播小组件数据失败:', error)
      return { success: false, error: String(error) }
    }
  })

  // 更新全局设置
  ipcMain.handle('widget:settings:update', (_, settings) => {
    try {
      const success = widgetService.updateGlobalSettings(settings)
      return { success }
    } catch (error) {
      log.error('更新小组件全局设置失败:', error)
      return { success: false, error: String(error) }
    }
  })

  // 获取全局设置
  ipcMain.handle('widget:settings:get', () => {
    try {
      const settings = widgetService.getGlobalSettings()
      return { success: true, data: settings }
    } catch (error) {
      log.error('获取小组件全局设置失败:', error)
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
  ipcMain.handle(
    'widget:action:exec',
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
            ipcMain.removeListener('widget:action:result', resultHandler)
            resolve({
              success: false,
              error: `小组件动作执行超时（${timeout_ms}ms），${widget_type} 未响应。`
            })
          }
        }, timeout_ms)

        const resultHandler = (_event: Electron.IpcMainEvent, result: WidgetActionResult): void => {
          if (result.action_id !== actionId) return
          if (settled) return

          settled = true
          clearTimeout(timer)
          ipcMain.removeListener('widget:action:result', resultHandler)

          if (result.success) {
            resolve({ success: true, data: result })
          } else {
            resolve({ success: false, error: result.error ?? '未知错误' })
          }
        }

        ipcMain.on('widget:action:result', resultHandler)

        const request: WidgetActionRequest = { action_id: actionId, widget_type, action, params }

        for (const { win } of openWindows) {
          try {
            win.webContents.send('widget:action:received', request)
          } catch (err) {
            log.error(`向小组件窗口发送动作失败:`, err)
          }
        }
      })
    }
  )

  log.info('小组件 IPC 处理器已设置')
}
