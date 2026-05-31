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
