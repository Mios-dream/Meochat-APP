import { ipcMain, screen, BrowserWindow } from 'electron'
import { getAssistantWindow, createAssistantWindow } from '../windows/assistantWindow.js'

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

  // 新增：获取助手当前状态
  ipcMain.handle('assistant:get-status', async () => {
    const assistantWin = getAssistantWindow()
    return !!assistantWin
  })
}
