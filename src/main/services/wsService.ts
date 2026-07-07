import WebSocket from 'ws'
import { BrowserWindow } from 'electron'
import { getBaseUrl } from '@shared/api/request'
import type { ServerMessage, ClientMessage } from '@shared/types/ws'

/**
 * 断线重连配置常量。
 */
const RECONNECT_MAX_RETRIES = 5
const RECONNECT_BASE_DELAY = 1000
const HEARTBEAT_INTERVAL_MS = 60_000
const WS_PATH = '/api/chat_ws'

/**
 * 根据当前 baseUrl 构造 WebSocket 连接地址。
 *
 * 例如 http://127.0.0.1:8001 → ws://127.0.0.1:8001/api/chat_ws
 */
function buildWsUrl(): string {
  try {
    const base = getBaseUrl()
    const url = new URL(WS_PATH, base)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    return url.toString()
  } catch {
    return `ws://127.0.0.1:8001${WS_PATH}`
  }
}

/**
 * WebSocket 主进程服务（单例）。
 *
 * 管理全局唯一的 WS 连接，负责：
 * - 与服务端建立 / 维持 / 重连 WebSocket 连接
 * - 心跳保活
 * - 将服务端推送的消息广播到所有渲染进程窗口
 * - 接收渲染进程的发送请求，统一通过 IPC 转发
 *
 * 与旧版渲染进程方案的差异:
 *   - 连接生命周期绑定到应用而非窗口
 *   - 所有窗口共享同一条 WS 连接，避免多连接问题
 *   - 窗口开关不影响连接状态
 *   - 断线重连由主进程统一处理
 */
export class WsService {
  private static instance: WsService | null = null

  /** 内部 ws 库 WebSocket 实例。 */
  private ws: WebSocket | null = null
  /** 当前连接状态。 */
  private connected: boolean = false
  /** 当前重试次数。 */
  private retryCount: number = 0
  /** 是否已主动断开（阻止自动重连）。 */
  private disposed: boolean = false
  /** 心跳定时器 ID。 */
  private heartbeatTimer: NodeJS.Timeout | null = null

  /**
   * 获取 WsService 单例实例。
   *
   * 首次调用时创建实例，后续返回同一实例。
   */
  public static getInstance(): WsService {
    if (!WsService.instance) {
      WsService.instance = new WsService()
    }
    return WsService.instance
  }

  /**
   * 建立 WebSocket 连接。
   *
   * 如果已有活跃连接或连接正在建立中，则忽略重复调用。
   * 连接成功后重置重试计数、启动心跳并将状态变更广播到所有渲染窗口。
   */
  public connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      return
    }

    this.disposed = false
    const url = buildWsUrl()
    console.log(`[WsService] 正在连接: ${url}`)

    try {
      this.ws = new WebSocket(url)
    } catch (error) {
      console.error('[WsService] 创建连接失败:', error)
      return
    }

    this.ws.on('open', () => {
      console.log('[WsService] 连接已建立')
      this.connected = true
      this.retryCount = 0
      this.startHeartbeat()
      this.broadcastToAll('ws:status-change', true)
    })

    this.ws.on('message', (data: WebSocket.Data) => {
      try {
        const raw = typeof data === 'string' ? data : data.toString()
        const msg = JSON.parse(raw) as ServerMessage
        if (msg && typeof msg.type === 'string') {
          this.broadcastToAll('ws:message', msg)
        }
      } catch (error) {
        console.error('[WsService] 消息解析失败:', error)
      }
    })

    this.ws.on('close', () => {
      console.log('[WsService] 连接已关闭')
      this.connected = false
      this.stopHeartbeat()
      this.broadcastToAll('ws:status-change', false)

      if (this.disposed) {
        return
      }

      const delay = Math.min(RECONNECT_BASE_DELAY * Math.pow(2, this.retryCount), 30_000)
      this.retryCount++

      if (this.retryCount <= RECONNECT_MAX_RETRIES) {
        console.log(
          `[WsService] ${delay}ms 后尝试重连 (${this.retryCount}/${RECONNECT_MAX_RETRIES})`
        )
        setTimeout(() => this.connect(), delay)
      } else {
        console.warn('[WsService] 已达最大重试次数，停止重连')
      }
    })

    this.ws.on('error', (error: Error) => {
      console.error('[WsService] 连接发生错误:', error.message)
    })
  }

  /**
   * 断开 WebSocket 连接并阻止自动重连。
   *
   * 通常在应用退出时调用，主动清理连接资源。
   */
  public disconnect(): void {
    this.disposed = true
    this.stopHeartbeat()
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.connected = false
    this.broadcastToAll('ws:status-change', false)
  }

  /**
   * 获取当前连接状态。
   *
   * @returns true 表示已连接，false 表示未连接或已断开
   */
  public isConnected(): boolean {
    return this.connected
  }

  /**
   * 向服务端发送消息。
   *
   * @param msg - 要发送的客户端消息对象
   */
  public send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
    } else {
      console.warn('[WsService] 连接未就绪，消息丢弃:', msg.type)
    }
  }

  /**
   * 向指定渲染进程窗口立即同步当前连接状态。
   *
   * 用于新创建的窗口在渲染进程初始化时获取最新的连接状态，
   * 避免因错过之前的广播事件而陷入不一致。
   *
   * @param window - 目标 BrowserWindow 实例
   */
  public syncStatusToWindow(window: BrowserWindow): void {
    if (!window.isDestroyed()) {
      window.webContents.send('ws:status-change', this.connected)
    }
  }

  // ── 内部方法 ────────────────────────────────────────────────

  /** 启动心跳定时器。 */
  private startHeartbeat(): void {
    this.stopHeartbeat()
    this.heartbeatTimer = setInterval(() => {
      this.send({ type: 'ping' })
    }, HEARTBEAT_INTERVAL_MS)
  }

  /** 停止心跳定时器。 */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  /**
   * 向所有渲染进程窗口广播消息。
   *
   * @param channel - IPC 通道名称
   * @param data - 要广播的数据（会被结构化克隆）
   */
  private broadcastToAll(channel: string, data: unknown): void {
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, data)
      }
    })
  }
}
