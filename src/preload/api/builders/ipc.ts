/**
 * IPC 工具封装
 *
 * 对 ipcRenderer 的 send / invoke / on 进行类型友好的二次封装。
 */

import { ipcRenderer } from 'electron'

/**
 * IPC 工具对象
 *
 * on 方法透传原始 ipcRenderer.on 参数，不剥离 event 对象。
 * 调用方可使用 (_event, data) 双参数风格或 (data) 单参数风格，
 * 兼容两种写法。
 */
export const ipc = {
  send: (channel: string, data?: unknown) => ipcRenderer.send(channel, data),
  invoke: <T = unknown>(channel: string, data?: unknown) =>
    ipcRenderer.invoke(channel, data) as Promise<T>,
  on: (channel: string, listener: (...args: any[]) => void) => {
    ipcRenderer.on(channel, listener)
    return () => {
      ipcRenderer.removeListener(channel, listener)
    }
  },
  removeAllListeners: (channel: string) => ipcRenderer.removeAllListeners(channel)
}
