// 定义通知数据结构
interface NotificationData {
  type: 'success' | 'info' | 'warning' | 'error'
  title: string
  message?: string
  duration?: number
}

// 定义通知监听器类型
type NotificationListener = (
  notification: Omit<NotificationData, 'duration'> & { duration: number }
) => void

class NotificationService {
  private static instance: NotificationService
  private listeners: NotificationListener[] = []

  /**
   * 获取单例实例
   */
  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService()
    }
    return NotificationService.instance
  }

  /**
   * 添加通知监听器
   * @param listener 通知监听器函数
   */
  public addNotificationListener(listener: NotificationListener): void {
    this.listeners.push(listener)
  }

  /**
   * 移除通知监听器
   * @param listener 要移除的监听器函数
   */
  public removeNotificationListener(listener: NotificationListener): void {
    const index = this.listeners.indexOf(listener)
    if (index !== -1) {
      this.listeners.splice(index, 1)
    }
  }

  /**
   * 发送通知
   * @param data 通知数据
   */
  public notify(data: NotificationData): void {
    const notification = {
      ...data,
      duration: data.duration ?? 5000 // 默认持续5秒
    }

    // 通知所有监听器
    this.listeners.forEach((listener) => {
      try {
        listener(notification)
      } catch (error) {
        console.error('Error in notification listener:', error)
      }
    })
  }

  /**
   * 显示信息通知
   * @param title 通知标题
   * @param message 通知内容
   * @param duration 显示时长（毫秒）
   */
  public info({
    title = 'Info',
    message,
    duration = 5000
  }: {
    title?: string
    message?: string
    duration?: number
  }): void {
    this.notify({
      type: 'info',
      title,
      message,
      duration
    })
  }

  /**
   * 显示成功通知
   * @param title 通知标题
   * @param message 通知内容
   * @param duration 显示时长（毫秒）
   */
  public success({
    title = 'Success',
    message,
    duration = 5000
  }: {
    title?: string
    message?: string
    duration?: number
  }): void {
    this.notify({
      type: 'success',
      title,
      message,
      duration
    })
  }

  /**
   * 显示警告通知
   * @param title 通知标题
   * @param message 通知内容
   * @param duration 显示时长（毫秒）
   */
  public warning({
    title = 'Warning',
    message,
    duration = 5000
  }: {
    title?: string
    message?: string
    duration?: number
  }): void {
    this.notify({
      type: 'warning',
      title,
      message,
      duration
    })
  }

  /**
   * 显示错误通知
   * @param title 通知标题
   * @param message 通知内容
   * @param duration 显示时长（毫秒）
   */
  public error({
    title = 'Error',
    message,
    duration = 5000
  }: {
    title?: string
    message?: string
    duration?: number
  }): void {
    this.notify({
      type: 'error',
      title,
      message,
      duration
    })
  }
}

export { NotificationService }
export type { NotificationData }
