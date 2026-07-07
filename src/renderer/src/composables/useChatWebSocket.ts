import type { ClientMessage } from '@shared/types/ws'

/**
 * WebSocket IPC 桥接管理器（渲染进程端）。
 *
 * 将渲染进程的 WS 操作通过 IPC 桥接到主进程的唯一 WS 连接。
 * 保持与旧版原生 WebSocket 方案相同的 API 接口，ChatManager 无需修改即可切换。
 *
 * 架构变更:
 *   旧版: 渲染进程直接创建 WebSocket（多窗口多连接）
 *   新版: 渲染进程 → IPC → 主进程 WsService（全局单连接）
 *
 * 用法:
 *   const ws = new ChatWebSocketManager()
 *   ws.on('chat:text', (msg) => { ... })
 *   ws.on('tool:call', (msg) => toolSystem.handleToolCall(msg))
 *   ws.connect()
 */
export class ChatWebSocketManager {
  /** 连接是否已建立（由主进程 onStatusChange 事件同步）。 */
  public isConnected: boolean = false
  /** 断连回调集合，用于 ChatManager 在连接断开时清理状态。 */
  private disconnectCallbacks: Array<() => void> = []
  /**
   * 消息处理器注册表。
   * key = 消息 type 字符串 (e.g. 'chat:text'), value = 处理器集合。
   */
  private readonly handlers = new Map<string, Set<(msg: any) => void>>()
  /** 是否已设置 IPC 监听器，防止重复注册。 */
  private listenersSetup: boolean = false

  /**
   * 注册消息监听器。
   *
   * 消息由主进程通过 IPC 'ws:message' 通道广播，
   * 本类按 msg.type 分发给注册的处理器。
   *
   * @param type - 消息类型字符串，与 ServerMessage.type 对应
   * @param handler - 消息处理回调
   * @returns 取消注册的函数，调用后该 handler 不再接收消息
   */
  public on(type: string, handler: (msg: any) => void): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set())
    }
    this.handlers.get(type)!.add(handler)

    return () => {
      this.handlers.get(type)?.delete(handler)
    }
  }

  /**
   * 向已注册的处理器派发消息。
   *
   * @param type - 消息类型字符串
   * @param msg - 解析后的消息对象
   */
  private emit(type: string, msg: any): void {
    this.handlers.get(type)?.forEach((handler) => {
      try {
        handler(msg)
      } catch (error) {
        console.error('[ChatWebSocket] 处理器执行异常:', type, error)
      }
    })
  }

  /**
   * 注册断连回调，当主进程 WS 断开时触发。
   *
   * 通过监听 'ws:status-change' IPC 事件实现，connected 变为 false 时调用。
   *
   * @param callback - 断连时执行的回调
   * @returns 取消注册的函数
   */
  public onDisconnect(callback: () => void): () => void {
    this.disconnectCallbacks.push(callback)
    return () => {
      const idx = this.disconnectCallbacks.indexOf(callback)
      if (idx !== -1) {
        this.disconnectCallbacks.splice(idx, 1)
      }
    }
  }

  /** 通知所有断连回调。 */
  private notifyDisconnect(): void {
    for (const cb of this.disconnectCallbacks) {
      try {
        cb()
      } catch (error) {
        console.error('[ChatWebSocket] 断连回调异常:', error)
      }
    }
  }

  /**
   * 请求主进程建立 WebSocket 连接。
   *
   * 首次调用时设置 IPC 监听器。重复调用会安全忽略（主进程已处理）。
   */
  public connect(): void {
    if (!this.listenersSetup) {
      this.setupIpcListeners()
      this.listenersSetup = true
    }

    window.api.ws.connect().catch((error) => {
      console.error('[ChatWebSocket] 连接请求失败:', error)
    })
  }

  /**
   * 请求主进程断开 WebSocket 连接。
   *
   * 渲染进程不做额外清理，IPC 监听器保留以便重连后继续工作。
   */
  public disconnect(): void {
    window.api.ws.disconnect().catch((error) => {
      console.error('[ChatWebSocket] 断开请求失败:', error)
    })
  }

  /**
   * 通过 IPC 向服务端发送消息。
   *
   * @param msg - 要发送的客户端消息对象
   */
  public send(msg: ClientMessage): void {
    window.api.ws.send(msg).catch((error) => {
      console.warn('[ChatWebSocket] 发送消息失败:', msg.type, error)
    })
  }

  /**
   * 设置 IPC 监听器。
   *
   * 注册两个 IPC 事件监听：
   * - ws:message：主进程推送的服务端消息，按 type 分发给已注册的处理器
   * - ws:status-change：主进程推送的连接状态变更
   */
  private setupIpcListeners(): void {
    // 监听服务端推送消息
    window.api.ws.onMessage((msg: any) => {
      if (msg && typeof msg.type === 'string') {
        this.emit(msg.type, msg)
      }
    })

    // 监听连接状态变更
    window.api.ws.onStatusChange((connected: boolean) => {
      const wasConnected = this.isConnected
      this.isConnected = connected

      if (wasConnected && !connected) {
        this.notifyDisconnect()
      }
    })
  }
}
