import { ipcMain, screen, BrowserWindow } from 'electron'
import { getChatBoxWindow, createChatBoxWindow } from '../windows/chatBoxWindow.js'
import { getAssistantWindow } from '../windows/assistantWindow.js'

export function setupChatBoxIPC() {
  ipcMain.on('chat-box:create', () => {
    createChatBoxWindow()
  })

  ipcMain.on('chat-box:close', () => {
    const chatBoxWin = getChatBoxWindow()
    if (chatBoxWin) chatBoxWin.close()
  })

  ipcMain.on('chat-box:hide', () => {
    const chatBoxWin = getChatBoxWindow()
    if (chatBoxWin) chatBoxWin.hide()
  })

  ipcMain.on('chat-box:show', () => {
    const chatBoxWin = getChatBoxWindow()
    if (chatBoxWin) chatBoxWin.show()
  })

  // 🐛 FIX: Add handler for temporary messages sent from ChatBox to Assistant
  ipcMain.on('show-assistant-message', (event, data) => {
    // Data is the object {text, timeout, priority}
    let assistantWindow = getAssistantWindow()
    if (assistantWindow && !assistantWindow.isDestroyed()) {
      console.log('发送消息到assistant window:', data)
      assistantWindow.webContents.send('show-assistant-message', data)
    }
  })
}
