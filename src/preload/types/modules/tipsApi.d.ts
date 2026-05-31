/**
 * 提示窗口 API 类型定义
 */

export interface TipsApi {
  /** 监听显示提示事件 */
  onShow: (callback: (data?: { message?: string; avatarUrl?: string }) => void) => () => void

  /** 监听隐藏提示事件 */
  onHide: (callback: () => void) => () => void

  /** 监听消息更新事件 */
  onMessage: (callback: (data: { message: string; avatarUrl?: string }) => void) => () => void

  /** 通知主进程提示窗口已准备好 */
  ready: () => void

  /** 通知主进程提示窗口动画完成 */
  animationComplete: () => void
}
