/**
 * WebSocket API 类型声明（主进程 WS 桥接）。
 *
 * 渲染进程通过 window.api.ws 访问主进程托管的唯一 WS 连接，
 * 所有发送和接收操作通过 IPC 桥接。
 */
export interface WsApi {
  ws: {
    /**
     * 向服务端发送消息。
     *
     * @param msg - 客户端消息对象
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    send: (msg: any) => Promise<void>

    /**
     * 请求主进程建立 WebSocket 连接。
     */
    connect: () => Promise<void>

    /**
     * 请求主进程断开 WebSocket 连接。
     */
    disconnect: () => Promise<void>

    /**
     * 查询主进程当前 WS 连接状态。
     *
     * @returns true 表示已连接
     */
    getStatus: () => Promise<boolean>

    /**
     * 监听服务端推送的消息。
     *
     * @param callback - 收到消息时调用的回调
     * @returns 取消监听的函数
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onMessage: (callback: (msg: any) => void) => () => void

    /**
     * 监听连接状态变更。
     *
     * @param callback - 状态变更时调用的回调，参数为是否已连接
     * @returns 取消监听的函数
     */
    onStatusChange: (callback: (connected: boolean) => void) => () => void
  }
}
