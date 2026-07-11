/**
 * IPC 工具封装
 *
 * 对 ipcRenderer 的 send / invoke / on 进行类型友好的二次封装。
 */

import { ipcRenderer } from 'electron'

/**
 * IPC 工具对象
 *
 * on 方法自动剥离 ipcRenderer.on 的第一个 event 参数，
 * 调用方只需关注实际数据参数。
 */
export const ipc = {
  send: (channel: string, data?: unknown) => ipcRenderer.send(channel, data),
  invoke: <T = unknown>(channel: string, data?: unknown) =>
    ipcRenderer.invoke(channel, data) as Promise<T>,
  on: (channel: string, listener: (...args: any[]) => void) => {
    const wrapper = (_event: Electron.IpcRendererEvent, ...args: any[]): void => {
      listener(...args)
    }
    ipcRenderer.on(channel, wrapper)
    return () => {
      ipcRenderer.removeListener(channel, wrapper)
    }
  },
  removeAllListeners: (channel: string) => ipcRenderer.removeAllListeners(channel)
}
