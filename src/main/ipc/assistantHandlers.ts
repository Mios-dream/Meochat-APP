import { screen, BrowserWindow, app } from 'electron'
import { randomUUID } from 'crypto'
import { CHANNELS } from '@shared/ipc/channels'
import { registerHandle, registerOn } from '../utils/registerIpcHandler'
import {
  windowRegistry,
  createWindow,
  assistantWindowConfig,
  chatBoxWindowConfig
} from '../windows'
import { TipsService } from '../services/tipsService'
import type { TipsMessagePayload } from '../services/tipsService'
import { chatHistoryStore } from '../services/chatHistoryStore'
import { WsService } from '../services/wsService'
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
import log from '@main/utils/logger'
import { AssistantService } from '@main/services/assistant/assistantService'

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

// 手动拖拽（Linux/WSL）状态：
// 背景：electron-click-drag-plugin 依赖 _NET_WM_MOVERESIZE，由窗口管理器执行交互式移动，
// 但 WSLg 的 weston 等极简 XWM 并不支持该协议，导致拖拽失效；
// 因此在 Linux 上改为主进程轮询光标 + setPosition 直接定位窗口，绕开窗口管理器。
let manualDragTimer: ReturnType<typeof setInterval> | null = null
// 手动拖拽起始基准：窗口坐标与光标坐标（均为主进程 DIP 坐标）
let dragOrigin: { winX: number; winY: number; cursorX: number; cursorY: number } | null = null
// 最近一次光标移动时间戳，用于 mouseup 事件丢失时的自动结束兜底
let lastDragMoveAt = 0
// 上一次轮询到的光标位置，用于判断光标是否仍在移动
let lastDragCursorX = 0
let lastDragCursorY = 0

/**
 * 停止手动拖拽，清理轮询定时器与基准数据。
 */
function stopManualDrag(): void {
  if (manualDragTimer) {
    clearInterval(manualDragTimer)
    manualDragTimer = null
  }
  dragOrigin = null
}

/**
 * 开始手动拖拽（仅 Linux 使用）。
 *
 * 原理：记录按下瞬间的窗口位置与光标位置作为基准，然后以约 60Hz 轮询光标位置，
 * 通过 setPosition 将窗口跟随光标移动，完全绕开依赖窗口管理器的
 * _NET_WM_MOVERESIZE 交互式移动协议。当光标停止移动超过阈值时自动结束，
 * 作为 mouseup 事件丢失（如窗口未被聚焦）时的兜底。
 */
function startManualDrag(): void {
  const assistantWin = windowRegistry.getWindowByType('assistant')
  if (!assistantWin || assistantWin.isDestroyed()) return
  stopManualDrag()

  const [winX, winY] = assistantWin.getPosition()
  const cursor = screen.getCursorScreenPoint()
  dragOrigin = { winX, winY, cursorX: cursor.x, cursorY: cursor.y }
  lastDragCursorX = cursor.x
  lastDragCursorY = cursor.y
  lastDragMoveAt = Date.now()

  manualDragTimer = setInterval(() => {
    try {
      if (!dragOrigin || assistantWin.isDestroyed()) {
        stopManualDrag()
        return
      }
      const pos = screen.getCursorScreenPoint()
      const moved = pos.x !== lastDragCursorX || pos.y !== lastDragCursorY
      lastDragCursorX = pos.x
      lastDragCursorY = pos.y
      if (!moved) {
        // 光标静止超过阈值视为拖拽结束
        if (Date.now() - lastDragMoveAt > 250) {
          stopManualDrag()
        }
        return
      }
      lastDragMoveAt = Date.now()
      assistantWin.setPosition(
        dragOrigin.winX + pos.x - dragOrigin.cursorX,
        dragOrigin.winY + pos.y - dragOrigin.cursorY
      )
    } catch (error) {
      log.error('手动拖拽助手窗口失败:', error)
      stopManualDrag()
    }
  }, 16)
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
    const result = await chatHistoryStore.get()
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
    const result = await chatHistoryStore.push(currentAssistant.name, message)
    if (!result.success) throw new Error(result.error)
    broadcastHistoryChanged()
    return result.data
  })

  // 删除最后一条消息（发送失败回滚）
  registerHandle(CHANNELS.POP_HISTORY, async () => {
    const result = await chatHistoryStore.popLast()
    if (!result.success) throw new Error(result.error)
    broadcastHistoryChanged()
    return result.data
  })

  // 替换全部历史（远端同步后覆盖）
  registerHandle(CHANNELS.REPLACE_HISTORY, async (_event, messages: ChatMessage[]) => {
    const result = await chatHistoryStore.replace(undefined, messages)
    if (!result.success) throw new Error(result.error)
    broadcastHistoryChanged()
    return result.data
  })

  // 清空聊天历史：同步清空本地存储 + 云端记录（通过 WS 通知服务端）
  registerHandle(CHANNELS.CLEAR_HISTORY, async () => {
    // 发送 WS chat:clear 请求服务端清空云端记录
    WsService.getInstance().send({ type: 'chat:clear' })
    // 同步清空本地存储
    const result = await chatHistoryStore.clear()
    if (!result.success) throw new Error(result.error)
    broadcastHistoryChanged()
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send(CHANNELS.CHAT_HISTORY_CLEARED_EVENT)
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
      // Linux（含 WSL）走主进程手动拖拽：绕开对窗口管理器的依赖，
      // 规避 WSLg weston 等极简 XWM 不支持 _NET_WM_MOVERESIZE 的问题
      if (process.platform === 'linux') {
        startManualDrag()
        return
      }
      const assistantWin = windowRegistry.getWindowByType('assistant')
      if (!assistantWin) return
      dragAddon.startDrag(assistantWin.getNativeWindowHandle())
    } catch (error) {
      log.error(error)
    }
  })

  // 结束手动拖拽（Linux 渲染进程在 mouseup 时通知主进程停止轮询）
  registerOn(CHANNELS.ASSISTANT_DRAG_END, () => {
    stopManualDrag()
  })

  // 获取鼠标全局屏幕坐标（DIP），供渲染进程在穿透自检等无窗口鼠标事件的场景使用
  registerHandle(CHANNELS.ASSISTANT_GET_CURSOR_SCREEN_POINT, () => {
    return screen.getCursorScreenPoint()
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

  // Tips窗口相关IPC：窗口生命周期逻辑统一由 TipsService 管理
  const tipsService = TipsService.getInstance()

  registerOn(CHANNELS.TIPS_SHOW, (_event, data: TipsMessagePayload) => {
    tipsService.show(data)
  })

  registerOn(CHANNELS.TIPS_UPDATE, (_event, data: TipsMessagePayload) => {
    tipsService.update(data)
  })

  registerOn(CHANNELS.TIPS_HIDE, () => {
    tipsService.hide()
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
