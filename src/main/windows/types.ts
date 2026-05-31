/**
 * 窗口管理系统类型定义
 * 为大型 Electron 项目提供类型安全的窗口管理
 */

import type { BrowserWindowConstructorOptions, Rectangle } from 'electron'

/**
 * 窗口类型枚举
 * 所有窗口类型必须在此注册
 */
export type WindowType =
  | 'main' // 主窗口
  | 'widget' // 小组件窗口
  | 'assistant' // 助手窗口
  | 'chatBox' // 聊天框窗口
  | 'tips' // 提示窗口

/**
 * 窗口生命周期状态
 */
export type WindowState = 'creating' | 'loading' | 'ready' | 'closing' | 'destroyed'

/**
 * URL 查询参数类型
 */
export type QueryParams = Record<string, string | number | boolean | undefined>

/**
 * 窗口配置接口
 * 定义窗口的所有元数据和行为
 */
export interface WindowConfig {
  /** 窗口类型标识 */
  type: WindowType

  /** 对应的 HTML 文件名（多入口场景） */
  htmlFile: string

  /** preload 脚本名称（不含扩展名） */
  preload: string

  /** 窗口创建选项 */
  options: BrowserWindowConstructorOptions

  /** 前端路由路径（hash 路由） */
  route?: string

  /** 默认查询参数 */
  defaultQuery?: QueryParams

  /** 是否单例模式 */
  singleton?: boolean

  /** 窗口关闭时是否隐藏而非销毁 */
  hideOnClose?: boolean

  /** 窗口位置/尺寸持久化键名 */
  boundsKey?: string

  /** 窗口创建后的回调 */
  onCreated?: (window: Electron.BrowserWindow) => void
}

/**
 * 窗口实例元数据
 */
export interface WindowMeta {
  /** 窗口类型 */
  type: WindowType

  /** 窗口配置 */
  config: WindowConfig

  /** 窗口当前状态 */
  state: WindowState

  /** 创建时间 */
  createdAt: number

  /** 窗口唯一标识（用于多实例） */
  instanceId?: string

  /** 当前查询参数 */
  query?: QueryParams

  /** 窗口边界（用于持久化） */
  bounds?: Rectangle
}

/**
 * 窗口创建选项（扩展）
 */
export interface CreateWindowOptions {
  /** 实例 ID（多实例场景） */
  instanceId?: string

  /** 动态查询参数 */
  query?: QueryParams

  /** 是否覆盖默认配置 */
  overrides?: Partial<BrowserWindowConstructorOptions>

  /** 创建后是否立即显示 */
  showImmediately?: boolean
}

/**
 * 窗口事件回调类型
 */
export interface WindowEventCallbacks {
  onReady?: (window: Electron.BrowserWindow) => void
  onClose?: (window: Electron.BrowserWindow) => void
  onClosed?: (window: Electron.BrowserWindow) => void
  onMoved?: (bounds: Rectangle) => void
  onResized?: (bounds: Rectangle) => void
  onFocus?: (window: Electron.BrowserWindow) => void
  onBlur?: (window: Electron.BrowserWindow) => void
}
