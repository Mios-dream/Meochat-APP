import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AppConfig, AppSettings, AssistantConfigSettings } from '@shared/types/appConfig'
import { setBaseUrl } from '@shared/api/request'

// 全局/系统配置默认值（与 configManager.ts 中 appSchema 的默认值保持一致）
const appDefaultConfig: AppSettings = {
  baseUrl: 'http://127.0.0.1:8001',
  kernelMode: 'local',
  autoStartOnBoot: false,
  autoUpdate: true,
  debugMode: false,
  silentMode: false,
  themeColor: '#fb7299'
}

// 助手相关配置默认值（与 configManager.ts 中 assistantSchema 的默认值保持一致）
const assistantDefaultConfig: AssistantConfigSettings = {
  volume: 0.5,
  autoChat: false,
  idleEvent: true,
  quietMode: false,
  desktopSpeechBoard: true,
  appSpeechBoard: true,
  assistantEnabled: false,
  currentAssistant: '',
  chatShortcut: 'Alt+A',
  sleepMode: false,
  initiativeLevel: 'low',
  renderFps: 60
}

export const useConfigStore = defineStore('config', () => {
  // 初始默认值按分组展开组合，loadConfig 完成后会被真实配置整体覆盖
  const config = ref<AppConfig>({
    ...appDefaultConfig,
    ...assistantDefaultConfig
  })

  async function loadConfig(): Promise<void> {
    const data = (await window.api.config.get()) as AppConfig
    config.value = data
    setBaseUrl(data.baseUrl)
  }

  async function updateConfig<K extends keyof AppConfig>(
    key: K,
    value: AppConfig[K]
  ): Promise<void> {
    await window.api.config.set(key, value)
    config.value[key] = value
    if (key === 'baseUrl') setBaseUrl(value as string)
  }

  function listenForChanges(): void {
    window.api.config.onChange((newConfig) => {
      config.value = newConfig
      setBaseUrl(newConfig.baseUrl)
    })
  }

  return {
    config,
    loadConfig,
    updateConfig,
    listenForChanges
  }
})
