/**
 * 前台应用监控
 *
 * 通过 koffi FFI 直接调用 Win32 API 获取当前前台窗口信息，
 * 替代原有的 PowerShell 子进程方案，提升性能和可靠性。
 */

import koffi from 'koffi'

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

/** 权限常量：PROCESS_QUERY_LIMITED_INFORMATION */
const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000

export class ForegroundAppMonitor {
  private static instance: ForegroundAppMonitor
  // 当前前台应用的唯一标识，格式为 "processName:pid"
  private currentAppKey = ''
  // 当前前台应用开始的时间戳，单位为毫秒
  private currentAppStartAt = 0
  // 上一次广播的前台应用使用事件数据，用于在渲染进程中获取最近一次的前台应用状态
  private lastPayload: ForegroundAppUsagePayload | null = null

  // koffi 绑定的 DLL 和函数引用（延迟初始化，仅在 win32 平台使用）
  private user32: ReturnType<typeof koffi.load> | null = null
  private kernel32: ReturnType<typeof koffi.load> | null = null
  private getForegroundWindow!: (...args: unknown[]) => unknown
  private getWindowThreadProcessId!: (...args: unknown[]) => unknown
  private getWindowTextW!: (...args: unknown[]) => unknown
  private openProcess!: (...args: unknown[]) => unknown
  private queryFullProcessImageNameW!: (...args: unknown[]) => unknown
  private closeHandle!: (...args: unknown[]) => unknown

  static getInstance(): ForegroundAppMonitor {
    if (!ForegroundAppMonitor.instance) {
      ForegroundAppMonitor.instance = new ForegroundAppMonitor()
    }
    return ForegroundAppMonitor.instance
  }

  stop(): void {
    this.currentAppKey = ''
    this.currentAppStartAt = 0
    this.lastPayload = null
  }

  getLastPayload(): ForegroundAppUsagePayload | null {
    return this.lastPayload
  }

  async queryCurrentUsage(): Promise<ForegroundAppUsagePayload | null> {
    const info = this.queryForegroundWindow()
    if (!info) {
      return null
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
    return payload
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

  /**
   * 延迟初始化 koffi FFI 绑定。
   * 仅在 win32 平台首次调用时加载 DLL 并声明函数签名。
   */
  private ensureFFI(): boolean {
    if (process.platform !== 'win32') {
      return false
    }

    if (this.user32) {
      return true
    }

    try {
      this.user32 = koffi.load('user32.dll')
      this.kernel32 = koffi.load('kernel32.dll')

      // HWND GetForegroundWindow()
      this.getForegroundWindow = this.user32.func('GetForegroundWindow', 'void*', [])

      // DWORD GetWindowThreadProcessId(HWND hWnd, LPDWORD lpdwProcessId)
      this.getWindowThreadProcessId = this.user32.func('GetWindowThreadProcessId', 'uint', [
        'void*',
        koffi.pointer('uint')
      ])

      // int GetWindowTextW(HWND hWnd, LPWSTR lpString, int nMaxCount)
      this.getWindowTextW = this.user32.func('GetWindowTextW', 'int', [
        'void*',
        koffi.pointer('ushort'),
        'int'
      ])

      // HANDLE OpenProcess(DWORD dwDesiredAccess, BOOL bInheritHandle, DWORD dwProcessId)
      this.openProcess = this.kernel32.func('OpenProcess', 'void*', ['uint', 'int', 'uint'])

      // BOOL QueryFullProcessImageNameW(HANDLE hProcess, DWORD dwFlags, LPWSTR lpExeName, PDWORD lpdwSize)
      this.queryFullProcessImageNameW = this.kernel32.func('QueryFullProcessImageNameW', 'int', [
        'void*',
        'uint',
        koffi.pointer('ushort'),
        koffi.pointer('uint')
      ])

      // BOOL CloseHandle(HANDLE hObject)
      this.closeHandle = this.kernel32.func('CloseHandle', 'int', ['void*'])

      return true
    } catch {
      return false
    }
  }

  /**
   * 通过 Win32 API 查询当前前台窗口的进程名称、窗口标题和 PID
   * 使用 koffi FFI 直接调用 user32.dll / kernel32.dll，无需启动子进程
   */
  private queryForegroundWindow(): ForegroundWindowInfo | null {
    if (!this.ensureFFI()) {
      return null
    }

    // 解构到局部变量以通过类型窄化（消除 nullable 警告）
    const getForegroundWindow = this.getForegroundWindow!
    const getWindowThreadProcessId = this.getWindowThreadProcessId!
    const getWindowTextW = this.getWindowTextW!
    const openProcess = this.openProcess!
    const queryFullProcessImageNameW = this.queryFullProcessImageNameW!
    const closeHandle = this.closeHandle!

    try {
      // 获取前台窗口句柄
      const hwnd = getForegroundWindow()

      // 获取窗口所属进程 PID
      const pidOut = new Uint32Array(1)
      getWindowThreadProcessId(hwnd, pidOut)
      const pid = pidOut[0]
      if (pid === 0) {
        return null
      }

      // 获取窗口标题
      const titleBuf = new Uint16Array(1024)
      const titleLen = getWindowTextW(hwnd, titleBuf, 1024) as number
      const windowTitle =
        titleLen > 0
          ? String.fromCharCode(...titleBuf.slice(0, titleLen))
          : ''

      // 通过 PID 获取进程完整路径，提取进程名称
      let processName = ''

      const hProcess = openProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid)
      if (hProcess) {
        const pathBuf = new Uint16Array(4096)
        const pathSize = new Uint32Array([4096])
        const result = queryFullProcessImageNameW(hProcess, 0, pathBuf, pathSize)
        if (result) {
          const fullPath = String.fromCharCode(...pathBuf.slice(0, pathSize[0]))
          // 从路径中提取文件名，去掉 .exe 扩展名
          processName = fullPath
            .replace(/\\/g, '/')
            .split('/')
            .pop()
            ?.replace(/\.exe$/i, '') || ''
        }
        closeHandle(hProcess)
      }

      if (!processName) {
        return null
      }

      return { processName, windowTitle, pid }
    } catch {
      return null
    }
  }
}
