/** 提示窗口 API 类型声明 */
interface TipsApi {
  onShow: (callback: (data?: { message?: string; avatarUrl?: string }) => void) => () => void
  onHide: (callback: () => void) => () => void
  onMessage: (callback: (data: { message: string; avatarUrl?: string }) => void) => () => void
  ready: () => void
  animationComplete: () => void
}
