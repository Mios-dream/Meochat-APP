/**
 * 悬浮提示窗口服务
 *
 * 集中管理悬浮提示窗口（TipsView）的创建、展示、内容更新与隐藏，并承担窗口生命周期的兜底管理。
 *
 * 背景：悬浮提示窗口依赖回复进程（桌宠助手窗口）主动发送 hideTips 关闭。
 * 若回复进程中途退出（如桌宠模式下提前关闭助手窗口），hideTips 将不再送达，
 * 悬浮窗口便会一直停留。为此本服务引入自动隐藏兜底定时器：
 * 每次展示/更新消息时刷新，一旦超过设定时间没有新消息更新，则自动隐藏窗口。
 *
 * 消失动画协调：隐藏时主进程不立即隐藏 OS 窗口，而是延迟一段时间再隐藏，
 * 让渲染进程的消失动画完整播放；渲染进程内部也有更短的超时自行复位隐藏状态，
 * 两侧各自兜底，无需跨进程动画完成通知。
 */

import { screen } from 'electron'
import { CHANNELS } from '@shared/ipc/channels'
import { windowRegistry, createWindow, tipsWindowConfig } from '../windows'
import log from '../utils/logger'

/** 悬浮提示窗口展示/更新消息的载荷结构。 */
export interface TipsMessagePayload {
  /** 提示消息文本。 */
  message: string
  /** 头像图片地址，可选。 */
  avatarUrl?: string
}

/** 悬浮提示窗口宽度（px）。 */
const TIPS_WINDOW_WIDTH = 380
/** 悬浮提示窗口高度（px）。 */
const TIPS_WINDOW_HEIGHT = 130
/** 窗口距屏幕右侧的边距（px）。 */
const TIPS_WINDOW_MARGIN = 20
/** 窗口距屏幕顶部的边距（px）。 */
const TIPS_WINDOW_TOP = 20

/**
 * 悬浮提示窗口服务单例。
 *
 * IPC 层只负责转发事件到本服务，窗口的创建、定位、显示隐藏与销毁统一在此管理。
 */
class TipsService {
  private static instance: TipsService | null = null

  /** 延迟销毁定时器：tips 窗口隐藏一段时间后才销毁，避免频繁创建销毁。 */
  private destroyTimer: ReturnType<typeof setTimeout> | null = null
  /** 自动隐藏安全定时器：回复进程异常退出时兜底隐藏悬浮窗口。 */
  private autoHideTimer: ReturnType<typeof setTimeout> | null = null
  /** 延迟隐藏定时器：发送隐藏事件后等待消失动画播放，再隐藏 OS 窗口。 */
  private delayedHideTimer: ReturnType<typeof setTimeout> | null = null

  /** 自动隐藏兜底超时时间（ms）：超过该时间没有新消息更新则自动隐藏窗口。 */
  private static readonly AUTO_HIDE_TIMEOUT = 5000
  /** 窗口隐藏后彻底销毁的延迟时间（ms），避免频繁创建销毁。 */
  private static readonly DESTROY_DELAY = 5 * 60 * 1000
  /** 隐藏 OS 窗口的延迟时间（ms）：需大于渲染进程消失动画时长，确保动画完整播放。 */
  private static readonly HIDE_DELAY_MS = 1000

  /** 获取单例实例。 */
  public static getInstance(): TipsService {
    if (!TipsService.instance) {
      TipsService.instance = new TipsService()
    }
    return TipsService.instance
  }

