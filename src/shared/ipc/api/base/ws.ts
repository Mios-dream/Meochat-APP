/**
 * @file ws.ts
 * @description 与后端 WebSocket 通信相关的 IPC 接口定义
 */

export interface ws {
  send: (msg: unknown) => Promise<void>
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  getStatus: () => Promise<boolean>
  onMessage: (callback: (msg: unknown) => void) => () => void
  onStatusChange: (callback: (connected: boolean) => void) => () => void
}
