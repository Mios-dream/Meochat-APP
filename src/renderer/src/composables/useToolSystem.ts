import type { ChatWebSocketManager } from './useChatWebSocket'
import type { ToolCallWsMessage } from '@shared/types/ws'

/**
 * 工具执行上下文，工具处理函数可通过它向服务端推送进度。
 */
interface ToolContext {
  /** 工具调用 ID，用于匹配 tool:result / tool:progress 消息。 */
  call_id: string
  /**
   * 向服务端发送执行进度。
   *
   * @param status - 当前执行阶段
   * @param progress - 进度值：0~1 表示百分比，-1 表示不确定
   * @param message - 进度描述文本
   */
  sendProgress: (
    status: 'started' | 'executing' | 'finalizing',
    progress: number,
    message: string
  ) => void
}

/**
 * 工具处理函数签名。
 *
 * @param args - 服务端传递的工具调用参数
 * @param ctx - 执行上下文（含进度回调）
 * @returns 返回给 LLM 的结果对象，将被 JSON.stringify 后回传
 */
type ToolHandler = (
  args: Record<string, unknown>,
  ctx: ToolContext
) => Promise<Record<string, unknown>>

/**
 * 客户端工具执行系统。
 *
 * 负责维护工具注册表、调度服务端下发的 tool:call 请求、
 * 处理敏感工具确认流程，并将执行结果回传给服务端。
 *
 * 用法:
 *   const toolSystem = new ToolSystem(wsManager)
 *
 *   // 注册工具
 *   toolSystem.register('set_weather_location', async (args, ctx) => {
 *     await window.electronAPI.setWeatherCity(args.city as string)
 *     return { city: args.city, updated: true }
 *   })
 *
 *   // 在 ws.on('tool:call', ...) 中调用
 *   ws.on('tool:call', (msg) => toolSystem.handleToolCall(msg))
 */
export class ToolSystem {
  /**
   * 工具注册表。
   * key = 工具名称，value = 处理函数。
   */
  private readonly registry = new Map<string, ToolHandler>()

  public constructor(private readonly ws: ChatWebSocketManager) {}

  /**
   * 注册客户端工具。
   *
   * @param toolName - 工具名称，必须与后端注册的工具名一致
   * @param handler - 工具处理函数
   */
  public register(toolName: string, handler: ToolHandler): void {
    this.registry.set(toolName, handler)
  }

  /**
   * 注销客户端工具。
   *
   * @param toolName - 要注销的工具名称
   */
  public unregister(toolName: string): void {
    this.registry.delete(toolName)
  }

  /**
   * ★ 处理服务端下发的 tool:call 消息（核心入口）。
   *
   * 完整流程:
   *   1. 敏感度检查 → 必要时弹出确认对话框
   *   2. 按 tool_name 从注册表中查找处理函数
   *   3. 构建执行上下文（含进度回调）
   *   4. 执行工具 → 回传 tool:result
   *
   * @param msg - 服务端下发的工具调用消息
   */
  public async handleToolCall(msg: ToolCallWsMessage): Promise<void> {
    const { call_id, tool_name, arguments: args, sensitivity } = msg

    // Step 1: 敏感度检查
    if (sensitivity === 'sensitive' || sensitivity === 'dangerous') {
      const confirmed = await this.showConfirmDialog(
        msg.confirm_message ?? `确认执行 "${tool_name}"？`,
        sensitivity === 'dangerous'
      )
      this.ws.send({
        type: 'tool:confirm',
        call_id,
        confirmed,
        deny_reason: confirmed ? '' : '用户取消'
      })
      if (!confirmed) {
        return
      }
    }

    // Step 2: 路由到工具处理函数
    const handler = this.registry.get(tool_name)
    if (!handler) {
      this.ws.send({
        type: 'tool:result',
        call_id,
        success: false,
        result: '',
        error: `未知客户端工具: ${tool_name}`,
        error_code: 'TOOL_NOT_FOUND'
      })
      return
    }

    // Step 3: 构建执行上下文
    const ctx: ToolContext = {
      call_id,
      sendProgress: (status, progress, message) => {
        this.ws.send({
          type: 'tool:progress',
          call_id,
          tool_name,
          status,
          progress,
          message
        })
      }
    }

    // Step 4: 执行 + 回传结果
    try {
      const result = await handler(args, ctx)
      this.ws.send({
        type: 'tool:result',
        call_id,
        success: true,
        result: JSON.stringify(result)
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      this.ws.send({
        type: 'tool:result',
        call_id,
        success: false,
        result: '',
        error: message,
        error_code: 'TOOL_EXEC_ERROR'
      })
    }
  }

  /**
   * 弹出确认对话框，返回用户是否确认。
   *
   * dangerous 模式需要二次确认（输入特定文本），sensitive 只需点击确认。
   *
   * @param message - 确认提示文本
   * @param isDangerous - 是否为危险操作（需要二次输入确认）
   */
  private async showConfirmDialog(message: string, isDangerous: boolean): Promise<boolean> {
    // 实现取决于 UI 框架，当前使用浏览器 confirm 作为兜底方案。
    // 后续可替换为 Vue 自定义确认对话框组件或 Electron native dialog。
    if (isDangerous) {
      // 危险操作：要求用户输入 "确认" 二次验证
      const input = window.prompt(message + '\n请输入"确认"以继续')
      return input === '确认'
    }
    return window.confirm(message)
  }
}
