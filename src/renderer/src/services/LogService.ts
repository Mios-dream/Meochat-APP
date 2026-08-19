/**
 * 渲染进程日志服务
 *
 * 职责：
 * 1. 统一捕获渲染进程的 console 输出（log / info / warn / error / debug）；
 * 2. 捕获全局未捕获错误（window.onerror）与未处理的 Promise rejection；
 * 3. 通过 preload 暴露的 window.api.log 转发到主进程 electron-log 落盘；
 * 4. 在内存中保留一份有上限的日志历史，供后续界面层展示。
 *
 * 说明：
 * - 小组件子窗口（window.open 复用进程）没有完整 preload API，本模块通过
 *   widgetBridge 提供的 window.api.log 代理转发；若完全无转发通道，则自动
 *   回退到原生 console 输出，保证日志不丢失。
 * - 本模块应以副作用 import（import './services/LogService'）的方式置于各
 *   渲染入口文件的最顶部，确保 console 捕获在业务代码执行前完成安装。
 */

// 日志级别枚举
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARNING = 2,
  ERROR = 3
}

// 日志项接口
export interface LogItem {
  // 日志项 ID
  id: string
  // 日志项创建时间
  timestamp: string
  // 日志项级别
  level: LogLevel
  // 日志项消息
  message: string
}

// 渲染进程侧可用的日志转发接口（对应 preload 的 window.api.log）
interface RendererLogApi {
  debug: (message: string, args?: unknown) => void
  info: (message: string, args?: unknown) => void
  warn: (message: string, args?: unknown) => void
  error: (message: string, args?: unknown) => void
}

// console 方法名 → 日志级别 的映射
const CONSOLE_TO_LEVEL: Record<'log' | 'info' | 'warn' | 'error' | 'debug', LogLevel> = {
  log: LogLevel.INFO,
  info: LogLevel.INFO,
  warn: LogLevel.WARNING,
  error: LogLevel.ERROR,
  debug: LogLevel.DEBUG
}

// 原始 console 方法签名（统一收敛为同一类型，便于快照与回退）
type ConsoleMethod = (...args: unknown[]) => void

/**
 * 将单个参数格式化为可读字符串。
 * - Error 对象：输出完整堆栈
 * - 普通对象：JSON 序列化（循环引用时回退 String）
 * - 其他值：String 转换
 *
 * @param arg 待格式化的参数
 * @returns 格式化后的字符串
 */
function formatArg(arg: unknown): string {
  if (arg instanceof Error) {
    return arg.stack || arg.message || String(arg)
  }
  if (typeof arg === 'object' && arg !== null) {
    try {
      return JSON.stringify(arg)
    } catch {
      return String(arg)
    }
  }
  return String(arg)
}

/**
 * 将一组参数拼接为单行日志消息
 *
 * @param args 日志参数数组
 * @returns 拼接后的日志消息
 */
function formatArgs(args: unknown[]): string {
  return args.map(formatArg).join(' ')
}

/**
 * 渲染进程日志服务（单例）
 *
 * 使用方式：各渲染入口文件顶部 `import './services/LogService'` 即完成安装。
 */
class LogService {
  // 单例实例
  private static instance: LogService
  // 日志历史记录
  private logHistory: LogItem[] = []
  // 历史记录最大条数
  private maxLogs = 200
  // 原始 console 方法快照（用于本地输出与回退，避免递归）
  private originalConsole: Record<'log' | 'info' | 'warn' | 'error' | 'debug', ConsoleMethod>

  private constructor() {
    this.originalConsole = {
      log: console.log as ConsoleMethod,
      info: console.info as ConsoleMethod,
      warn: console.warn as ConsoleMethod,
      error: console.error as ConsoleMethod,
      debug: console.debug as ConsoleMethod
    }
    this.setupLogListeners()
  }

  /**
   * 获取单例实例
   *
   * @returns LogService 单例
   */
  public static getInstance(): LogService {
    if (!LogService.instance) {
      LogService.instance = new LogService()
    }
    return LogService.instance
  }

