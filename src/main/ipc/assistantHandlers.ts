import { ipcMain, screen, BrowserWindow, app } from 'electron'
import {
  windowRegistry,
  createWindow,
  assistantWindowConfig,
  chatBoxWindowConfig,
  tipsWindowConfig
} from '../windows'
import { checkAssistantWindowVisibility } from '../utils/windowVisibility'
import dragAddon from 'electron-click-drag-plugin'
import robot from '@jitsi/robotjs'
import { uIOhook } from 'uiohook-napi'

import log from '../utils/logger'

let mouseTrackingInterval: NodeJS.Timeout | null = null
let isMousePressed = false // 追踪鼠标按下状态
let isUiohookStarted = false // 追踪 uiohook 是否已启动
// 用于追踪鼠标位置和活动状态
let lastMouseX: number | null = null
let lastMouseY: number | null = null
// 最后一次鼠标移动的时间戳
let lastMouseMoveAt = Date.now()
// 最后一次发送鼠标活动事件的时间戳，用于节流
let lastMouseActivityEmitAt = 0

// 清理鼠标追踪的辅助函数
function cleanupMouseTracking(): void {
  if (mouseTrackingInterval) {
    clearInterval(mouseTrackingInterval)
    mouseTrackingInterval = null
  }
}

// 初始化 uiohook 监听器
function initUiohook(): void {
  if (isUiohookStarted) return

  // 监听鼠标按下事件
  uIOhook.on('mousedown', () => {
    isMousePressed = true
  })

  // 监听鼠标释放事件
  uIOhook.on('mouseup', () => {
    isMousePressed = false
  })
  uIOhook.start()
  isUiohookStarted = true

  app.on('will-quit', () => {
    if (isUiohookStarted) {
      uIOhook.stop()
      uIOhook.removeAllListeners()
      isUiohookStarted = false
      isMousePressed = false
    }
  })
}

function setupChatBoxIPC(): void {
  ipcMain.on('chat-box:create', () => {
    const primaryDisplay = screen.getPrimaryDisplay()
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize

    // 计算窗口尺寸和位置
    const windowWidth = Math.floor(screenWidth / 2)
    const windowHeight = 200
    const x = Math.floor((screenWidth - windowWidth) / 2)
    // 距离底部抬升
    const targetY = screenHeight - 200 // 目标位置

    createWindow(chatBoxWindowConfig, {
      overrides: {
        x: x,
        y: targetY,
        width: windowWidth,
        height: windowHeight
      },
      showImmediately: true
    })
  })

  ipcMain.on('chat-box:close', () => {
    const chatBoxWin = windowRegistry.getWindowByType('chatBox')
    if (chatBoxWin) chatBoxWin.close()
  })

  ipcMain.on('chat-box:hide', () => {
    const chatBoxWin = windowRegistry.getWindowByType('chatBox')
    if (chatBoxWin) chatBoxWin.hide()
  })

  ipcMain.on('chat-box:show', () => {
    const chatBoxWin = windowRegistry.getWindowByType('chatBox')
    if (chatBoxWin) chatBoxWin.show()
  })

  ipcMain.on('chat-box:send-message', (_event, data) => {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('chat-box:send-message', data)
    })
  })

  ipcMain.on('chat-box:cancel-message', () => {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('chat-box:cancel-message')
    })
  })

  ipcMain.on('chat-box:update-status', (_event, data) => {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('chat-box:status-updated', data)
    })
  })

  ipcMain.on('chat-box:wakeword-detected', (_event, data) => {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('chat-box:wakeword-detected', data)
    })
  })
}

