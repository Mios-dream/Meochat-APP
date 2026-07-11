/**
 * 小组件数据服务
 * 负责小组件配置的持久化存储和管理
 */

import { BrowserWindow } from 'electron'
import fs from 'fs'
import path from 'path'
import { resolveAppDataDir } from '../utils/pathResolve'
import log from '../utils/logger'
import { CHANNELS } from '@shared/ipc/channels'
import type { WidgetInstance, WidgetConfigFile, WidgetGlobalSettings } from '@shared/types/widget'

/** 默认配置 */
const DEFAULT_CONFIG: WidgetConfigFile = {
  instances: [],
  globalSettings: {
    snapToGrid: true,
    gridSize: 20,
    showOnDesktop: true
  }
}

/**
 * 小组件数据服务单例类
 */
export class WidgetService {
  private static instance: WidgetService | null = null
  private configPath: string
  private config: WidgetConfigFile

  private constructor() {
    const appDataDir = resolveAppDataDir()
    this.configPath = path.join(appDataDir, 'widgets.config.json')
    this.config = this.loadConfig()
  }

  /**
   * 获取单例实例
   */
  static getInstance(): WidgetService {
    if (!WidgetService.instance) {
      WidgetService.instance = new WidgetService()
    }
    return WidgetService.instance
  }

  /**
   * 从文件加载配置
   */
  private loadConfig(): WidgetConfigFile {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf-8')
        const parsed = JSON.parse(data) as WidgetConfigFile
        // 合并默认值，确保新增字段有默认值
        return {
          ...DEFAULT_CONFIG,
          ...parsed,
          globalSettings: {
            ...DEFAULT_CONFIG.globalSettings,
            ...parsed.globalSettings
          }
        }
      }
    } catch (error) {
      log.error('加载小组件配置失败:', error)
    }
    return { ...DEFAULT_CONFIG }
  }

  /**
   * 保存配置到文件
   */
  private saveConfig(): void {
    try {
      const dir = path.dirname(this.configPath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8')
    } catch (error) {
      log.error('保存小组件配置失败:', error)
    }
  }

  /**
   * 广播配置变更到所有窗口
   */
  private broadcastConfigChange(): void {
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send(CHANNELS.WIDGET_CONFIG_CHANGED_EVENT, this.config)
      }
    })
  }

  /**
   * 获取所有配置
   */
  getAllConfigs(): WidgetConfigFile {
    return { ...this.config }
  }

  /**
   * 保存所有配置
   */
  saveAllConfigs(config: WidgetConfigFile): boolean {
    try {
      this.config = config
      this.saveConfig()
      this.broadcastConfigChange()
      return true
    } catch (error) {
      log.error('保存小组件配置失败:', error)
      return false
    }
  }

  /**
   * 添加小组件实例
   */
  addInstance(instance: WidgetInstance): boolean {
    try {
      // 检查是否已存在
      const existingIndex = this.config.instances.findIndex((i) => i.id === instance.id)
      if (existingIndex >= 0) {
        // 更新已有实例
        this.config.instances[existingIndex] = instance
      } else {
        // 添加新实例
        this.config.instances.push(instance)
      }
      this.saveConfig()
      this.broadcastConfigChange()
      return true
    } catch (error) {
      log.error('添加小组件实例失败:', error)
      return false
    }
  }

  /**
   * 更新小组件实例
   */
  updateInstance(instanceId: string, updates: Partial<WidgetInstance>): boolean {
    try {
      const index = this.config.instances.findIndex((i) => i.id === instanceId)
      if (index >= 0) {
        this.config.instances[index] = {
          ...this.config.instances[index],
          ...updates
        }
        this.saveConfig()
        this.broadcastConfigChange()
        return true
      }
      return false
    } catch (error) {
      log.error('更新小组件实例失败:', error)
      return false
    }
  }

  /**
   * 删除小组件实例
   */
  deleteInstance(instanceId: string): boolean {
    try {
      const index = this.config.instances.findIndex((i) => i.id === instanceId)
      if (index >= 0) {
        this.config.instances.splice(index, 1)
        this.saveConfig()
        this.broadcastConfigChange()
        return true
      }
      return false
    } catch (error) {
      log.error('删除小组件实例失败:', error)
      return false
    }
  }

  /**
   * 获取小组件实例
   */
  getInstance(instanceId: string): WidgetInstance | undefined {
    return this.config.instances.find((i) => i.id === instanceId)
  }

  /**
   * 获取所有小组件实例
   */
  getAllInstances(): WidgetInstance[] {
    return [...this.config.instances]
  }

  /**
   * 根据小组件类型 ID 获取已启用的实例列表。
   *
   * 用于 LLM 工具调用时按目标小组件类型查找需要通知的窗口实例。
   *
   * @param widgetId - 小组件类型 ID（weather / todo / note / clock / daily-quote）
   * @returns 匹配类型且已启用的 WidgetInstance 数组
   */
  getInstancesByType(widgetId: string): WidgetInstance[] {
    return this.config.instances.filter(
      (instance) => instance.widgetId === widgetId && instance.enabled !== false
    )
  }

  /**
   * 更新全局设置
   */
  updateGlobalSettings(settings: Partial<WidgetGlobalSettings>): boolean {
    try {
      this.config.globalSettings = {
        ...this.config.globalSettings,
        ...settings
      }
      this.saveConfig()
      this.broadcastConfigChange()
      return true
    } catch (error) {
      log.error('更新小组件全局设置失败:', error)
      return false
    }
  }

  /**
   * 获取全局设置
   */
  getGlobalSettings(): WidgetGlobalSettings {
    return { ...this.config.globalSettings }
  }
}
