import { NotificationService } from './NotificationService'

// 日志级别类型
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARNING = 2,
  ERROR = 3
}

// 日志项接口
export interface LogItem {
  // 日志项ID
  id: string
  // 日志项创建时间
  timestamp: string
  // 日志项级别
  level: LogLevel
  // 日志项消息
  message: string
  // 日志项详细信息
  details?: string
}

/**
 * 日志服务类
 */
class LogService {
  // 单例实例
  private static instance: LogService
  // 日志历史记录
  private logHistory: LogItem[] = []
  // 最大日志数量
  private maxVisibleLogs = 100

  // 当前日志级别
  private logLevel: LogLevel = LogLevel.ERROR

  private constructor() {
    this.setupLogListeners()
  }

  public static getInstance(): LogService {
    if (!LogService.instance) {
      LogService.instance = new LogService()
    }
    return LogService.instance
  }

  /**
   * 设置日志监听器
   */
  private setupLogListeners(): void {
    // 这里可以通过重写console方法来捕获渲染进程的所有日志
    const originalConsoleLog = console.log
    const originalConsoleWarn = console.warn
    const originalConsoleError = console.error
    const originalConsoleDebug = console.debug

    console.log = (...args) => {
      this.info(
        args.map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg))).join(' ')
      )
      originalConsoleLog.apply(console, args)
    }

    console.warn = (...args) => {
      this.warning(
        args.map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg))).join(' ')
      )
      originalConsoleWarn.apply(console, args)
    }

    console.error = (...args) => {
      this.error(
        args.map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg))).join(' ')
      )
      originalConsoleError.apply(console, args)
    }

    console.debug = (...args) => {
      this.debug(
        args.map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg))).join(' ')
      )
      originalConsoleDebug.apply(console, args)
    }
  }

  // 添加日志到历史记录
  private addToHistory(level: LogLevel, message: string, details?: string): void {
    const logItem: LogItem = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      level,
      message,
      details
    }

    this.logHistory.push(logItem)

    // 限制历史记录数量
    if (this.logHistory.length > this.maxVisibleLogs) {
      this.logHistory.shift()
    }

    // 只显示大于等于当前日志级别的日志
    // 只显示大于等于当前日志级别的日志
    if (level >= this.logLevel) {
      // 获取通知服务实例
      const notificationService = NotificationService.getInstance()

      // 根据日志级别设置通知类型和标题
      let notificationType: 'success' | 'warning' | 'error' | 'info' = 'info'
      let title: string

      switch (level) {
        case LogLevel.DEBUG:
          notificationType = 'info'
          title = 'Info'
          break
        case LogLevel.INFO:
          notificationType = 'success'
          title = 'Success'
          break
        case LogLevel.WARNING:
          notificationType = 'warning'
          title = 'Warning'
          break
        case LogLevel.ERROR:
          notificationType = 'error'
          title = 'Error'
          break
      }

      // 显示通知
      notificationService.notify({
        title,
        message: message,
        type: notificationType
      })
    }
  }

  /**
   * 设置日志级别(影响是否显示通知)
   * @param level 日志级别
   */
  public setLogLevel(level: LogLevel): void {
    this.logLevel = level
  }

  /**
   * 记录调试日志
   * @param message 日志消息
   * @param details 日志详细信息
   */
  public debug(message: string, details?: string): void {
    window.api.log.debug(message, details)
    this.addToHistory(LogLevel.DEBUG, message, details)
  }

  /**
   * 记录信息日志
   * @param message 日志消息
   * @param details 日志详细信息
   */
  public info(message: string, details?: string): void {
    window.api.log.info(message, details)
    this.addToHistory(LogLevel.INFO, message, details)
  }

  /**
   * 记录警告日志
   * @param message 日志消息
   * @param details 日志详细信息
   */
  public warning(message: string, details?: string): void {
    window.api.log.warn(message, details)
    this.addToHistory(LogLevel.WARNING, message, details)
  }

  /**
   * 记录错误日志
   * @param message 日志消息
   * @param details 日志详细信息
   */
  public error(message: string, details?: string): void {
    window.api.log.error(message, details)
    this.addToHistory(LogLevel.ERROR, message, details)
  }

  /**
   * 获取日志历史记录
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

// 导出单例
export const logService = LogService.getInstance()
