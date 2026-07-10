/**
 * 窗口毛玻璃效果工具
 *
 * 根据 Windows 版本选择最佳实现：
 * - Win11 22H2+（build 22621+）：Electron 内置 setBackgroundMaterial('acrylic')
 * - Win10 1803+（build 17134+）：Win32 API SetWindowCompositionAttribute（koffi FFI）
 * - 其他平台：仅 CSS backdrop-filter 降级
 */

import { BrowserWindow } from 'electron'
import * as os from 'os'
import log from './logger'
import koffi from 'koffi'

/** 将 os.release() 中的 build 号解析为整数，如 "10.0.22621" → 22621 */
function parseBuildNumber(): number {
  try {
    return parseInt(os.release().split('.').pop() ?? '0', 10)
  } catch {
    return 0
  }
}

/**
 * 为窗口启用毛玻璃效果
 * 应在窗口创建后、首次显示前调用
 */
export function enableAcrylic(win: BrowserWindow): void {
  const platform = os.platform()
  if (platform !== 'win32') return

  const build = parseBuildNumber()

  // Win11 22H2+（build 22621+）：原生 Acrylic
  if (build >= 22621) {
    try {
      win.setBackgroundMaterial('acrylic')
      log.info('[acrylic] 原生 Acrylic 已启用 (Win11 22H2+)')
      return
    } catch (err) {
      log.warn('[acrylic] setBackgroundMaterial 失败，尝试 Win32 API 降级', err)
    }
  }

  // Win10 1803+（build 17134+）：Win32 API BlurBehind + CSS 着色
  if (build >= 17134) {
    try {
      enableWin10Blur(win)
      log.info('[acrylic] Win32 BlurBehind 已启用 (Win10 1803+)')
    } catch (err) {
      log.warn('[acrylic] Win32 API 调用失败，由 CSS 降级', err)
    }
  }
}

/**
 * 通过 SetWindowCompositionAttribute 为 Win10 启用窗口模糊效果
 *
 * 使用 ACCENT_ENABLE_BLUR_BEHIND=3（稳定，无窗口交互问题）
 * 颜色着色由 CSS background-color + backdrop-filter 完成
 *
 * 使用 koffi 作为 FFI 层，兼容 Node 22+
 */
function enableWin10Blur(win: BrowserWindow): void {
  try {
    // 加载 user32.dll
    const user32 = koffi.load('user32.dll')

    // 定义 ACCENT_POLICY 结构体
    const AccentPolicy = koffi.struct('AccentPolicy', {
      AccentState: 'int',
      AccentFlags: 'int',
      GradientColor: 'int',
      AnimationId: 'int'
    })

    // 定义 WINDOWCOMPOSITIONATTRIBDATA 结构体
    // SizeOfData 在 Win32 API 中为 SIZE_T（x64 下 8 字节）
    const WcaData = koffi.struct('WindowCompositionAttributeData', {
      Attribute: 'int',
      Data: koffi.pointer(AccentPolicy),
      SizeOfData: 'size_t'
    })

    // 声明 Win32 API 函数
    // BOOL SetWindowCompositionAttribute(HWND hwnd, WINDOWCOMPOSITIONATTRIBDATA *pAttrData)
    const SWCA = user32.func('SetWindowCompositionAttribute', 'int', [
      'void*',
      koffi.pointer(WcaData)
    ])

    // 构造 ACCENT_POLICY：ACCENT_ENABLE_BLUR_BEHIND = 3
    const accent = { AccentState: 3, AccentFlags: 0, GradientColor: 0, AnimationId: 0 }

    // 构造 WINDOWCOMPOSITIONATTRIBDATA：WCA_ACCENT_POLICY = 19
    const data = {
      Attribute: 19,
      Data: accent,
      SizeOfData: koffi.sizeof(AccentPolicy)
    }

    // 获取窗口句柄，转换为适当类型传入
    const hwndBuf = win.getNativeWindowHandle()
    const hwnd = hwndBuf.readBigUInt64LE(0)

    // 调用 API
    const result = SWCA(koffi.as(hwnd, 'void*'), data)
    user32.unload()

    if (result === 0) {
      throw new Error('SetWindowCompositionAttribute 失败')
    } else {
      log.info('[acrylic] Win32 BlurBehind 已启用')
    }
  } catch (err) {
    log.warn('[acrylic] Win32 BlurBehind 启用失败，由 CSS 降级', err)
  }
}
