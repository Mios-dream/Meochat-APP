import type { MainWindowApi } from './modules/mainWindowApi'
import type { AssistantApi } from './modules/assistantApi'
import type { ConfigApi } from './modules/appConfig'
import type { ChatBoxApi } from './modules/chatBoxApi'

interface IpcRenderer {
  ipcRenderer: {
    send: (channel: string, data: any) => void
    invoke: (channel: string, data: any) => Promise<any>
    on: (
      channel: string,
      listener: (event: Electron.IpcRendererEvent, ...args: any[]) => void,
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
