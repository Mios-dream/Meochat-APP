/**
 * 小组件控制系统 · 单例
 *
 * 作为 ChatManager / ToolSystem 与小组件窗口之间的 IPC 通信桥梁。
 *
 * 提供统一的 widgetAction.exec() 接口给工具处理函数使用，
 * 工具注册时只需要知道"目标小组件类型"和"动作名称"即可遥控小组件。
 *
 * 通信路径：
 *   主渲染进程 (ChatManager)
 *     → IPC: widget:action:exec (mainPreload)
 *       → 主进程 (widgetHandlers)
 *         → webContents.send('widget:action:received') → 小组件窗口
 *           → 小组件执行动作
 *         ← IPC: widget:action:result
 *       ← 返回 IpcResponse<WidgetActionResult>
 *     → ToolSystem 回传 tool:result 到服务端
 */

/**
 * 小组件动作执行结果。
 */
export interface WidgetExecResult {
  success: boolean
  data?: Record<string, unknown>
  error?: string
}

/**
 * 小组件控制系统（单例）。
 */
export class WidgetControlSystem {
  private static instance: WidgetControlSystem

  /** 获取单例实例。 */
  static getInstance(): WidgetControlSystem {
    if (!WidgetControlSystem.instance) {
      WidgetControlSystem.instance = new WidgetControlSystem()
    }
    return WidgetControlSystem.instance
  }

  /**
   * 执行小组件动作（核心方法）。
   *
   * 通过主窗口 preload 暴露的 widgetAction API，
   * 向主进程发起 widget:action:exec IPC 调用，
   * 主进程广播到目标类型的小组件窗口并等待响应。
   *
   * @param widgetType - 目标小组件类型 ID（weather / todo / note / clock / daily-quote）
   * @param action - 动作名称（set_location / add_item / clear_all 等）
   * @param params - 动作参数对象
   * @param timeoutMs - 超时时间（毫秒），默认 8000ms
   * @returns 动作执行结果包装
   */
  async execAction(
    widgetType: string,
    action: string,
    params: Record<string, unknown>,
    timeoutMs: number = 8000
  ): Promise<WidgetExecResult> {
    try {
      // 通过 mainPreload 暴露的 widgetAction.exec 发送 IPC
      const api = window.api.widgetAction
      if (!api?.exec) {
        return {
          success: false,
          error: 'widgetAction API 不可用，请确认 mainPreload 已正确配置。'
        }
      }

      const result = await api.exec(widgetType, action, params, timeoutMs)
      return result as WidgetExecResult
    } catch (error) {
      return {
        success: false,
        error: `小组件动作执行异常: ${(error as Error).message}`
      }
    }
  }
}
