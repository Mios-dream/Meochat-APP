import { screen, BrowserWindow, app } from 'electron'
import { randomUUID } from 'crypto'
import { CHANNELS } from '@shared/ipc/channels'
import { registerHandle, registerOn } from '../utils/registerIpcHandler'
import {
  windowRegistry,
  createWindow,
  assistantWindowConfig,
  chatBoxWindowConfig,
  tipsWindowConfig
} from '../windows'
import { chatHistoryStore } from '../services/chatHistoryStore'
import type { ChatMessage } from '@shared/types/chat'
import type { ChatInvokeResult } from '@shared/ipc/api/base/chat'

/** 待处理的聊天调用请求，requestId → 回调 */
const pendingChatInvokes = new Map<
  string,
  { resolve: (value: ChatInvokeResult) => void; reject: (reason: unknown) => void }
>()
import { checkAssistantWindowVisibility } from '../utils/windowVisibility'
import dragAddon from 'electron-click-drag-plugin'
import robot from '@jitsi/robotjs'
import { uIOhook } from 'uiohook-napi'
import log from '../utils/logger'
import { AssistantService } from '../services/assistantService'

/** 广播聊天历史变更通知到所有窗口 */
function broadcastHistoryChanged(): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send(CHANNELS.CHAT_HISTORY_CHANGED_EVENT)
    }
  })
}

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
  // 切换聊天框窗口置顶状态
  registerHandle(CHANNELS.CHATBOX_TOGGLE_PIN, () => {
    const chatBoxWin = windowRegistry.getWindowByType('chatBox')
    if (chatBoxWin && !chatBoxWin.isDestroyed()) {
      const pinned = !chatBoxWin.isAlwaysOnTop()
      chatBoxWin.setAlwaysOnTop(pinned, 'screen-saver')
      return { success: true, pinned }
    }
    return { success: false }
  })

  // 获取聊天框窗口当前置顶状态
  registerHandle(CHANNELS.CHATBOX_GET_PIN_STATUS, () => {
    const chatBoxWin = windowRegistry.getWindowByType('chatBox')
    if (chatBoxWin && !chatBoxWin.isDestroyed()) {
      return { success: true, pinned: chatBoxWin.isAlwaysOnTop() }
    }
    return { success: false }
  })

  registerOn(CHANNELS.CHATBOX_CREATE, () => {
    createWindow(chatBoxWindowConfig)
  })

  registerOn(CHANNELS.CHATBOX_CLOSE, () => {
    const chatBoxWin = windowRegistry.getWindowByType('chatBox')
    if (chatBoxWin) chatBoxWin.close()
  })

  registerOn(CHANNELS.CHATBOX_HIDE, () => {
    const chatBoxWin = windowRegistry.getWindowByType('chatBox')
    if (chatBoxWin) chatBoxWin.hide()
  })

  registerOn(CHANNELS.CHATBOX_SHOW, () => {
    const chatBoxWin = windowRegistry.getWindowByType('chatBox')
    if (chatBoxWin) chatBoxWin.show()
  })

  // ─── 聊天调用：ChatBoxView → Main(handle) → AssistantWindow/MainWindow → Main → 返回结果 ───
  registerHandle(
    CHANNELS.CHAT_INVOKE,
    async (_event, data: { text: string; attachments?: { name: string; path: string }[] }) => {
      // 优先转发到桌宠助手窗口
      const assistantWin = windowRegistry.getWindowByType('assistant')
      // 桌宠未开启时，降级到主窗口（助手空间）
      const targetWin = assistantWin ?? windowRegistry.getWindowByType('main')
      if (!targetWin) throw new Error('No available window to handle chat')

      const requestId = randomUUID()

      return new Promise<ChatInvokeResult>((resolve, reject) => {
        pendingChatInvokes.set(requestId, { resolve, reject })

        targetWin.webContents.send(CHANNELS.CHAT_INVOKE_REQUEST_EVENT, {
          requestId,
          text: data.text,
          attachments: data.attachments
        })

        setTimeout(() => {
          if (pendingChatInvokes.has(requestId)) {
            pendingChatInvokes.delete(requestId)
            reject(new Error('Chat invoke timeout'))
          }
        }, 120000)
      })
    }
  )

  // 接收助理窗口的聊天调用结果
  registerOn(CHANNELS.CHAT_INVOKE_RESULT, (_event, data) => {
    const pending = pendingChatInvokes.get(data.requestId)
    if (pending) {
      pendingChatInvokes.delete(data.requestId)
      if (data.success) {
        pending.resolve({ success: true, history: data.history, reply: data.reply })
      } else {
        pending.reject(new Error(data.error || 'Chat invoke failed'))
      }
    }
  })

  registerOn(CHANNELS.CANCEL_MESSAGE, () => {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send(CHANNELS.CHATBOX_CANCEL_MESSAGE_EVENT)
    })
  })

  registerOn(CHANNELS.WAKEWORD_DETECTED, (_event, data) => {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send(CHANNELS.CHATBOX_WAKEWORD_DETECTED_EVENT, data)
    })
  })

  // 获取聊天历史：直接从主进程存储返回
  registerHandle(CHANNELS.GET_HISTORY, async () => {
    const result = chatHistoryStore.get()
    if (!result.success) throw new Error(result.error)
    return result.data
  })

  // 追加一条消息到历史
  registerHandle(CHANNELS.APPEND_MESSAGE, async (_event, message: ChatMessage) => {
    const currentAssistant = AssistantService.getInstance().getCurrentAssistant()
    if (!currentAssistant) {
      console.error('当前没有选中助手，无法追加消息到历史')
      return { success: false, error: '当前没有选中助手' }
    }
    const result = chatHistoryStore.push(currentAssistant.name, message)
    if (!result.success) throw new Error(result.error)
    broadcastHistoryChanged()
    return result.data
  })

  // 删除最后一条消息（发送失败回滚）
  registerHandle(CHANNELS.POP_HISTORY, async () => {
    const result = chatHistoryStore.popLast()
    if (!result.success) throw new Error(result.error)
    broadcastHistoryChanged()
    return result.data
  })

  // 替换全部历史（远端同步后覆盖）
  registerHandle(CHANNELS.REPLACE_HISTORY, async (_event, messages: ChatMessage[]) => {
    const result = chatHistoryStore.replace(undefined, messages)
    if (!result.success) throw new Error(result.error)
    broadcastHistoryChanged()
    return result.data
  })

  // 清空聊天历史：同步清空主进程存储并广播到所有窗口
  registerHandle(CHANNELS.CLEAR_HISTORY, async () => {
    const result = chatHistoryStore.clear()
    if (!result.success) throw new Error(result.error)
    broadcastHistoryChanged()
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send(CHANNELS.CLEAR_HISTORY)
      }
    })
    return []
  })
}

