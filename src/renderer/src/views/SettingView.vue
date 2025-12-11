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
          <div class="divider"></div>
          <form class="setting-from">
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
          <form class="setting-from">
            <div class="title">
              <label for="lock-assistant">服务器地址</label>
              <div class="description">连接到MeoChat的服务器地址</div>
            </div>
            <div style="width: 300px; height: 40px">
              <SimpleInput
                :model-value="config.baseUrl"
                :validator="validateServerAddress"
                validation-error-message="无法连接到服务器"
                placeholder="127.0.0.1:8001"
                @update:model-value="(v) => change('baseUrl', v as string)"
                @validated="handleValidation"
              />
            </div>
          </form>
        </div>
        <div class="setting-title">关于项目</div>
        <div class="setting-item" style="margin-bottom: 50px">
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
              <span class="version-text">v{{ currentVersion }}</span>
              <button
                class="update-button"
                :disabled="isCheckingUpdate"
                @click="checkForUpdatesAndConfirm"
              >
                {{ isCheckingUpdate ? '检查中...' : '检查更新' }}
              </button>
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
  </div>
</template>

<script setup lang="ts">
import ToggleSwitch from '../components/ToggleSwitch.vue'
import SimpleInput from '../components/SimpleInput.vue'
import UpdateModal from '../components/UpdateDialog.vue'
import { useConfigStore } from '../stores/useConfigStore'
import { NotificationService } from '../services/NotificationService'
import { storeToRefs } from 'pinia'
import { ref, onMounted } from 'vue'

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
  currentVersion.value = await window.api.getCurrentVersion()
})
// 打开项目
const openProjectHomepage = (): void => {
  window.api.openExternal('https://github.com/Mios-dream/MoeChat')
}

// 打开App页
const openSupportPage = (): void => {
  window.api.openExternal('https://github.com/Mios-dream/Meochat-APP')
}

// 监听更新状态
window.api.onStatus((msg) => {
  console.log('状态更新:', msg)
  notificationService.info({
    title: '状态更新',
    message: msg
  })
})

// 监听下载进度
window.api.onProgress((percent) => {
  downloadProgress.value = percent
  console.log('下载进度:', percent)
})

async function checkForUpdatesAndConfirm(): Promise<void> {
  isCheckingUpdate.value = true
  try {
    const result = await window.api.checkForUpdate()

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
    await window.api.confirmUpdate()
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
function change<K extends keyof typeof config.value>(
  key: K,
  value: (typeof config.value)[K]
): void {
  if (key === 'autoStartOnBoot') {
    handleAutoStartChange(value as boolean)
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
  background-color: var(--theme-color-light);
  color: white;
  border: none;
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

/* 更新按钮样式 */
.update-button {
  padding: 8px 16px;
  background-color: transparent;
  color: var(--theme-color-light);
  border: 2px solid var(--theme-color-light);
  border-radius: 50px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.update-button:hover:not(:disabled) {
  color: white;
  background-color: var(--theme-color);
  border: 2px solid var(--theme-color);
}

.update-button:disabled {
  color: white;
  background-color: var(--theme-color);
  border: 2px solid var(--theme-color);
  cursor: not-allowed;
}

.color-picker-container {
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
  display: flex;
  width: 0;
  height: 0;
}

.color-value {
  font-family: monospace;
  font-size: 14px;
  color: var(--theme-color);
}

/* 下载进度悬浮窗样式 */
/* .download-progress-float {
  position: fixed;
  top: 50px;
  right: 40px;
  width: 300px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  border-radius: 10px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  z-index: 2000;
  overflow: hidden;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 15px;
  background: #fca9c2;
  color: white;
  font-weight: 500;
}

.close-btn {
  background: none;
  border: none;
  color: white;
  font-size: 20px;
  cursor: pointer;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.progress-content {
  padding: 15px;
}

.progress-bar-container {
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 10px;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #fca9c2, #fb7299);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-text {
  text-align: center;
  font-weight: 600;
  color: #fb7299;
} */
</style>
