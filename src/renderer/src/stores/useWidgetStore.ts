/**
 * 小组件状态管理
 * 使用 Pinia 管理小组件的状态
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { WidgetInstance, WidgetConfigFile, WidgetGlobalSettings } from '@shared/types/widget'

export const useWidgetStore = defineStore('widget', () => {
  /** 小组件实例列表 */
  const instances = ref<WidgetInstance[]>([])

  /** 全局设置 */
  const globalSettings = ref<WidgetGlobalSettings>({
    snapToGrid: true,
    gridSize: 20,
    showOnDesktop: true
  })

  /** 是否已加载 */
  const loaded = ref(false)

  /** 已启用的小组件实例 */
  const enabledInstances = computed(() => instances.value.filter((i) => i.enabled))

  /** 已禁用的小组件实例 */
  const disabledInstances = computed(() => instances.value.filter((i) => !i.enabled))

  /**
   * 从主进程加载配置
   */
  async function loadConfig(): Promise<void> {
    try {
      const result = await window.api.widgetManager.getAllConfigs()
      if (result.success && result.data) {
        instances.value = result.data.instances || []
        globalSettings.value = result.data.globalSettings || {
          snapToGrid: true,
          gridSize: 20,
          showOnDesktop: true
        }
        loaded.value = true
      }
    } catch (error) {
      console.error('加载小组件配置失败:', error)
    }
  }

  /**
   * 保存配置到主进程
   */
  async function saveConfig(): Promise<boolean> {
    try {
      const config: WidgetConfigFile = {
        instances: JSON.parse(JSON.stringify(instances.value)),
        globalSettings: JSON.parse(JSON.stringify(globalSettings.value))
      }
      const result = await window.api.widgetManager.saveConfig(config)
      return result.success
    } catch (error) {
      console.error('保存小组件配置失败:', error)
      return false
    }
  }

  /**
   * 添加小组件实例
   */
  async function addInstance(instance: WidgetInstance): Promise<boolean> {
    try {
      // 创建纯对象，避免 Pinia 响应式代理导致的序列化问题
      const plainInstance = JSON.parse(JSON.stringify(instance))
      const result = await window.api.widgetManager.addInstance(plainInstance)
      if (result.success) {
        // 更新本地状态
        const existingIndex = instances.value.findIndex((i) => i.id === instance.id)
        if (existingIndex >= 0) {
          instances.value[existingIndex] = instance
        } else {
          instances.value.push(instance)
        }
        return true
      }
      return false
    } catch (error) {
      console.error('添加小组件实例失败:', error)
      return false
    }
  }

  /**
   * 更新小组件实例
   */
  async function updateInstance(
    instanceId: string,
    updates: Partial<WidgetInstance>
  ): Promise<boolean> {
    try {
      // 创建纯对象，避免 Pinia 响应式代理导致的序列化问题
      const plainUpdates = JSON.parse(JSON.stringify(updates))
      const result = await window.api.widgetManager.updateInstance(instanceId, plainUpdates)
      if (result.success) {
        // 更新本地状态
        const index = instances.value.findIndex((i) => i.id === instanceId)
        if (index >= 0) {
          instances.value[index] = { ...instances.value[index], ...updates }
        }
        return true
      }
      return false
    } catch (error) {
      console.error('更新小组件实例失败:', error)
      return false
    }
  }

  /**
   * 删除小组件实例
   */
  async function deleteInstance(instanceId: string): Promise<boolean> {
    try {
      const result = await window.api.widgetManager.deleteInstance(instanceId)
      if (result.success) {
        // 更新本地状态
        instances.value = instances.value.filter((i) => i.id !== instanceId)
        return true
      }
      return false
    } catch (error) {
      console.error('删除小组件实例失败:', error)
      return false
    }
  }

  /**
   * 切换小组件启用状态
   */
  async function toggleEnabled(instanceId: string, enabled: boolean): Promise<boolean> {
    return updateInstance(instanceId, { enabled })
  }

  /**
   * 切换小组件置顶状态
   */
  async function togglePinned(instanceId: string, pinned: boolean): Promise<boolean> {
    try {
      const result = await window.api.widgetManager.togglePin(instanceId, pinned)
      if (result.success) {
        return updateInstance(instanceId, { pinned })
      }
      return false
    } catch (error) {
      console.error('切换小组件置顶状态失败:', error)
      return false
    }
  }

  /**
   * 创建小组件独立窗口
   */
  async function createWindow(instanceId: string): Promise<boolean> {
    try {
      console.log('调用创建窗口 IPC:', instanceId)
      const result = await window.api.widgetManager.createWindow(instanceId)
      console.log('创建窗口结果:', result)
      return result.success
    } catch (error) {
      console.error('创建小组件窗口失败:', error)
      return false
    }
  }

  /**
   * 关闭小组件独立窗口
   */
  async function closeWindow(instanceId: string): Promise<boolean> {
    try {
      const result = await window.api.widgetManager.closeWindow(instanceId)
      return result.success
    } catch (error) {
      console.error('关闭小组件窗口失败:', error)
      return false
    }
  }

  /**
   * 更新全局设置
   */
  async function updateGlobalSettings(settings: Partial<WidgetGlobalSettings>): Promise<boolean> {
    try {
      const result = await window.api.widgetManager.updateGlobalSettings(settings)
      if (result.success) {
        globalSettings.value = { ...globalSettings.value, ...settings }
        return true
      }
      return false
    } catch (error) {
      console.error('更新全局设置失败:', error)
      return false
    }
  }

  /**
   * 监听配置变更
   */
  function listenForChanges(): void {
    window.api.widgetManager.onConfigChanged((config) => {
      const changedConfig = config as WidgetConfigFile
      instances.value = changedConfig.instances || []
      globalSettings.value = changedConfig.globalSettings || {
        snapToGrid: true,
        gridSize: 20,
        showOnDesktop: true
      }
    })
  }

  /**
   * 发送数据到小组件
   */
  async function sendData(fromId: string, toId: string, type: string, payload): Promise<boolean> {
    try {
      const result = await window.api.widgetManager.sendData({
        fromId,
        toId,
        type,
        payload
      })
      return result.success
    } catch (error) {
      console.error('发送小组件数据失败:', error)
      return false
    }
  }

  /**
   * 广播数据到所有小组件
   * fromId: 发送者实例ID
   * type: 数据类型
   * payload: 数据内容
   * 返回值: 是否成功广播
   */
  async function broadcastData(fromId: string, type: string, payload: unknown): Promise<boolean> {
    try {
      const result = await window.api.widgetManager.broadcastData({
        fromId,
        type,
        payload
      })
      return result.success
    } catch (error) {
      console.error('广播小组件数据失败:', error)
      return false
    }
  }

  return {
    instances,
    globalSettings,
    loaded,
    enabledInstances,
    disabledInstances,
    loadConfig,
    saveConfig,
    addInstance,
    updateInstance,
    deleteInstance,
    toggleEnabled,
    togglePinned,
    createWindow,
    closeWindow,
    updateGlobalSettings,
    listenForChanges,
    sendData,
    broadcastData
  }
})