function setupAssistantIPC(): void {
  // 初始化 uiohook
  initUiohook()

  registerOn(CHANNELS.ASSISTANT_CREATE, () => {
    createWindow(assistantWindowConfig, { showImmediately: true })
  })

  registerOn(CHANNELS.ASSISTANT_CLOSE, () => {
    const assistantWin = windowRegistry.getWindowByType('assistant')
    if (assistantWin) assistantWin.close()
  })

  registerOn(CHANNELS.ASSISTANT_HIDE, () => {
    const assistantWin = windowRegistry.getWindowByType('assistant')
    if (assistantWin) assistantWin.hide()
  })

  registerOn(CHANNELS.ASSISTANT_SHOW, () => {
    const assistantWin = windowRegistry.getWindowByType('assistant')
    if (assistantWin) assistantWin.show()
  })

  registerHandle(CHANNELS.ASSISTANT_GET_SCREEN_SIZE, async () => {
    const primaryDisplay = screen.getPrimaryDisplay()
    return {
      width: primaryDisplay.workAreaSize.width,
      height: primaryDisplay.workAreaSize.height
    }
  })

  // 获取助手当前状态
  registerHandle(CHANNELS.ASSISTANT_GET_STATUS, async () => {
    const assistantWin = windowRegistry.getWindowByType('assistant')
    return !!assistantWin
  })

  registerOn(CHANNELS.ASSISTANT_START_DRAG, () => {
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
  registerOn(CHANNELS.ASSISTANT_START_MOUSE_TRACKING, () => {
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
              win.webContents.send(CHANNELS.ASSISTANT_EVENT_MOUSE_RESUMED, {
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
            win.webContents.send(CHANNELS.ASSISTANT_EVENT_MOUSE_ACTIVITY, payload)
          })

          lastMouseActivityEmitAt = now
        }

        const windowBounds = assistantWin.getBounds()

        assistantWin.webContents.send(CHANNELS.ASSISTANT_MOUSE_POSITION_EVENT, {
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
  registerOn(CHANNELS.ASSISTANT_STOP_MOUSE_TRACKING, () => {
    if (mouseTrackingInterval) {
      cleanupMouseTracking()
    }
  })

  registerOn(CHANNELS.ASSISTANT_SET_IGNORE_MOUSE, (_event, ignore) => {
    const assistantWin = windowRegistry.getWindowByType('assistant')
    assistantWin?.setIgnoreMouseEvents(ignore, { forward: true })
  })

  // Tips窗口相关IPC
  registerOn(CHANNELS.TIPS_SHOW, async (_event, data: { message: string; avatarUrl?: string }) => {
    // 有新消息，取消延迟销毁
    if (tipsDestroyTimer) {
      clearTimeout(tipsDestroyTimer)
      tipsDestroyTimer = null
    }

    const tipsWin = windowRegistry.getWindowByType('tips')
    if (tipsWin && !tipsWin.isDestroyed()) {
      tipsWin.show()
      tipsWin.webContents.send(CHANNELS.TIPS_SHOW_EVENT, data)
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
        win.webContents.send(CHANNELS.TIPS_SHOW_EVENT, data)
      })
    }
  })

  registerOn(CHANNELS.TIPS_UPDATE, (_event, data: { message: string; avatarUrl?: string }) => {
    const tipsWin = windowRegistry.getWindowByType('tips')
    if (tipsWin && !tipsWin.isDestroyed()) {
      tipsWin.webContents.send(CHANNELS.TIPS_MESSAGE_EVENT, data)
    }
  })

  // 延迟销毁定时器：tips 窗口隐藏一段时间后才销毁，避免频繁创建销毁
  let tipsDestroyTimer: ReturnType<typeof setTimeout> | null = null

  registerOn(CHANNELS.TIPS_HIDE, () => {
    const tipsWin = windowRegistry.getWindowByType('tips')
    if (tipsWin && !tipsWin.isDestroyed()) {
      tipsWin.webContents.send(CHANNELS.TIPS_HIDE_EVENT)
      // 先隐藏，5 分钟无新消息再彻底销毁
      tipsWin.hide()
      if (tipsDestroyTimer) clearTimeout(tipsDestroyTimer)
      tipsDestroyTimer = setTimeout(() => {
        if (tipsWin && !tipsWin.isDestroyed()) {
          tipsWin.close()
        }
        tipsDestroyTimer = null
      }, 5 * 60 * 1000)
    }
  })

  registerHandle(CHANNELS.ASSISTANT_CHECK_VISIBLE, async () => {
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
