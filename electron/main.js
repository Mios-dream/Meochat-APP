import { app, BrowserWindow } from 'electron'
import { createMainWindow } from './windows/mainWindow.js'
import { setupMainIPC } from './ipc/mainHandlers.js'
import { setupAssistantIPC } from './ipc/assistantHandlers.js'

// 初始化 IPC
setupMainIPC()
setupAssistantIPC()

function createWindow() {
  createMainWindow()
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
