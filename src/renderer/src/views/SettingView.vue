<template>
  <div class="background-container">
    <div class="dashboard-content">
      <h1 class="page-title">设置</h1>
      <p class="page-title-description"></p>

      <div class="setting-container">
        <div class="setting-title">基础设置</div>
        <div class="setting-item">
          <form class="setting-form">
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
          <form class="setting-form">
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
          <form class="setting-form">
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
          <form class="setting-form">
            <div class="title">
              <label for="debugMode">debug模式</label>
              <div class="description">打开窗口时会显示控制台</div>
            </div>
            <ToggleSwitch
              :model-value="config.debugMode"
              @update:model-value="(v) => change('debugMode', v)"
            />
          </form>
          <div class="divider"></div>
          <form class="setting-form">
            <div class="title">
              <label for="themeColor">主题色</label>
              <div class="description">设置应用的主题颜色</div>
            </div>
            <div class="color-picker-container">
              <span class="color-value">{{ config.themeColor || '#fb7299' }}</span>
              <div class="color-picker-wrapper" @click="triggerColorPicker">
                <div
                  class="color-preview"
                  :style="{ backgroundColor: config.themeColor || '#fb7299' }"
                ></div>
              </div>
              <input
                ref="colorInputRef"
                type="color"
                class="color-input"
                :value="config.themeColor || '#fb7299'"
                @input="handleColorChange"
              />
            </div>
          </form>
        </div>

        <div class="setting-title">服务设置</div>
        <div class="setting-item">
          <form class="setting-form">
            <div class="title">
              <label for="kernel-mode">核心运行模式</label>
              <div class="description">选择本地模式启动内核，或API模式连接远程服务</div>
            </div>
            <div class="mode-switcher">
              <button
                type="button"
                class="mode-btn"
                :class="{ active: config.kernelMode === 'local' }"
                @click="change('kernelMode', 'local')"
              >
                <font-awesome-icon icon="fa-solid fa-microchip" />
                <span>本地</span>
              </button>
              <button
                type="button"
                class="mode-btn"
                :class="{ active: config.kernelMode === 'api' }"
                @click="change('kernelMode', 'api')"
              >
                <font-awesome-icon icon="fa-solid fa-cloud" />
                <span>远程</span>
              </button>
            </div>
          </form>
          <div class="divider"></div>
          <form class="setting-form">
            <div class="title">
              <label for="lock-assistant">服务器地址</label>
              <div class="description">连接到MoeChat的服务器地址</div>
            </div>
            <div style="width: 200px; height: 40px">
              <SimpleInput
                :model-value="config.baseUrl"
                :validator="validateServerAddress"
                validation-error-message="无法连接到服务器"
                placeholder="http://127.0.0.1:8001"
                @update:model-value="(v) => change('baseUrl', v as string)"
                @validated="handleValidation"
              />
            </div>
          </form>
          <div class="divider"></div>
          <form class="setting-form">
            <div class="title">
              <label for="server-config">服务器配置</label>
              <div class="description">从服务端读取并编辑运行配置</div>
            </div>
            <RoundedButton :disabled="isLoadingServerConfig" @click="openServerConfigDialog">
              {{ isLoadingServerConfig ? '加载中...' : '编辑配置' }}
            </RoundedButton>
          </form>
        </div>
        <div class="setting-title">关于项目</div>
        <div class="setting-item" style="margin-bottom: 50px">
          <form class="setting-form">
            <div class="title">
              <label for="project-info">项目信息</label>
              <div class="description">MoeChat桌面助手客户端</div>
            </div>
            <div class="support-buttons">
              <button class="support-button" @click="openProjectHomepage">核心项目</button>
              <button class="support-button" @click="openSupportPage">助手项目</button>
            </div>
          </form>
          <div class="divider"></div>
          <form class="setting-form">
            <div class="title">
              <label for="version-info">版本信息</label>
              <div class="description">当前版本和更新信息</div>
            </div>
            <div class="version-info">
              <span class="version-text">v{{ currentVersion }}</span>
              <RoundedButton :disabled="isCheckingUpdate" @click="checkForUpdatesAndConfirm">
                {{ isCheckingUpdate ? '检查中...' : '检查更新' }}
              </RoundedButton>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- 更新弹窗 -->
    <UpdateModal
      v-model="showUpdateModal"
      :current-version="currentVersion"
      :new-version="newVersion"
      :release-notes="releaseNotes"
      @close="showUpdateModal = false"
      @confirm="confirmUpdate"
    />

    <ServerConfigDialog
      v-model="showServerConfigDialog"
      :config="serverConfigDraft"
      :is-saving="isSavingServerConfig"
      @close="showServerConfigDialog = false"
      @submit="saveServerConfig"
    />
  </div>
