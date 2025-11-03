<template>
  <div class="background-container">
    <div class="dashboard-content">
      <h1 class="page-title">设置</h1>
      <p class="page-title-description"></p>

      <div class="setting-container">
        <div class="setting-title">基础设置</div>
        <div class="setting-item">
          <form class="setting-from">
            <div class="title">
              <label for="autoStartOnBoot">开机启动</label>
              <div class="description">应用会在开机时自动启动</div>
            </div>
            <ToggleSwitch
              :model-value="config.autoStartOnBoot"
              @update:model-value="(v) => change('autoStartOnBoot', v)"
            />
          </form>
          <div class="divider"></div>
          <form class="setting-from">
            <div class="title">
              <label for="autoUpdate">自动更新</label>
              <div class="description">当有新版本发布时，会尝试自动更新</div>
            </div>
            <ToggleSwitch
              :model-value="config.autoUpdate"
              @update:model-value="(v) => change('autoUpdate', v)"
            />
          </form>
          <div class="divider"></div>
          <form class="setting-from">
            <div class="title">
              <label for="silentMode">静默模式</label>
              <div class="description">启动时不会自动打开主窗口</div>
            </div>
            <ToggleSwitch
              :model-value="config.silentMode"
              @update:model-value="(v) => change('silentMode', v)"
            />
          </form>
          <div class="divider"></div>
          <form class="setting-from">
            <div class="title">
              <label for="debugMode">debug模式</label>
              <div class="description">打开窗口时会显示控制台</div>
            </div>
            <ToggleSwitch
              :model-value="config.debugMode"
              @update:model-value="(v) => change('debugMode', v)"
            />
          </form>
        </div>
        <div class="setting-title">服务设置</div>
        <div class="setting-item">
          <form class="setting-from">
            <div class="title">
              <label for="lock-assistant">服务器地址</label>
              <div class="description">连接到MeoChat的服务器地址</div>
            </div>
            <div style="width: 300px; height: 40px">
              <SimpleInput
                :model-value="config.baseUrl"
                @update:model-value="(v) => change('baseUrl', v)"
                @validated="handleValidation"
                :validator="validateServerAddress"
                validation-error-message="无法连接到服务器"
                placeholder="127.0.0.1:8001"
              />
            </div>
          </form>
        </div>
        <div class="setting-title">关于项目</div>
        <div class="setting-item">
          <form class="setting-from">
            <div class="title">
              <label for="project-info">项目信息</label>
              <div class="description">MeoChat桌面助手客户端</div>
            </div>
            <div class="support-buttons">
              <button class="support-button" @click="openProjectHomepage">核心项目</button>
              <button class="support-button" @click="openSupportPage">助手项目</button>
            </div>
          </form>
          <div class="divider"></div>
          <form class="setting-from">
            <div class="title">
              <label for="version-info">版本信息</label>
              <div class="description">当前版本和更新信息</div>
            </div>
            <div class="version-info">
              <span class="version-text">v0.0.1</span>
              <!-- <button class="update-button">检查更新</button> -->
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import ToggleSwitch from '../components/ToggleSwitch.vue'
import SimpleInput from '@/components/SimpleInput.vue'
import { useConfigStore } from '@/stores/useConfigStore'
import { storeToRefs } from 'pinia'

const configStore = useConfigStore()
const { config } = storeToRefs(configStore)

// 打开项目
const openProjectHomepage = () => {
  window.api.openExternal('https://github.com/Mios-dream/MoeChat')
}

// 打开App页
const openSupportPage = () => {
  window.api.openExternal('https://github.com/Mios-dream/Meochat-APP')
}

// 开机启动需要特殊处理（调用 Electron API）
const handleAutoStartChange = async (value: boolean) => {
  try {
    await window.api.setAutoStartOnBoot(value)
    configStore.updateConfig('autoStartOnBoot', value)
  } catch (error) {
    console.error('Failed to update auto start:', error)
  }
}

// 网络校验函数
const validateServerAddress = async (address: string): Promise<boolean> => {
  if (!address) return true // 空地址不校验

  try {
    // 简单格式校验
    const urlPattern = /^[\w.-]+:\d+$/
    if (!urlPattern.test(address)) {
      return false
    }

    // 实际网络连接测试
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5秒超时

    const response = await fetch(`http://${address}/api/health`, {
      method: 'GET',
      signal: controller.signal,
    })
    const result = await response.json()

    clearTimeout(timeoutId)

    if (result.status === 'ok') {
      return true
    } else {
      return false
    }
  } catch (error) {
    console.error('服务器地址校验失败:', error)
    return false
  }
}

// 处理校验结果
const handleValidation = (isValid: boolean) => {
  if (!isValid) {
    console.log('服务器地址校验失败')
    // 可以在这里添加额外的错误处理逻辑
  }
}
function change<K extends keyof typeof config.value>(key: K, value: any) {
  if (key === 'autoStartOnBoot') {
    handleAutoStartChange(value)
    return
  }
  configStore.updateConfig(key, value)
}
</script>

<style scoped>
.divider {
  width: 100%;
  height: 1px;
  background-color: #e0e0e0;
  margin-top: 10px;
  margin-bottom: 10px;
}

.setting-container {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  scrollbar-width: none;
}

.setting-title {
  display: flex;
  font-size: 20px;
  font-weight: bold;
  margin-top: 20px;
  margin-left: 5px;
}

.setting-item {
  display: flex;
  background-color: white;
  border-radius: 15px;
  padding: 20px;
  flex-direction: column;
  margin-bottom: 20px;
  margin-top: 10px;
}

.setting-from {
  height: 40px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.setting-from .title {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
}

.setting-from .title .description {
  font-size: 12px;
  color: gray;
}

/* 新增的支持按钮样式 */
.support-buttons {
  display: flex;
  gap: 10px;
}

.support-button {
  padding: 8px 16px;
  background-color: #fca9c2;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.support-button:hover {
  background-color: #fb7299;
}

/* 版本信息样式 */
.version-info {
  display: flex;
  align-items: center;
  gap: 15px;
}

.version-text {
  font-size: 14px;
  color: #666;
  font-weight: 500;
}
</style>
