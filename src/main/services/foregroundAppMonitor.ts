import { BrowserWindow } from 'electron'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export interface ForegroundAppUsagePayload {
  // 进程名称，通常不带扩展名，例如 "chrome"、"notepad"
  processName: string
  // 窗口标题，可能包含用户正在使用的具体功能或文档名称
  windowTitle: string
  pid: number
  // 应用类别，基于进程名称的简单分类，可以是 "work"、"social"、"browser"、"game"、"media" 或 "other"
  category: 'work' | 'social' | 'browser' | 'game' | 'media' | 'other'
  // 从应用成为前台到当前的持续时间，单位为毫秒
  continuousMs: number
  // 事件发生的时间戳，单位为毫秒
  sampledAt: number
}

interface ForegroundWindowInfo {
  processName: string
  windowTitle: string
  pid: number
}

export class ForegroundAppMonitor {
  private static instance: ForegroundAppMonitor
  // 监控采样的定时器
  private timer: NodeJS.Timeout | null = null
  // 当前前台应用的唯一标识，格式为 "processName:pid"
  private currentAppKey = ''
  // 当前前台应用开始的时间戳，单位为毫秒
  private currentAppStartAt = 0
  // 上一次广播的前台应用使用事件数据，用于在渲染进程中获取最近一次的前台应用状态
  private lastPayload: ForegroundAppUsagePayload | null = null

  static getInstance(): ForegroundAppMonitor {
    if (!ForegroundAppMonitor.instance) {
      ForegroundAppMonitor.instance = new ForegroundAppMonitor()
    }
    return ForegroundAppMonitor.instance
  }

  start(intervalMs: number = 60000): void {
    if (this.timer) {
      return
    }

    this.sampleAndBroadcast()
    this.timer = setInterval(() => {
      this.sampleAndBroadcast()
    }, intervalMs)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.currentAppKey = ''
    this.currentAppStartAt = 0
    this.lastPayload = null
  }

  getLastPayload(): ForegroundAppUsagePayload | null {
    return this.lastPayload
  }

  private async sampleAndBroadcast(): Promise<void> {
    const info = await this.queryForegroundWindow()
    if (!info) {
      return
    }

    const now = Date.now()
    const key = `${info.processName}:${info.pid}`

    if (this.currentAppKey !== key) {
      this.currentAppKey = key
      this.currentAppStartAt = now
    }

    const payload: ForegroundAppUsagePayload = {
      processName: info.processName,
      windowTitle: info.windowTitle,
      pid: info.pid,
      category: this.categorizeApp(info.processName),
      continuousMs: Math.max(0, now - this.currentAppStartAt),
      sampledAt: now
    }

    this.lastPayload = payload

    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('assistantEvent:app-usage', payload)
    })
  }

  // 基于进程名称的简单分类规则，可以根据需要进行调整和扩展
  private categorizeApp(processName: string): ForegroundAppUsagePayload['category'] {
    const name = processName.toLowerCase()

    if (/code|devenv|idea|pycharm|studio64|notepad\+\+|cursor/.test(name)) {
      return 'work'
    }

    if (/chrome|msedge|firefox|opera|brave/.test(name)) {
      return 'browser'
    }

    if (/wechat|qq|telegram|discord|teams|slack/.test(name)) {
      return 'social'
    }

    if (/steam|epic|valorant|league|dota|cs2|genshin|starrail/.test(name)) {
      return 'game'
    }

    if (/potplayer|vlc|spotify|music|qqmusic/.test(name)) {
      return 'media'
    }

    return 'other'
  }
  // 查询当前前台窗口的进程名称、窗口标题和PID，使用PowerShell脚本在Windows平台上获取信息，其他平台暂不支持
  private async queryForegroundWindow(): Promise<ForegroundWindowInfo | null> {
    if (process.platform !== 'win32') {
      return null
    }

    const psScript = `
[System.Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class Win32 {
  [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] 
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
  [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
}
"@

$hwnd = [Win32]::GetForegroundWindow()
if ($hwnd -eq [IntPtr]::Zero) { return }

$targetPid = 0
[Win32]::GetWindowThreadProcessId($hwnd, [ref]$targetPid) | Out-Null
if ($targetPid -eq 0) { return }

$proc = Get-Process -Id $targetPid -ErrorAction SilentlyContinue
if ($null -eq $proc) { return }

$sb = New-Object System.Text.StringBuilder(256)
[Win32]::GetWindowText($hwnd, $sb, 256) | Out-Null
$windowTitle = $sb.ToString()

@{
  processName = $proc.ProcessName
  windowTitle = $windowTitle
  pid = $proc.Id
} | ConvertTo-Json -Compress
`

    try {
      const { stdout } = await execFileAsync(
        'powershell',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Encoding', 'UTF8', '-Command', psScript],
        {
          windowsHide: true,
          timeout: 3000,
          maxBuffer: 128 * 1024,
          encoding: 'utf8'
        }
      )
      console.log('Foreground window info raw output:', stdout)

      const raw = stdout.trim()
      if (!raw) {
        return null
      }

      const parsed = JSON.parse(raw) as ForegroundWindowInfo
      if (!parsed.processName || typeof parsed.pid !== 'number') {
        return null
      }

      return {
        processName: parsed.processName,
        windowTitle: parsed.windowTitle || '',
        pid: parsed.pid
      }
    } catch {
      return null
    }
  }
}
