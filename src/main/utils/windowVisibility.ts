/**
 * 窗口可见性检测
 *
 * 通过 koffi FFI 直接调用 Win32 API，检测桌宠窗口是否被其他窗口完全遮挡。
 * 核心原理：沿 Z-order 从上到下遍历桌宠上方的所有可见窗口，
 * 通过网格采样点判断桌宠窗口区域是否被完全覆盖。
 */

import { BrowserWindow } from 'electron'
import koffi from 'koffi'
import log from './logger'

interface VisibilityResult {
  visible: boolean
  reason?: 'cloaked' | 'occluded' | 'hidden' | 'minimized' | 'no_window'
}

/** DWM 常量：DWMWA_CLOAKED */
const DWMWA_CLOAKED = 14
/** GetWindow 命令常量：获取 Z-order 中的下一个窗口 */
const GW_HWNDNEXT = 2
/** 遮挡检测的网格采样密度（每边的点数），5×5 = 25 个采样点 */
const SAMPLE_GRID = 5

// koffi 绑定的 DLL 和函数引用（模块级延迟初始化）
let ffiInitialized = false
let user32: ReturnType<typeof koffi.load>
let dwmapi: ReturnType<typeof koffi.load>
let getWindowRectFn: (...args: unknown[]) => unknown
let getWindowFn: (...args: unknown[]) => bigint | null
let isWindowVisibleFn: (...args: unknown[]) => boolean
let dwmGetWindowAttribute: (...args: unknown[]) => unknown

/** RECT 结构体（Win32） */
const RECT = koffi.struct('RECT', {
  Left: 'long',
  Top: 'long',
  Right: 'long',
  Bottom: 'long'
})

/** 初始化 koffi FFI 绑定 */
function ensureFFI(): boolean {
  if (ffiInitialized) {
    return true
  }

  try {
    user32 = koffi.load('user32.dll')
    dwmapi = koffi.load('dwmapi.dll')

    // BOOL GetWindowRect(HWND hWnd, LPRECT lpRect)
    getWindowRectFn = user32.func('GetWindowRect', 'bool', ['void*', koffi.pointer(RECT)])

    // HWND GetWindow(HWND hWnd, UINT uCmd)
    getWindowFn = user32.func('GetWindow', 'void*', ['void*', 'uint'])

    // BOOL IsWindowVisible(HWND hWnd)
    isWindowVisibleFn = user32.func('IsWindowVisible', 'bool', ['void*'])

    // HRESULT DwmGetWindowAttribute(HWND hwnd, DWORD dwAttribute, PVOID pvAttribute, DWORD cbAttribute)
    dwmGetWindowAttribute = dwmapi.func('DwmGetWindowAttribute', 'int', [
      'void*',
      'int',
      koffi.pointer('int'),
      'int'
    ])

    ffiInitialized = true
    return true
  } catch (err) {
    log.warn('窗口可见性 FFI 初始化失败:', err)
    return false
  }
}

/** 判断点 (px, py) 是否在矩形内 */
function pointInRect(
  px: number,
  py: number,
  rect: { Left: number; Top: number; Right: number; Bottom: number }
): boolean {
  return px >= rect.Left && px < rect.Right && py >= rect.Top && py < rect.Bottom
}

/**
 * 检测桌宠窗口是否被其他窗口完全遮挡。
 *
 * 算法步骤：
 * 1. 使用 DwmGetWindowAttribute 检测 DWM cloaked 状态
 * 2. 获取窗口的屏幕坐标矩形
 * 3. 在窗口范围内生成 SAMPLE_GRID × SAMPLE_GRID 个均匀分布的采样点
 * 4. 沿 Z-order 从上到下遍历所有窗口，对每个在桌宠上方的可见窗口，
 *    检查其矩形区域覆盖了哪些采样点
 * 5. 若所有采样点均被覆盖，则判定为被完全遮挡
 */
async function checkAssistantWindowVisibility(
  assistantWin: BrowserWindow | null
): Promise<VisibilityResult> {
  if (!assistantWin || assistantWin.isDestroyed()) {
    return { visible: false, reason: 'no_window' }
  }

  if (assistantWin.isMinimized()) {
    return { visible: false, reason: 'minimized' }
  }

  if (!assistantWin.isVisible()) {
    return { visible: false, reason: 'hidden' }
  }

  if (process.platform !== 'win32') {
    return { visible: true }
  }

  if (!ensureFFI()) {
    return { visible: true }
  }

  try {
    const buf = assistantWin.getNativeWindowHandle()
    const hwnd = buf.readBigUInt64LE
      ? (buf.readBigUInt64LE(0) as bigint)
      : BigInt(buf.readUInt32LE(0))

    if (!hwnd) {
      return { visible: true }
    }

    // 通过 DWM 检测窗口是否被操作系统隐藏（cloaked）
    const cloaked = new Int32Array(1)
    dwmGetWindowAttribute(hwnd, DWMWA_CLOAKED, cloaked, 4)
    if (cloaked[0] !== 0) {
      return { visible: false, reason: 'cloaked' }
    }

    // 获取窗口在屏幕上的坐标矩形
    const ourRect = { Left: 0, Top: 0, Right: 0, Bottom: 0 }
    if (!getWindowRectFn(hwnd, ourRect)) {
      return { visible: true }
    }

    const width = ourRect.Right - ourRect.Left
    const height = ourRect.Bottom - ourRect.Top
    if (width <= 0 || height <= 0) {
      return { visible: false, reason: 'occluded' }
    }

    // 在窗口区域内生成网格采样点
    const points: Array<{ x: number; y: number }> = []
    for (let row = 0; row < SAMPLE_GRID; row++) {
      for (let col = 0; col < SAMPLE_GRID; col++) {
        points.push({
          x: ourRect.Left + Math.floor(((col + 0.5) * width) / SAMPLE_GRID),
          y: ourRect.Top + Math.floor(((row + 0.5) * height) / SAMPLE_GRID)
        })
      }
    }

    // 标记每个采样点是否被覆盖
    const covered = new Array<boolean>(points.length).fill(false)

    // 沿 Z-order 从上到下遍历窗口（GW_HWNDFIRST = 0 表示获取顶层窗口）
    let currentHwnd: bigint | null = getWindowFn(null, 0)

    while (currentHwnd && currentHwnd !== hwnd) {
      // 只检查可见的顶层窗口
      if (isWindowVisibleFn(currentHwnd)) {
        const otherRect = { Left: 0, Top: 0, Right: 0, Bottom: 0 }
        if (getWindowRectFn(currentHwnd, otherRect)) {
          for (let i = 0; i < points.length; i++) {
            if (!covered[i] && pointInRect(points[i].x, points[i].y, otherRect)) {
              covered[i] = true
            }
          }

          // 所有采样点已覆盖，提前终止遍历
          if (covered.every((c) => c)) {
            break
          }
        }
      }

      currentHwnd = getWindowFn(currentHwnd, GW_HWNDNEXT)
    }

    // 所有采样点均被覆盖 → 窗口被完全遮挡
    if (covered.every((c) => c === true)) {
      return { visible: false, reason: 'occluded' }
    }

    return { visible: true }
  } catch (e) {
    log.warn('窗口可见性检测失败，回退到基础检测:', e)
    return { visible: true }
  }
}

export { checkAssistantWindowVisibility }
export type { VisibilityResult }
