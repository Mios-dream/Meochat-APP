import { ipcMain, screen } from 'electron'
import { getAssistantWindow, createAssistantWindow } from '../windows/assistantWindow.js'
import dragAddon from 'electron-click-drag-plugin'

export function setupAssistantIPC() {
  ipcMain.on('assistant:create', () => {
    createAssistantWindow()
  })

  ipcMain.on('assistant:close', () => {
    const assistantWin = getAssistantWindow()
    if (assistantWin) assistantWin.close()
  })

  ipcMain.on('assistant:hide', () => {
    const assistantWin = getAssistantWindow()
    if (assistantWin) assistantWin.hide()
  })

  ipcMain.on('assistant:show', () => {
    const assistantWin = getAssistantWindow()
    if (assistantWin) assistantWin.show()
  })

  ipcMain.handle('assistant:get-screen-size', async () => {
    const primaryDisplay = screen.getPrimaryDisplay()
    return {
      width: primaryDisplay.workAreaSize.width,
      height: primaryDisplay.workAreaSize.height,
    }
  })

  // 获取助手当前状态
  ipcMain.handle('assistant:get-status', async () => {
    const assistantWin = getAssistantWindow()
    return !!assistantWin
  })

  ipcMain.on('assistant:start-drag', () => {
    try {
      const assistantWin = getAssistantWindow()
      const hwndBuffer = assistantWin.getNativeWindowHandle()
      // Linux: extract X11 Window ID from the buffer (first 4 bytes, little-endian)
      // macOS/Windows: pass Buffer directly
      const windowId = process.platform === 'linux' ? hwndBuffer.readUInt32LE(0) : hwndBuffer
      dragAddon.startDrag(windowId)
    } catch (error) {
      console.error(error)
    }
  })
}
