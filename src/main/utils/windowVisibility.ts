import { execFile } from 'child_process'
import { promisify } from 'util'
import { BrowserWindow } from 'electron'
import log from './logger'

const execFileAsync = promisify(execFile)

interface VisibilityResult {
  visible: boolean
  reason?: 'cloaked' | 'fullscreen_foreground' | 'hidden' | 'minimized' | 'no_window'
}

/**
 * 检测助手窗口是否真正可见。
 * 在 Electron 的 isVisible() 基础上，额外通过 Windows DWM 判断是否被全屏应用遮挡。
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

  try {
    const hwnd = assistantWin.getNativeWindowHandle()
    const hwndValue =
      process.platform === 'win32'
        ? hwnd.readUInt32LE
          ? hwnd.readUInt32LE(0)
          : hwnd.readInt32LE(0)
        : 0

    if (!hwndValue) {
      return { visible: true }
    }

    const psScript = `
[System.Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class DwmAPI {
  [DllImport("dwmapi.dll")]
  public static extern int DwmGetWindowAttribute(IntPtr hwnd, int dwAttribute, out int pvAttribute, int cbAttribute);

  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();

  [DllImport("user32.dll")]
  public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

  [DllImport("user32.dll")]
  public static extern int GetSystemMetrics(int nIndex);
}

[StructLayout(LayoutKind.Sequential)]
public struct RECT {
  public int Left, Top, Right, Bottom;
}
"@

$hwnd = [IntPtr]::new(${hwndValue})

# DWMWA_CLOAKED = 14
$cloaked = 0
[DwmAPI]::DwmGetWindowAttribute($hwnd, 14, [ref]$cloaked, 4) | Out-Null

# 检查前台窗口是否全屏
$fgHwnd = [DwmAPI]::GetForegroundWindow()
$fgRect = New-Object RECT
$fgFullscreen = $false
if ($fgHwnd -ne [IntPtr]::Zero -and [DwmAPI]::GetWindowRect($fgHwnd, [ref]$fgRect)) {
  $screenW = [DwmAPI]::GetSystemMetrics(0)   # SM_CXSCREEN
  $screenH = [DwmAPI]::GetSystemMetrics(1)   # SM_CYSCREEN
  $fgW = $fgRect.Right - $fgRect.Left
  $fgH = $fgRect.Bottom - $fgRect.Top
  if ($fgW -ge $screenW -and $fgH -ge $screenH) {
    $fgFullscreen = $true
  }
}

@{ cloaked = $cloaked; fgFullscreen = $fgFullscreen } | ConvertTo-Json -Compress
`

    const { stdout } = await execFileAsync(
      'powershell',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Encoding', 'UTF8', '-Command', psScript],
      {
        windowsHide: true,
        timeout: 2000,
        maxBuffer: 16 * 1024,
        encoding: 'utf8'
      }
    )

    const raw = stdout.trim()
    if (!raw) {
      return { visible: true }
    }

    console.log(`助手窗口可见性检查结果: ${raw}`)

    const result = JSON.parse(raw) as { cloaked: number; fgFullscreen: boolean }

    // 0 = not cloaked, 1 = cloaked by app (DWM), 2 = cloaked by shell, 3/4 = inherited
    if (result.cloaked !== 0) {
      return { visible: false, reason: 'cloaked' }
    }

    if (result.fgFullscreen) {
      return { visible: false, reason: 'fullscreen_foreground' }
    }

    return { visible: true }
  } catch (e) {
    log.warn('窗口可见性检测失败，回退到基础检测:', e)
    return { visible: true }
  }
}

export { checkAssistantWindowVisibility }
export type { VisibilityResult }
