/**
 * 原生窗口拖拽工具
 *
 * 职责：为任意窗口提供与「标题栏拖拽」一致的原生窗口移动能力，
 * 供桌宠助手窗口、小组件窗口等无边框窗口复用。
 *
 * 实现说明：
 * - Windows / macOS：通过 electron-click-drag-plugin 向窗口发送原生拖拽消息
 *   （Windows 为 WM_NCLBUTTONDOWN + HTCAPTION），移动交给 DefWindowProc 的
 *   caption 拖拽循环，性能与系统标题栏一致，且保留 Aero Snap 吸附能力；
 * - Linux（含 WSL）：依赖 _NET_WM_MOVERESIZE 的窗口管理器交互式移动，
 *   但 WSLg 的 weston 等极简 XWM 并不支持该协议，因此改为主进程约 60Hz
 *   轮询光标 + setPosition 直接定位窗口，绕开对窗口管理器的依赖。
 *
 * 调用方通过 startWindowDrag 启动拖拽，结束时调用 stopWindowDrag 清理
 * （Linux 手动拖拽模式需要；Windows/macOS 下为无操作，调用无害）。
 */

import { BrowserWindow, screen } from 'electron'
import dragAddon from 'electron-click-drag-plugin'
import log from './logger'

// ── Linux 手动拖拽状态 ──
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
 * 以指定窗口为目标开始手动拖拽（Linux 专用）。
 *
 * 原理：记录按下瞬间的窗口位置与光标位置作为基准，然后以约 60Hz 轮询光标位置，
 * 通过 setPosition 将窗口跟随光标移动，完全绕开依赖窗口管理器的
 * _NET_WM_MOVERESIZE 交互式移动协议。当光标停止移动超过阈值时自动结束，
 * 作为 mouseup 事件丢失（如窗口未被聚焦）时的兜底。
 *
 * @param targetWin 待拖拽的目标窗口。
 */
function startManualDragForWindow(targetWin: BrowserWindow): void {
  if (!targetWin || targetWin.isDestroyed()) return
  stopManualDrag()

  const [winX, winY] = targetWin.getPosition()
  const cursor = screen.getCursorScreenPoint()
  dragOrigin = { winX, winY, cursorX: cursor.x, cursorY: cursor.y }
  lastDragCursorX = cursor.x
  lastDragCursorY = cursor.y
  lastDragMoveAt = Date.now()

  manualDragTimer = setInterval(() => {
    try {
      if (!dragOrigin || targetWin.isDestroyed()) {
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
      targetWin.setPosition(
        dragOrigin.winX + pos.x - dragOrigin.cursorX,
        dragOrigin.winY + pos.y - dragOrigin.cursorY
      )
    } catch (error) {
      log.error('手动拖拽窗口失败:', error)
      stopManualDrag()
    }
  }, 16)
}

/**
 * 启动指定窗口的原生拖拽。
 *
 * 根据平台选择实现：
 * - Linux：手动轮询光标 + setPosition；
 * - 其他：electron-click-drag-plugin 原生拖拽。
 *
 * @param targetWin 待拖拽的目标窗口（由调用方保证已从合法来源获取）。
 */
export function startWindowDrag(targetWin: BrowserWindow): void {
  if (!targetWin || targetWin.isDestroyed()) return
  try {
    if (process.platform === 'linux') {
      startManualDragForWindow(targetWin)
      return
    }
    dragAddon.startDrag(targetWin.getNativeWindowHandle())
  } catch (error) {
    log.error('启动窗口拖拽失败:', error)
  }
}

/**
 * 结束拖拽。
 *
 * 仅 Linux 手动拖拽模式需要（通知主进程停止轮询）；Windows/macOS 下
 * 原生拖拽由系统接管，此调用为无操作，调用无害。
 */
export function stopWindowDrag(): void {
  stopManualDrag()
}
