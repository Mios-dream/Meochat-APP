/**
 * 窗口边界持久化存储服务
 * 使用独立的 electron-store 文件保存所有窗口位置信息
 *
 * 核心职责：
 * 1. 窗口位置/尺寸的持久化（应用重启后恢复）
 * 2. 多实例窗口的支持（通过 boundsKey 区分）
 * 3. 自动验证位置有效性（防止窗口出现在屏幕外）
 */

import Store, { Schema } from 'electron-store'
import { screen } from 'electron'
import type { Rectangle } from 'electron'
import { resolveAppDataDir } from '../utils/pathResolve'

/** 存储结构：boundsKey -> Rectangle */
interface BoundsStoreShape {
  [key: string]: Rectangle
}

/** electron-store schema */
const boundsSchema: Schema<BoundsStoreShape> = {}

/**
 * 窗口边界持久化存储服务
 */
class BoundsStoreService {
  private static instance: BoundsStoreService

  private readonly store: Store<BoundsStoreShape>

  private constructor() {
    this.store = new Store<BoundsStoreShape>({
      name: 'window-bounds',
      schema: boundsSchema,
      cwd: resolveAppDataDir()
    })
  }

  /**
   * 获取单例实例
   */
  static getInstance(): BoundsStoreService {
    if (!BoundsStoreService.instance) {
      BoundsStoreService.instance = new BoundsStoreService()
    }
    return BoundsStoreService.instance
  }

  /**
   * 获取窗口位置
   * @param boundsKey 窗口位置键名
   * @returns 保存的位置信息，不存在时返回 undefined
   */
  get(boundsKey: string): Rectangle | undefined {
    const bounds = this.store.get(boundsKey)
    if (bounds && typeof bounds === 'object' && 'x' in bounds && 'y' in bounds) {
      return this.validateBounds(bounds as Rectangle)
    }
    return undefined
  }

  /**
   * 保存窗口位置
   * @param boundsKey 窗口位置键名
   * @param bounds 窗口边界
   */
  set(boundsKey: string, bounds: Rectangle): void {
    this.store.set(boundsKey, bounds)
  }

  /**
   * 删除窗口位置记录
   * @param boundsKey 窗口位置键名
   */
  delete(boundsKey: string): void {
    this.store.delete(boundsKey as keyof BoundsStoreShape)
  }

  /**
   * 验证并修正窗口位置，确保在屏幕范围内
   * @param bounds 原始边界
   * @returns 修正后的边界
   */
  private validateBounds(bounds: Rectangle): Rectangle {
    const primaryDisplay = screen.getPrimaryDisplay()
    const displayBounds = primaryDisplay.bounds

    let { x, y } = bounds
    const { width, height } = bounds

    // 确保窗口在屏幕范围内
    if (x < displayBounds.x) x = displayBounds.x
    if (y < displayBounds.y) y = displayBounds.y
    if (x + width > displayBounds.x + displayBounds.width) {
      x = displayBounds.x + displayBounds.width - width
    }
    if (y + height > displayBounds.y + displayBounds.height) {
      y = displayBounds.y + displayBounds.height - height
    }

    return { x, y, width, height }
  }
}

export const boundsStore = BoundsStoreService.getInstance()