</template>

<script setup lang="ts">
import ToggleSwitch from '../components/ToggleSwitch.vue'
import SimpleInput from '../components/SimpleInput.vue'
import UpdateModal from '../components/UpdateDialog.vue'
import RoundedButton from '../components/RoundedButton.vue'
import ServerConfigDialog from '../components/main/ServerConfigDialog.vue'
import { useConfigStore } from '../stores/useConfigStore'
import { NotificationService } from '../services/NotificationService'
import { mergeServerConfig, normalizeServerConfig } from '../types/serverConfig'
import type { ServerConfig } from '../types/serverConfig'
import { storeToRefs } from 'pinia'
import { ref, onMounted, onUnmounted } from 'vue'
import { request } from '@shared/api/request'

const configStore = useConfigStore()
const { config } = storeToRefs(configStore)

const isCheckingUpdate = ref(false)
// 更新弹窗相关状态
const showUpdateModal = ref(false)
const currentVersion = ref('')
const newVersion = ref('')
const releaseNotes = ref('')
const showDownloadProgress = ref(false)
const downloadProgress = ref(0)
const notificationService = NotificationService.getInstance()
const showServerConfigDialog = ref(false)
const isLoadingServerConfig = ref(false)
const isSavingServerConfig = ref(false)
const serverConfigDraft = ref<ServerConfig | null>(null)

const colorInputRef = ref<HTMLInputElement | null>(null)

function triggerColorPicker(): void {
  if (colorInputRef.value) {
    colorInputRef.value.click()
  }
}
function handleColorChange(event: Event): void {
  const target = event.target as HTMLInputElement
  change('themeColor', target.value)
}

onMounted(async () => {
  currentVersion.value = await window.api.appUpdate.getCurrentVersion()
})

async function openServerConfigDialog(): Promise<void> {
  if (!config.value.baseUrl) {
    notificationService.warning({
      title: '提示',
      message: '请先配置服务器地址'
    })
    return
  }

  isLoadingServerConfig.value = true
  try {
    const response = await request.get('/api/get_config')
    serverConfigDraft.value = normalizeServerConfig(response.data)
    showServerConfigDialog.value = true
  } catch (error) {
    console.error('获取服务器配置失败:', error)
    notificationService.error({
      title: '获取失败',
      message: '无法获取服务器配置，请检查服务器连接'
    })
  } finally {
    isLoadingServerConfig.value = false
  }
}

async function saveServerConfig(updatedConfig: ServerConfig): Promise<void> {
  isSavingServerConfig.value = true
  try {
    const response = await request.post('/api/update_config', { data: updatedConfig })
    const result = response.data
    if (result?.config && serverConfigDraft.value) {
      serverConfigDraft.value = mergeServerConfig(
        serverConfigDraft.value,
        result.config as Record<string, unknown>
      )
    }

    notificationService.success({
      title: '保存成功',
      message: result?.message || '配置更新成功'
    })
    showServerConfigDialog.value = false
  } catch (error) {
    console.error('保存服务器配置失败:', error)
    notificationService.error({
      title: '保存失败',
      message: '配置更新失败，请稍后重试'
    })
  } finally {
    isSavingServerConfig.value = false
  }
}

// 打开项目
const openProjectHomepage = (): void => {
  window.api.openExternal('https://github.com/Mios-dream/MoeChat')
}

// 打开App页
const openSupportPage = (): void => {
  window.api.openExternal('https://github.com/Mios-dream/Meochat-APP')
}

// 监听更新状态
const removeUpdateStatusListener = window.api.appUpdate.onStatus((msg) => {
  console.log('状态更新:', msg)
  notificationService.info({
    title: '状态更新',
    message: msg
  })
})

// 监听下载进度
const removeUpdateProgressListener = window.api.appUpdate.onProgress((percent) => {
  downloadProgress.value = percent
  console.log('下载进度:', percent)
})

