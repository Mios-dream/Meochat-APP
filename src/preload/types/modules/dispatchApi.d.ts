/**
 * 统一调度中心 API 类型声明
 */
export interface DispatchApi {
  dispatch: {
    /**
     * 向指定类型窗口发送单向消息
     * @param target 目标窗口类型（如 'assistant'、'main'、'all'）
     * @param action 动作名称
     * @param payload 附带数据
     */
    sendTo: (target: string, action: string, payload?: unknown) => void

    /**
     * 通过 DispatchCenter 执行一个动作，可获取回执
     * @param request 包含 action、payload、target 的请求对象
     * @returns 调度响应结果
     */
    invoke: (request: { action: string; payload?: unknown; target: string }) => Promise<{
      success: boolean
      data?: unknown
      error?: string
    }>

    /**
     * 监听来自 DispatchCenter 分发的动作
     * @param callback 回调函数，接收 { action, payload } 格式的消息
     * @returns 取消监听函数
     */
    onAction: (callback: (data: { action: string; payload?: unknown }) => void) => () => void

    /**
     * 监听来自 DispatchCenter 的 invoke 请求
     * @param callback 回调函数
     * @returns 取消监听函数
     */
    onInvoke: (callback: (data: {
      action: string
      payload?: unknown
      responseChannel: string
      actionId: string
    }) => void) => () => void

    /**
     * 向 DispatchCenter 回执 invoke 响应
     * @param responseChannel 从 invoke 请求中获取的响应通道名
     * @param result 执行结果
     */
    respond: (responseChannel: string, result: {
      success: boolean
      data?: unknown
      error?: string
    }) => void
  }
}
