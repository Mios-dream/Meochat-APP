import type { MainWindowApi } from './modules/mainWindowApi'
import type { AssistantApi } from './modules/assistantApi'
import type { ConfigApi } from './modules/appConfig'
import type { ChatBoxApi } from './modules/chatBoxApi'

interface IpcRenderer {
  ipcRenderer: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    send: (channel: string, data: any) => void
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    invoke: (channel: string, data: any) => Promise<any>
    on: (
      channel: string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      listener: (event: Electron.IpcRendererEvent, ...args: any[]) => void
    ) => void
    removeAllListeners: (channel: string) => void
  }
}

declare global {
  interface Window {
    api: MainWindowApi & AssistantApi & ConfigApi & ChatBoxApi & IpcRenderer
  }
}

export {}
