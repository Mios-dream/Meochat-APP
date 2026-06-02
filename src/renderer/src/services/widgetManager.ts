/**
 * 小组件管理器
 * 负责小组件的注册、加载和管理
 */

import type { WidgetManifest, WidgetInstance } from '../types/widget'

/**
 * 小组件管理器单例类
 */
export class WidgetManager {
  private static instance: WidgetManager | null = null

  /** 已注册的小组件类型 */
  private registeredWidgets: Map<string, WidgetManifest> = new Map()

  /** 数据监听器 */
  private dataListeners: Map<string, Set<(data: any) => void>> = new Map()

  /**
   * 获取单例实例
   */
  static getInstance(): WidgetManager {
    if (!WidgetManager.instance) {
      WidgetManager.instance = new WidgetManager()
    }
    return WidgetManager.instance
  }

  /**
   * 注册小组件类型
   * @param manifest 小组件清单
   */
  registerWidget(manifest: WidgetManifest): void {
    if (this.registeredWidgets.has(manifest.id)) {
      console.warn(`小组件 ${manifest.id} 已注册，将被覆盖`)
    }
    this.registeredWidgets.set(manifest.id, manifest)
    console.log(`小组件已注册: ${manifest.name} (${manifest.id})`)
  }

  /**
   * 批量注册小组件
   * @param manifests 小组件清单数组
   */
  registerWidgets(manifests: WidgetManifest[]): void {
    manifests.forEach((manifest) => this.registerWidget(manifest))
  }

  /**
   * 获取已注册的小组件列表
   */
  getRegisteredWidgets(): WidgetManifest[] {
    return Array.from(this.registeredWidgets.values())
  }

  /**
   * 获取指定小组件
   * @param widgetId 小组件 ID
   */
  getWidget(widgetId: string): WidgetManifest | undefined {
    return this.registeredWidgets.get(widgetId)
  }

  /**
   * 创建小组件实例
   * @param widgetId 小组件类型 ID
   * @param config 可选配置
   */
  createInstance(widgetId: string, config?: Partial<WidgetInstance>): WidgetInstance | null {
    const widget = this.registeredWidgets.get(widgetId)
    if (!widget) {
      console.error(`小组件 ${widgetId} 未注册`)
      return null
    }

    // 生成唯一 ID
    const instanceId = `${widgetId}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

    const instance: WidgetInstance = {
      id: instanceId,
      widgetId,
      position: config?.position || { x: 100, y: 100 },
      size: config?.size || widget.defaultSize,
      enabled: config?.enabled ?? false,
      pinned: config?.pinned ?? false,
      config: config?.config || {}
    }

    return instance
  }

  /**
   * 注册数据监听器
   * @param instanceId 小组件实例 ID
   * @param callback 回调函数
   */
  registerDataListener(instanceId: string, callback: (data: any) => void): () => void {
    if (!this.dataListeners.has(instanceId)) {
      this.dataListeners.set(instanceId, new Set())
    }
    this.dataListeners.get(instanceId)!.add(callback)

    // 返回取消监听的函数
    return () => {
      const listeners = this.dataListeners.get(instanceId)
      if (listeners) {
        listeners.delete(callback)
        if (listeners.size === 0) {
          this.dataListeners.delete(instanceId)
        }
      }
    }
  }

  /**
   * 触发数据监听器
   * @param instanceId 小组件实例 ID
   * @param data 数据
   */
  triggerDataListeners(instanceId: string, data: any): void {
    const listeners = this.dataListeners.get(instanceId)
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(data)
        } catch (error) {
          console.error(`小组件 ${instanceId} 数据监听器执行失败:`, error)
        }
      })
    }
  }

  /**
   * 获取小组件的默认实例配置
   * @param widgetId 小组件类型 ID
   */
  getDefaultInstanceConfig(widgetId: string): Partial<WidgetInstance> | null {
    const widget = this.registeredWidgets.get(widgetId)
    if (!widget) {
      return null
    }

    return {
      position: { x: 100, y: 100 },
      size: widget.defaultSize,
      enabled: false,
      pinned: false,
      config: {}
    }
  }

  /**
   * 检查小组件是否已注册
   * @param widgetId 小组件 ID
   */
  isRegistered(widgetId: string): boolean {
    return this.registeredWidgets.has(widgetId)
  }

  /**
   * 注销小组件
   * @param widgetId 小组件 ID
   */
  unregisterWidget(widgetId: string): boolean {
    return this.registeredWidgets.delete(widgetId)
  }

  /**
   * 清除所有注册
   */
  clearRegistrations(): void {
    this.registeredWidgets.clear()
    this.dataListeners.clear()
  }
}