  /**
   * 展示悬浮提示窗口并发送最新消息。
   *
   * 窗口已存在时直接显示并发送消息；尚未创建时按屏幕右下角定位创建。
   * 无论哪种情况都会刷新自动隐藏兜底定时器，确保消息有展示时长的上限。
   *
   * @param data - 提示消息载荷
   */
  public show(data: TipsMessagePayload): void {
    // 有新消息：取消延迟销毁与待隐藏状态，并刷新自动隐藏兜底定时器
    if (this.destroyTimer) {
      clearTimeout(this.destroyTimer)
      this.destroyTimer = null
    }
    this.clearDelayedHideTimer()
    this.scheduleAutoHide()

    const tipsWin = windowRegistry.getWindowByType('tips')
    if (tipsWin && !tipsWin.isDestroyed()) {
      tipsWin.show()
      tipsWin.webContents.send(CHANNELS.TIPS_SHOW_EVENT, data)
      return
    }

    // 窗口尚未创建时，定位在屏幕右上角创建
    const primaryDisplay = screen.getPrimaryDisplay()
    const { width: screenWidth } = primaryDisplay.workArea
    const x = screenWidth - TIPS_WINDOW_WIDTH - TIPS_WINDOW_MARGIN
    const y = TIPS_WINDOW_TOP
    createWindow(tipsWindowConfig, {
      overrides: { x, y, width: TIPS_WINDOW_WIDTH, height: TIPS_WINDOW_HEIGHT },
      showImmediately: true
    })
      .then((win) => {
        win.webContents.send(CHANNELS.TIPS_SHOW_EVENT, data)
      })
      .catch((err) => log.error('创建悬浮提示窗口失败:', err))
  }

  /**
   * 更新悬浮提示窗口的消息内容。
   *
   * 活跃回复期间每收到一次更新都会刷新自动隐藏定时器，
   * 回复结束或回复进程退出后，由定时器兜底关闭窗口。
   *
   * @param data - 提示消息载荷
   */
  public update(data: TipsMessagePayload): void {
    this.scheduleAutoHide()
    const tipsWin = windowRegistry.getWindowByType('tips')
    if (tipsWin && !tipsWin.isDestroyed()) {
      tipsWin.webContents.send(CHANNELS.TIPS_MESSAGE_EVENT, data)
    }
  }

  /**
   * 隐藏悬浮提示窗口。
   *
   * 先向渲染进程发送隐藏事件以播放消失动画，并延迟一段时间后再隐藏 OS 窗口，
   * 确保消失动画完整呈现。若期间有新的显示请求（show），延迟隐藏会被取消。
   */
  public hide(): void {
    this.clearAutoHideTimer()
    const tipsWin = windowRegistry.getWindowByType('tips')
    if (!tipsWin || tipsWin.isDestroyed()) return
    tipsWin.webContents.send(CHANNELS.TIPS_HIDE_EVENT)
    // 等待消失动画播放完，再隐藏 OS 窗口
    this.scheduleDelayedHide()
  }

  /** 清除自动隐藏安全定时器。 */
  private clearAutoHideTimer(): void {
    if (this.autoHideTimer) {
      clearTimeout(this.autoHideTimer)
      this.autoHideTimer = null
    }
  }

  /** 清除延迟隐藏 OS 窗口的定时器。 */
  private clearDelayedHideTimer(): void {
    if (this.delayedHideTimer) {
      clearTimeout(this.delayedHideTimer)
      this.delayedHideTimer = null
    }
  }

  /** 调度延迟隐藏 OS 窗口，等待消失动画播放完成后触发。 */
  private scheduleDelayedHide(): void {
    this.clearDelayedHideTimer()
    this.delayedHideTimer = setTimeout(() => {
      this.delayedHideTimer = null
      this.hideWindow()
    }, TipsService.HIDE_DELAY_MS)
  }

  /** 重置自动隐藏定时器，保证活跃回复不会被误关闭。 */
  private scheduleAutoHide(): void {
    this.clearAutoHideTimer()
    this.autoHideTimer = setTimeout(() => {
      this.autoHideTimer = null
      // 与显式隐藏一致：先发送隐藏事件播放消失动画，动画完成后才隐藏 OS 窗口
      this.hide()
    }, TipsService.AUTO_HIDE_TIMEOUT)
  }

  /** 隐藏悬浮提示窗口的 OS 窗口，并调度延迟后的彻底销毁。 */
  private hideWindow(): void {
    const tipsWin = windowRegistry.getWindowByType('tips')
    if (!tipsWin || tipsWin.isDestroyed()) return
    // 仅隐藏 OS 窗口，隐藏事件已在 hide() 中发送，避免重复触发
    tipsWin.hide()
    if (this.destroyTimer) clearTimeout(this.destroyTimer)
    this.destroyTimer = setTimeout(() => {
      this.destroyTimer = null
      const target = windowRegistry.getWindowByType('tips')
      if (target && !target.isDestroyed()) {
        target.close()
      }
    }, TipsService.DESTROY_DELAY)
  }
}

export { TipsService }
