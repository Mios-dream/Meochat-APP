/**
 * 窗口注册表
 * 统一管理所有窗口实例的生命周期
 *
 * 核心职责：
 * 1. 窗口实例的注册与注销
 * 2. 窗口状态跟踪
 * 3. 窗口查找与查询
 * 4. 批量操作（关闭所有、隐藏所有等）
 */

import type { BrowserWindow, Rectangle } from 'electron'
import type { WindowType, WindowMeta, WindowState } from './types'
import log from '../utils/logger'

/**
 * 不可接收主进程 IPC 广播的窗口类型。
 *
 * 小组件子窗口（widget）由宿主 window.open 打开、共享宿主渲染进程，未执行 preload，
 * 其隔离世界缺少 ipcNative 绑定，主进程直接 webContents.send 会触发
 * Electron「ipcNative object was missing」报错；widgetHost 为小组件内部宿主网关，
 * 非 UI 窗口，事件统一由网关转发，同样无需接收面向 UI 的广播。
 */
const WINDOW_BROADCAST_EXCLUDED_TYPES = new Set<WindowType>(['widget', 'widgetHost'])

/**
 * 窗口注册表单例
 */
class WindowRegistry {
  private static instance: WindowRegistry

  /** 窗口实例映射：key -> BrowserWindow */
  private windows: Map<string, BrowserWindow> = new Map()

  /** 窗口元数据映射：key -> WindowMeta */
  private metas: Map<string, WindowMeta> = new Map()

  /** 类型索引：WindowType -> Set<key> */
  private typeIndex: Map<WindowType, Set<string>> = new Map()

  /** webContents.id -> key 反向索引，用于 IPC handler 窗口类型校验 */
  private webContentsIndex: Map<number, string> = new Map()

  /**
   * 获取注册表单例
   */
  static getInstance(): WindowRegistry {
    if (!WindowRegistry.instance) {
      WindowRegistry.instance = new WindowRegistry()
    }
    return WindowRegistry.instance
  }

  /**
   * 生成窗口唯一键
   * @param type 窗口类型
   * @param instanceId 实例 ID（可选，用于多实例）
   */
  private getKey(type: WindowType, instanceId?: string): string {
    return instanceId ? `${type}:${instanceId}` : type
  }

  /**
   * 注册窗口
   * @param type 窗口类型
   * @param window BrowserWindow 实例
   * @param meta 窗口元数据
   * @returns 窗口唯一键
   */
  register(type: WindowType, window: BrowserWindow, meta: Partial<WindowMeta> = {}): string {
    const key = this.getKey(type, meta.instanceId)

    // 如果已存在同类型单例窗口，先清理
    if (this.windows.has(key)) {
      log.warn(`窗口 ${key} 已存在，将被替换`)
      this.unregister(key)
    }

    // 注册窗口
    this.windows.set(key, window)
    this.metas.set(key, {
      type,
      config: meta.config!,
      state: 'creating',
      createdAt: Date.now(),
      ...meta
    })

    // 更新类型索引
    if (!this.typeIndex.has(type)) {
      this.typeIndex.set(type, new Set())
    }
    this.typeIndex.get(type)!.add(key)

    // 建立 webContents 反向索引
    this.webContentsIndex.set(window.webContents.id, key)

    log.info(`窗口已注册: ${key}`)
    return key
  }

  /**
   * 注销窗口
   * @param key 窗口唯一键
   */
  unregister(key: string): void {
    const meta = this.metas.get(key)
    if (meta) {
      // 从类型索引中移除
      const typeSet = this.typeIndex.get(meta.type)
      typeSet?.delete(key)
      if (typeSet && typeSet.size === 0) {
        this.typeIndex.delete(meta.type)
      }
    }

    // 清除 webContents 反向索引
    const win = this.windows.get(key)
    if (win && !win.isDestroyed()) {
      this.webContentsIndex.delete(win.webContents.id)
    }

    this.windows.delete(key)
    this.metas.delete(key)
    log.info(`窗口已注销: ${key}`)
  }

  /**
   * 获取窗口实例
   * @param key 窗口唯一键
   * @returns BrowserWindow 实例或 null
   */
  getWindow(key: string): BrowserWindow | null {
    const win = this.windows.get(key)
    if (win && !win.isDestroyed()) {
      return win
    }
    // 自动清理已销毁的窗口
    if (win) {
      this.unregister(key)
    }
    return null
  }