function setupAssistantIPC(): void {
  // 初始化 uiohook
  initUiohook()

  ipcMain.on('assistant:create', () => {
    createWindow(assistantWindowConfig, { showImmediately: true })
  })

  ipcMain.on('assistant:close', () => {
    const assistantWin = windowRegistry.getWindowByType('assistant')
    if (assistantWin) assistantWin.close()
  })

  ipcMain.on('assistant:hide', () => {
    const assistantWin = windowRegistry.getWindowByType('assistant')
    if (assistantWin) assistantWin.hide()
  })

  ipcMain.on('assistant:show', () => {
    const assistantWin = windowRegistry.getWindowByType('assistant')
    if (assistantWin) assistantWin.show()
  })

  ipcMain.handle('assistant:get-screen-size', async () => {
    const primaryDisplay = screen.getPrimaryDisplay()
    return {
      width: primaryDisplay.workAreaSize.width,
      height: primaryDisplay.workAreaSize.height
    }
  })

  // 获取助手当前状态
  ipcMain.handle('assistant:get-status', async () => {
    const assistantWin = windowRegistry.getWindowByType('assistant')
    return !!assistantWin
  })

  ipcMain.on('assistant:start-drag', () => {
    try {
      const assistantWin = windowRegistry.getWindowByType('assistant')
      if (!assistantWin) return
      const hwndBuffer = assistantWin.getNativeWindowHandle()
      // Linux: extract X11 Window ID from the buffer (first 4 bytes, little-endian)
      // macOS/Windows: pass Buffer directly
      const windowId = process.platform === 'linux' ? hwndBuffer.readUInt32LE(0) : hwndBuffer
      dragAddon.startDrag(windowId)
    } catch (error) {
      log.error(error)
    }
  })

  // 开始鼠标轨迹监控 - 使用 uiohook 检测鼠标按下状态
  ipcMain.on('assistant:start-mouse-tracking', () => {
    const assistantWin = windowRegistry.getWindowByType('assistant')
    if (!assistantWin) return

    // 停止现有的监控(如果有的话)
    if (mouseTrackingInterval) {
      cleanupMouseTracking()
    }

    const initialPosition = robot.getMousePos()
    lastMouseX = initialPosition.x
    lastMouseY = initialPosition.y
    lastMouseMoveAt = Date.now()
    lastMouseActivityEmitAt = 0

    // 每100ms检查鼠标状态
    mouseTrackingInterval = setInterval(() => {
      if (assistantWin.isDestroyed()) {
        cleanupMouseTracking()
      } else {
        const mousePos = robot.getMousePos()
        const now = Date.now()
        const idleThresholdMs = 5 * 60 * 1000
        const moved = mousePos.x !== lastMouseX || mousePos.y !== lastMouseY

        if (moved) {
          const idleDurationMs = now - lastMouseMoveAt
          if (idleDurationMs >= idleThresholdMs) {
            BrowserWindow.getAllWindows().forEach((win) => {
              win.webContents.send('assistantEvent:mouse-resumed', {
                idleDurationMs,
                timestamp: now
              })
            })
          }

          lastMouseMoveAt = now
          lastMouseX = mousePos.x
          lastMouseY = mousePos.y
        }

        if (now - lastMouseActivityEmitAt >= 1000) {
          const idleDurationMs = now - lastMouseMoveAt
          const payload = {
            idleDurationMs,
            isIdle: idleDurationMs >= idleThresholdMs,
            timestamp: now
          }

          BrowserWindow.getAllWindows().forEach((win) => {
            win.webContents.send('assistantEvent:mouse-activity', payload)
          })

          lastMouseActivityEmitAt = now
        }

        const windowBounds = assistantWin.getBounds()

        assistantWin.webContents.send('assistant:mouse-position', {
          screenX: mousePos.x,
          screenY: mousePos.y,
          windowX: windowBounds.x,
          windowY: windowBounds.y,
          windowWidth: windowBounds.width,
          windowHeight: windowBounds.height,
          isMouseDown: isMousePressed // 使用 uiohook 追踪的状态
        })
      }
    }, 200)
  })

  // 停止鼠标轨迹监控
  ipcMain.on('assistant:stop-mouse-tracking', () => {
    if (mouseTrackingInterval) {
      cleanupMouseTracking()
    }
  })

  ipcMain.on('assistant:set-ignore-mouse', (_event, ignore) => {
    const assistantWin = windowRegistry.getWindowByType('assistant')
    assistantWin?.setIgnoreMouseEvents(ignore, { forward: true })
  })

  // Tips窗口相关IPC
  ipcMain.on('tips:show-message', async (_event, data: { message: string; avatarUrl?: string }) => {
    const tipsWin = windowRegistry.getWindowByType('tips')
    if (tipsWin && !tipsWin.isDestroyed()) {
      tipsWin.show()
      tipsWin.webContents.send('tips:show', data)
    } else {
      const primaryDisplay = screen.getPrimaryDisplay()
      const { width: screenWidth } = primaryDisplay.workArea

      const windowWidth = 380
      const windowHeight = 130
      const x = screenWidth - windowWidth - 20
      const y = 20
      createWindow(tipsWindowConfig, {
        overrides: { x, y, width: windowWidth, height: windowHeight },
        showImmediately: true
      }).then((win) => {
        win.webContents.send('tips:show', data)
      })
    }
  })

  ipcMain.on('tips:update-message', (_event, data: { message: string; avatarUrl?: string }) => {
    const tipsWin = windowRegistry.getWindowByType('tips')
    if (tipsWin && !tipsWin.isDestroyed()) {
      tipsWin.webContents.send('tips:message', data)
    }
  })

  ipcMain.on('tips:hide-message', () => {
    const tipsWin = windowRegistry.getWindowByType('tips')
    if (tipsWin && !tipsWin.isDestroyed()) {
      tipsWin.webContents.send('tips:hide')
      setTimeout(() => {
        if (tipsWin && !tipsWin.isDestroyed()) {
          tipsWin.hide()
        }
      }, 400)
    }
  })

  ipcMain.handle('assistant:check-visible', async () => {
    const assistantWin = windowRegistry.getWindowByType('assistant')
    const result = await checkAssistantWindowVisibility(assistantWin)
    console.log('检查助手窗口可见性:', result)
    return result.visible
  })
}

function setupAssistantTogetherIPC(): void {
  setupAssistantIPC()
  setupChatBoxIPC()
}

export { setupAssistantTogetherIPC }