onUnmounted(() => {
  removeUpdateStatusListener()
  removeUpdateProgressListener()
})

async function checkForUpdatesAndConfirm(): Promise<void> {
  isCheckingUpdate.value = true
  try {
    const result = await window.api.appUpdate.checkForUpdate()

    console.log('检查结果:', result)

    if (result.updateAvailable) {
      newVersion.value = result.version || ''
      releaseNotes.value = result.releaseNotes || ''
      showUpdateModal.value = true
    }
  } finally {
    isCheckingUpdate.value = false
  }
}

// 确认更新
async function confirmUpdate(): Promise<void> {
  showDownloadProgress.value = true
  try {
    await window.api.appUpdate.confirmUpdate()
  } catch (error) {
    console.error('更新失败:', error)
  }
}

// 开机启动需要特殊处理（调用 Electron API）
const handleAutoStartChange = async (value: boolean): Promise<void> => {
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
    // 简单格式校验 - 支持带协议和不带协议的格式
    const withoutProtocol = address.replace(/^https?:\/\//i, '')
    const urlPattern = /^[\w.-]+:\d+$/
    if (!urlPattern.test(withoutProtocol)) {
      return false
    }

    // 实际网络连接测试
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5秒超时

    const normalizedUrl = address.startsWith('http') ? address : `http://${address}`
    const response = await fetch(`${normalizedUrl}/api/health`, {
      method: 'GET',
      signal: controller.signal
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
const handleValidation = (isValid: boolean): void => {
  if (!isValid) {
    console.log('服务器地址校验失败')
    // 可以在这里添加额外的错误处理逻辑
  }
}

/**
 * 处理核心运行模式切换
 * 切换到API模式时，自动停止本地后端服务
 */
async function handleKernelModeChange(mode: 'local' | 'api'): Promise<void> {
  if (mode === 'api') {
    // 切换到API模式时，停止本地后端服务
    try {
      await window.api.kernel.stopBackend()
      console.log('已停止本地后端服务')
    } catch (error) {
      console.error('停止后端服务失败:', error)
    }
  }
  configStore.updateConfig('kernelMode', mode)
}

function change<K extends keyof typeof config.value>(
  key: K,
  value: (typeof config.value)[K]
): void {
  if (key === 'autoStartOnBoot') {
    handleAutoStartChange(value as boolean)
    return
  }
  if (key === 'kernelMode') {
    handleKernelModeChange(value as 'local' | 'api')
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
  scrollbar-width: none;
  margin-bottom: 100px;
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
  background-color: rgba(255, 255, 255, 0.8);
  border-radius: 15px;
  padding: 20px;
  flex-direction: column;
  margin-bottom: 20px;
  margin-top: 10px;
}

.setting-form {
  height: 40px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.setting-form .title {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
}

.setting-form .title .description {
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
  background-color: var(--theme-color);
  box-shadow: 0 4px 12px rgba(251, 114, 153, 0.3);
  border: 2px solid transparent;
  color: white;
  border-radius: 50px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.support-button:hover {
  background-color: var(--theme-color);
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

.color-picker-container {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
}

.color-picker-wrapper {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #ddd;
  box-sizing: border-box;
  transition:
    transform 0.2s,
    border-color 0.2s;
}

.color-picker-wrapper:hover {
  transform: scale(1.1);
  border-color: var(--theme-color);
}

.color-preview {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.1);
}

.color-input {
  position: absolute;
  right: 0;
  display: flex;
  width: 0;
  height: 0;
  opacity: 0;
}

.color-value {
  font-family: monospace;
  font-size: 14px;
  color: var(--theme-color);
}

/* ─── 模式切换器 ────────────────────────────────────── */

.mode-switcher {
  display: flex;
  gap: 0;
  border-radius: 25px;
  border: 2px solid transparent;
}

.mode-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 16px;
  border: 2px solid transparent;
  border-radius: 20px;
  background: transparent;
  color: #888;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  letter-spacing: 0.05em;
  min-width: 80px;
}

.mode-btn.active {
  color: #fff;
  background-color: var(--theme-color);
  border: 2px solid var(--theme-color);
  box-shadow: 0 4px 12px rgba(251, 114, 153, 0.3);
}

.mode-btn:not(.active):hover {
  color: var(--theme-color);
}
</style>
