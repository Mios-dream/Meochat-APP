/// <reference types="vite/client" />
export {}

declare global {
  interface Window {
    api: {
      // 助手窗口
      openAssistant: () => void
      closeAssistant: () => void
      hideAssistant: () => void
      startDrag: () => void
      setIgnoreMouse: (ignore: boolean) => void

      // 聊天窗口
      openChatBox: () => void
      closeChatBox: () => void
      hideChatBox: () => void
      showChatBox: () => void

      // 主窗口
      minimizeApp: () => void
      maximizeApp: () => void
      quitApp: () => void
      //获取助手开关状态
      getAssistantStatus: () => Promise<boolean>

      ipcRenderer: {
        send: (channel: string, data: any) => void
        invoke: (channel: string, data: any) => Promise<any>
        on: (channel: string, listener: (event: any, ...args: any[]) => void) => void
        removeAllListeners: (channel: string) => void
      }
    }
  }
}