  /**
   * 安装日志监听：
   * 1. 重写 console 方法，统一接入日志服务；
   * 2. 注册全局 error 与 unhandledrejection 监听，兜底捕获未捕获异常。
   */
  private setupLogListeners(): void {
    const methods = ['log', 'info', 'warn', 'error', 'debug'] as const
    for (const method of methods) {
      const level = CONSOLE_TO_LEVEL[method]
      const original = this.originalConsole[method]
      console[method] = (...args: unknown[]) => {
        this.route(level, original, args)
      }
    }

    // 未捕获的运行时错误
    window.addEventListener('error', (event) => {
      const error = event.error
      const detail = error instanceof Error ? error.stack || error.message : event.message
      const location = `${event.filename}:${event.lineno}:${event.colno}`
      this.error(`[未捕获错误] ${detail} @ ${location}`)
    })

    // 未处理的 Promise 拒绝
    window.addEventListener('unhandledrejection', (event) => {
      this.error(`[未处理Promise拒绝] ${formatArg(event.reason)}`)
    })
  }

  /**
   * 统一日志出口：格式化 → 转发主进程 → 本地输出 → 记录历史
   *
   * @param level 日志级别
   * @param fallback 本地输出方法（使用原始 console，避免递归）
   * @param args 原始日志参数
   */
  private route(level: LogLevel, fallback: ConsoleMethod, args: unknown[]): void {
    const message = formatArgs(args)
    // 转发到主进程（preload 未暴露或未就绪时静默跳过）
    this.forwardToMain(level, message)
    // 保留本地输出（DevTools 行为不受影响）
    fallback(...args)
    // 记录内存历史
    this.addToHistory(level, message)
  }

  /**
   * 通过 window.api.log 将日志转发到主进程 electron-log。
   *
   * 小组件子窗口（无完整 preload）在接入桥接代理前可能不存在该接口，
   * 此处做存在性校验，保证任何情况下都不会抛错。
   *
   * @param level 日志级别
   * @param message 格式化后的日志消息
   */
  private forwardToMain(level: LogLevel, message: string): void {
    const logApi = (window as { api?: { log?: RendererLogApi } }).api?.log
    if (!logApi) return
    switch (level) {
      case LogLevel.DEBUG:
        logApi.debug(message)
        break
      case LogLevel.INFO:
        logApi.info(message)
        break
      case LogLevel.WARNING:
        logApi.warn(message)
        break
      case LogLevel.ERROR:
        logApi.error(message)
        break
    }
  }

  /**
   * 添加日志到内存历史记录（有界队列，超出上限丢弃最早条目）
   *
   * @param level 日志级别
   * @param message 日志消息
   */
  private addToHistory(level: LogLevel, message: string): void {
    const logItem: LogItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      timestamp: new Date().toISOString(),
      level,
      message
    }
    this.logHistory.push(logItem)
    if (this.logHistory.length > this.maxLogs) {
      this.logHistory.splice(0, this.logHistory.length - this.maxLogs)
    }
  }

  /**
   * 记录调试日志
   *
   * @param message 日志消息
   * @param args 附加参数（自动格式化为字符串）
   */
  public debug(message: string, ...args: unknown[]): void {
    this.route(LogLevel.DEBUG, this.originalConsole.debug, [message, ...args])
  }

  /**
   * 记录信息日志
   *
   * @param message 日志消息
   * @param args 附加参数（自动格式化为字符串）
   */
  public info(message: string, ...args: unknown[]): void {
    this.route(LogLevel.INFO, this.originalConsole.info, [message, ...args])
  }

  /**
   * 记录警告日志
   *
   * @param message 日志消息
   * @param args 附加参数（自动格式化为字符串）
   */
  public warning(message: string, ...args: unknown[]): void {
    this.route(LogLevel.WARNING, this.originalConsole.warn, [message, ...args])
  }

  /**
   * 记录错误日志
   *
   * @param message 日志消息
   * @param args 附加参数（自动格式化为字符串）
   */
  public error(message: string, ...args: unknown[]): void {
    this.route(LogLevel.ERROR, this.originalConsole.error, [message, ...args])
  }

  /**
   * 获取日志历史记录
   *
   * @returns 日志历史记录数组
   */
  public getLogHistory(): LogItem[] {
    return [...this.logHistory]
  }

  /**
   * 清除日志历史记录
   */
  public clearLogs(): void {
    this.logHistory = []
  }
}

// 导出单例（导入本模块即触发日志监听安装）
export const logService = LogService.getInstance()