  /**
   * 根据类型获取窗口（单例场景）
   * @param type 窗口类型
   * @returns BrowserWindow 实例或 null
   */
  getWindowByType(type: WindowType): BrowserWindow | null {
    const keys = this.typeIndex.get(type)
    if (!keys || keys.size === 0) {
      return null
    }

    // 返回第一个有效的窗口
    for (const key of keys) {
      const win = this.getWindow(key)
      if (win) {
        return win
      }
    }
    return null
  }

  /**
   * 获取指定类型的所有窗口（多实例场景）
   * @param type 窗口类型
   * @returns BrowserWindow 实例数组
   */
  getWindowsByType(type: WindowType): BrowserWindow[] {
    const keys = this.typeIndex.get(type)
    if (!keys) {
      return []
    }

    const windows: BrowserWindow[] = []
    for (const key of keys) {
      const win = this.getWindow(key)
      if (win) {
        windows.push(win)
      }
    }
    return windows
  }

  /**
   * 获取窗口元数据
   * @param key 窗口唯一键
   * @returns 窗口元数据或 null
   */
  getMeta(key: string): WindowMeta | null {
    return this.metas.get(key) || null
  }

  /**
   * 获取可接收主进程广播的窗口列表。
   *
   * 默认排除以下两类窗口：
   * - widget：window.open 共享渲染进程的小组件子窗口，未运行 preload，
   *   其隔离世界缺少 ipcNative 绑定，主进程直接 webContents.send 会触发
   *   Electron「ipcNative object was missing」报错，且子窗口本就无监听者；
   * - widgetHost：小组件内部宿主网关，非 UI 窗口，事件统一由网关转发，
   *   无需也不应接收面向 UI 的广播。
   *
   * 小组件相关事件应通过宿主网关（host.webContents.send）定向转发，
   * 切勿直接向 widget 类型窗口广播。
   *
   * @param exclude 额外排除的窗口类型
   * @returns 可安全接收 IPC 广播的窗口实例数组
   */
  getBroadcastableWindows(exclude: WindowType[] = []): BrowserWindow[] {
    const excluded = new Set<WindowType>(WINDOW_BROADCAST_EXCLUDED_TYPES)
    for (const type of exclude) excluded.add(type)
    const windows: BrowserWindow[] = []
    for (const [key, win] of this.windows) {
      if (!win || win.isDestroyed()) continue
      const meta = this.metas.get(key)
      if (meta && excluded.has(meta.type)) continue
      windows.push(win)
    }
    return windows
  }

  /**
   * 判断单个窗口是否可安全接收主进程 IPC 广播。
   *
   * 与 getBroadcastableWindows 共用同一判定规则，用于对「定向发送」的窗口
   * 做前置校验（如 DispatchCenter 按类型定向、updaterHandlers 焦点窗口等），
   * 防止把消息发到无 preload 的小组件子窗口上触发 ipcNative 报错。
   *
   * 仅当窗口满足以下条件时才视为可广播：
   * - 已注册且未销毁；
   * - 类型不在 WINDOW_BROADCAST_EXCLUDED_TYPES 中（非 widget / widgetHost）。
   *
   * 未注册的窗口（如创建中尚未登记的小组件子窗口）一律返回 false，
   * 保证任何未知窗口都不会被盲目发送。
   *
   * @param win 待判定的 BrowserWindow
   * @returns 可安全接收 IPC 广播时返回 true
   */
  isWindowBroadcastable(win: BrowserWindow | null): boolean {
    if (!win || win.isDestroyed()) return false
    // 通过 webContents 反向索引定位注册信息；未注册的窗口无法定位，直接拒绝
    const key = this.webContentsIndex.get(win.webContents.id)
    if (!key) return false
    const meta = this.metas.get(key)
    if (!meta) return false
    return !WINDOW_BROADCAST_EXCLUDED_TYPES.has(meta.type)
  }

