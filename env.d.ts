/// <reference types="vite/client" />
export {}

declare global {
  interface Window {
    assistantAPI: {
      openAssistant: () => void
      closeAssistant: () => void
      hideAssistant: () => void
      startDrag: () => void
      setIgnoreMouse: (ignore: boolean) => void
      ipcRenderer: {
        invoke: (channel: string, data: any) => Promise<any>
        send: (channel: string, data: any) => void
        on: (channel: string, callback: (event, data) => void) => void
      }
    }
    chatBoxAPI: {
      openChatBox: () => void
      closeChatBox: () => void
      hideChatBox: () => void
      showChatBox: () => void
      ipcRenderer: {
        send: (channel: string, data: any) => void
        invoke: (channel: string, data: any) => Promise<any>
        on: (channel: string, callback: (data: any) => void) => void
      }
    }

    electronAPI: {
      minimizeApp: () => void
      maximizeApp: () => void
      quitApp: () => void
      openAssistant: () => void
      closeAssistant: () => void
      //获取助手开关状态
      getAssistantStatus: () => Promise<boolean>
    }
  }
}
