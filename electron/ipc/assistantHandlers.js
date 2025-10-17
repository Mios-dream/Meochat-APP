import { ipcMain, screen, BrowserWindow } from 'electron'
import { getAssistantWindow, createAssistantWindow } from '../windows/assistantWindow.js'
import { getChatBoxWindow } from '../windows/chatBoxWindow.js'
import dragAddon from 'electron-click-drag-plugin'
import robot from '@jitsi/robotjs'
import { uIOhook } from 'uiohook-napi'

let mouseTrackingInterval = null
let isMousePressed = false // 追踪鼠标按下状态
let isUiohookStarted = false // 追踪 uiohook 是否已启动

// 清理鼠标追踪的辅助函数
function cleanupMouseTracking() {
  if (mouseTrackingInterval) {
    clearInterval(mouseTrackingInterval)
    mouseTrackingInterval = null
  }
}

// 初始化 uiohook 监听器
function initUiohook() {
  if (isUiohookStarted) return

  // 监听鼠标按下事件
  uIOhook.on('mousedown', (e) => {
    isMousePressed = true
  })

  // 监听鼠标释放事件
  uIOhook.on('mouseup', (e) => {
    isMousePressed = false
  })
  uIOhook.start()
  isUiohookStarted = true
}

function setupChatBoxIPC() {
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

  ipcMain.on('show-assistant-message', (data) => {
    let assistantWindow = getAssistantWindow()
    if (assistantWindow && !assistantWindow.isDestroyed()) {
      assistantWindow.webContents.send('show-assistant-message', data)
    }
  })

  ipcMain.on('chat-box:send-message', (event, data) => {
    console.log('show-assistant-message', data)
    let assistantWindow = getAssistantWindow()
    if (assistantWindow && !assistantWindow.isDestroyed()) {
      assistantWindow.webContents.send('chat-box:send-message', data)
    }
  })

  ipcMain.on('loading-state-changed', (event, data) => {
    console.log('loading-state-changed', data)
    let chatBoxWindow = getChatBoxWindow()
    if (chatBoxWindow && !chatBoxWindow.isDestroyed()) {
      chatBoxWindow.webContents.send('loading-state-changed', data)
    }
  })
}

function setupAssistantIPC() {
  // 初始化 uiohook
  initUiohook()

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

  // 开始鼠标轨迹监控 - 使用 uiohook 检测鼠标按下状态
  ipcMain.on('assistant:start-mouse-tracking', () => {
    const assistantWin = getAssistantWindow()
    if (!assistantWin) return

    // 停止现有的监控(如果有的话)
    if (mouseTrackingInterval) {
      cleanupMouseTracking()
    }

    // 每100ms检查鼠标状态
    mouseTrackingInterval = setInterval(() => {
      try {
        const mousePos = robot.getMousePos()
        const windowBounds = assistantWin.getBounds()

        assistantWin.webContents.send('assistant:mouse-position', {
          screenX: mousePos.x,
          screenY: mousePos.y,
          windowX: windowBounds.x,
          windowY: windowBounds.y,
          windowWidth: windowBounds.width,
          windowHeight: windowBounds.height,
          isMouseDown: isMousePressed, // 使用 uiohook 追踪的状态
        })
      } catch (error) {
        console.error('Error getting mouse position:', error)
        cleanupMouseTracking()
      }
    }, 100)
  })

  // 停止鼠标轨迹监控
  ipcMain.on('assistant:stop-mouse-tracking', () => {
    if (mouseTrackingInterval) {
      cleanupMouseTracking()
    }
  })

  ipcMain.on('assistant:set-ignore-mouse', (event, ignore) => {
    const assistantWin = getAssistantWindow()
    assistantWin.setIgnoreMouseEvents(ignore, { forward: true })
  })
}

function setupAssistantTogetherIPC() {
  setupAssistantIPC()
  setupChatBoxIPC()
}

export { setupAssistantTogetherIPC }