  /**
   * 向所有可接收 IPC 的窗口广播消息。
   *
   * 与 BrowserWindow.getAllWindows() 的区别在于会跳过无 preload 的小组件
   * 子窗口与内部宿主网关，避免向无法接收 IPC 的窗口发送消息（详见
   * getBroadcastableWindows 注释）。
   *
   * @param channel IPC 通道名
   * @param data 载荷（将被结构化克隆）
   * @param exclude 额外排除的窗口类型
   */
  broadcast(channel: string, data?: unknown, exclude: WindowType[] = []): void {
    this.getBroadcastableWindows(exclude).forEach((win) => {
      win.webContents.send(channel, data)
    })
  }

  /**
   * 更新窗口状态
   * @param key 窗口唯一键
   * @param state 新状态
   */
  updateState(key: string, state: WindowState): void {
    const meta = this.metas.get(key)
    if (meta) {
      meta.state = state
      log.debug(`窗口状态更新: ${key} -> ${state}`)
    }
  }

  /**
   * 更新窗口边界（用于持久化）
   * @param key 窗口唯一键
   * @param bounds 窗口边界
   */
  updateBounds(key: string, bounds: Rectangle): void {
    const meta = this.metas.get(key)
    if (meta) {
      meta.bounds = bounds
    }
  }

  /**
   * 检查窗口是否存在且有效
   * @param key 窗口唯一键
   */
  hasWindow(key: string): boolean {
    const win = this.windows.get(key)
    return win !== undefined && !win.isDestroyed()
  }

  /**
   * 检查指定类型是否有窗口
   * @param type 窗口类型
   */
  hasWindowOfType(type: WindowType): boolean {
    return this.getWindowsByType(type).length > 0
  }

  /**
   * 根据 webContents.id 获取窗口类型（用于 IPC handler 权限校验）
   * @param webContentsId webContents.id
   * @returns 窗口类型，未找到返回 null
   */
  getWindowTypeByWebContentsId(webContentsId: number): WindowType | null {
    const key = this.webContentsIndex.get(webContentsId)
    if (!key) return null
    const meta = this.metas.get(key)
    return meta?.type ?? null
  }

  /**
   * 根据 webContents.id 获取多实例窗口的实例 ID（用于 IPC handler 定位实例）
   * @param webContentsId webContents.id
   * @returns 实例 ID，单例窗口或未找到返回 null
   */
  getInstanceIdByWebContentsId(webContentsId: number): string | null {
    const key = this.webContentsIndex.get(webContentsId)
    if (!key) return null
    const meta = this.metas.get(key)
    return meta?.instanceId ?? null
  }

  /**
   * 关闭所有窗口
   */
  closeAll(): void {
    const keys = Array.from(this.windows.keys())
    for (const key of keys) {
      const win = this.windows.get(key)
      if (win && !win.isDestroyed()) {
        win.close()
      }
    }
    this.windows.clear()
    this.metas.clear()
    this.typeIndex.clear()
    log.info('所有窗口已关闭')
  }

  /**
   * 关闭指定类型的所有窗口
   * @param type 窗口类型
   */
  closeByType(type: WindowType): void {
    const keys = this.typeIndex.get(type)
    if (!keys) {
      return
    }

    for (const key of keys) {
      const win = this.windows.get(key)
      if (win && !win.isDestroyed()) {
        win.close()
      }
    }
  }

  /**
   * 隐藏指定类型的所有窗口
   * @param type 窗口类型
   */
  hideByType(type: WindowType): void {
    const windows = this.getWindowsByType(type)
    windows.forEach((win) => {
      if (!win.isDestroyed()) {
        win.hide()
      }
    })
  }

  /**
   * 显示指定类型的所有窗口
   * @param type 窗口类型
   */
  showByType(type: WindowType): void {
    const windows = this.getWindowsByType(type)
    windows.forEach((win) => {
      if (!win.isDestroyed()) {
        win.show()
      }
    })
  }

  /**
   * 获取所有窗口的数量
   */
  getCount(): number {
    return this.windows.size
  }

  /**
   * 获取指定类型的窗口数量
   * @param type 窗口类型
   */
  getCountByType(type: WindowType): number {
    return this.typeIndex.get(type)?.size ?? 0
  }

  /**
   * 获取所有窗口的元数据
   */
  getAllMetas(): Map<string, WindowMeta> {
    return new Map(this.metas)
  }
}

export const windowRegistry = WindowRegistry.getInstance()
