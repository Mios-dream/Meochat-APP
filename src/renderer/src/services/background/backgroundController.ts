/**
 * backgroundController.ts
 *
 * 动态背景的对外控制门面（模块级单例）。
 *
 * 设计说明：
 * - 本项目已有模块级单例服务的先例（NotificationService、ClickEffectService 等），
 *   本控制器沿用该模式，任何页面/组件只需 import 后直接调用方法，
 *   无需引入 provide/inject、模板 ref 等组件间传值机制。
 * - 控制器只依赖 BackgroundController 能力接口（背景动画/樱花显示的控制），
 *   不暴露 BackgroundScene 的内部实现细节。
 * - 由于 AnimatedBackground 的场景初始化是异步的，外部请求先缓存在本地变量，
 *   registerBackgroundScene() 收到已就绪的场景后统一应用，保证请求不丢失。
 */
import { BackgroundScene } from './BackgroundScene'

/**
 * 动态背景对外控制器能力接口。
 * 只声明外部可用的控制能力，不依赖 BackgroundScene 内部实现细节，
 * 便于外部组件按需调用，也便于测试时以 mock 替换。
 */
export interface BackgroundController {
  /** 设置樱花飘落特效的显示状态 */
  setSakuraVisible(visible: boolean): void
  /** 暂停/恢复整个动态背景的动画循环 */
  setPaused(paused: boolean): void
}

/** 当前已注册的动态背景场景（未初始化完成或组件卸载时为 null） */
let scene: BackgroundScene | null = null
/** 待应用的樱花显示请求（在场景就绪前由外部调用时缓存） */
let sakuraVisibleRequest = false
/** 待应用的暂停请求（在场景就绪前由外部调用时缓存） */
let pausedRequest = false

/** 动态背景对外控制器单例：外部直接调用其方法控制背景动画 */
export const backgroundController: BackgroundController = {
  /** 设置樱花飘落特效的显示状态 */
  setSakuraVisible(visible: boolean): void {
    sakuraVisibleRequest = visible
    scene?.setSakuraVisible(visible)
  },
  /** 暂停/恢复整个动态背景的动画循环 */
  setPaused(paused: boolean): void {
    pausedRequest = paused
    scene?.setPaused(paused)
  }
}

/**
 * 注册/注销动态背景场景实例。
 * 由 AnimatedBackground 组件在场景初始化完成后调用（注册），卸载时调用（注销）。
 * 注册成功后会立即应用此前缓存的控制请求，避免"先调用后初始化"导致请求丢失。
 * @param next 已就绪的 BackgroundScene 实例；传 null 表示注销
 */
export function registerBackgroundScene(next: BackgroundScene | null): void {
  scene = next
  if (scene) {
    scene.setSakuraVisible(sakuraVisibleRequest)
    scene.setPaused(pausedRequest)
  }
}
