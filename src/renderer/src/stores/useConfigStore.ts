import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AppConfig } from '../types/appConfig'

export const useConfigStore = defineStore('config', () => {
  const config = ref<AppConfig>({
    baseUrl: '127.0.0.1:8001',
    volume: 0.8,
    autoStartOnBoot: false,
    autoUpdate: true,
    autoChat: false,
    debugMode: false,
    silentMode: false,
    idleEvent: true,
    idleTime: 2,
    assistantEnabled: false
  })

  async function loadConfig(): Promise<void> {
    const data = (await window.api.config.get()) as AppConfig
    config.value = data
  }

  async function updateConfig<K extends keyof AppConfig>(
    key: K,
    value: AppConfig[K]
  ): Promise<void> {
    await window.api.config.set(key, value)
    config.value[key] = value
  }

  function listenForChanges(): void {
    window.api.config.onChange((newConfig) => {
      console.log('[Config updated]', newConfig)
      config.value = newConfig
    })
  }

  return {
    config,
    loadConfig,
    updateConfig,
    listenForChanges
  }
})
