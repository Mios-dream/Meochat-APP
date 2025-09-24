import { ipcMain, screen, BrowserWindow } from 'electron'
import { getAssistantWindow, createAssistantWindow } from '../windows/assistantWindow.js'

export function setupAssistantIPC() {
  ipcMain.on('assistant:create', () => {
    createAssistantWindow()
  })

  let draggingWindow = null
  let dragOffsetX = 0
  let dragOffsetY = 0

  // 监听拖拽开始
  ipcMain.on('assistant:start-drag', (event, { offsetX, offsetY }) => {
    draggingWindow = BrowserWindow.fromWebContents(event.sender)
    dragOffsetX = offsetX
    dragOffsetY = offsetY
  })

  // 监听拖拽中
  ipcMain.on('assistant:drag-window', (event, { screenX, screenY }) => {
    if (draggingWindow) {
      draggingWindow.setPosition(screenX - dragOffsetX, screenY - dragOffsetY)
    }
  })

  // 监听拖拽结束
  ipcMain.on('stop-drag', () => {
    draggingWindow = null
  })

  ipcMain.on('assistant:close', () => {
    const assistantWin = getAssistantWindow()
    if (assistantWin) assistantWin.close()
  })

  ipcMain.on('assistant:move', (event, { x, y }) => {
    const assistantWin = getAssistantWindow()
    if (assistantWin) {
      assistantWin.setPosition(x, y)
    }
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
}
