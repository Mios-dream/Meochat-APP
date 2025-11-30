import type { MainWindowApi } from './modules/mainWindowApi'
import type { AssistantApi } from './modules/assistantApi'
import type { ConfigApi } from './modules/appConfig'
import type { ChatBoxApi } from './modules/chatBoxApi'

interface IpcRenderer {
  ipcRenderer: {
    /**
     * 发送消息到主进程
     * @param channel 通道名称
     * @param data 数据
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    send: (channel: string, data: any) => void

    /**
     * 调用主进程方法
     * @param channel 通道名称
     * @param data 数据
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    invoke: (channel: string, data?: any) => Promise<any>
    /**
     * 监听主进程消息
     * @param channel 通道名称
     * @param listener 监听器
     */
    on: (
      channel: string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      listener: (event: Electron.IpcRendererEvent, ...args: any[]) => void
    ) => void
    /**
     * 移除所有监听器
     * @param channel 通道名称
     */
    removeAllListeners: (channel: string) => void
  }
}

declare global {
  interface Window {
    api: MainWindowApi & AssistantApi & ConfigApi & ChatBoxApi & IpcRenderer
  }
}

export {}
