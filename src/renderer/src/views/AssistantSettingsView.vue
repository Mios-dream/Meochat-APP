<!-- src/views/AssistantSettingsView.vue —— 桌宠助手悬浮设置面板 -->
<template>
  <div class="settings-panel">
    <div class="panel-header">
      <span class="panel-title">桌宠设置</span>
      <div class="header-actions">
        <div class="close-button" @click="closeWindow">
          <font-awesome-icon icon="fa-solid fa-xmark" />
        </div>
      </div>
    </div>

    <div class="panel-body">
      <div class="setting-item">
        <div class="assistant-switch-row">
          <div class="label-group">
            <label>切换助手</label>
          </div>
        </div>
        <div class="assistant-list">
          <div
            v-for="assistant in assistants"
            :key="assistant.name"
            class="assistant-tag"
            :class="{ active: assistant.name === currentAssistantName }"
            :style="
              assistant.avatar
                ? {
                    backgroundImage: `url(${'app-resource://' + assistant.avatar}?t=${Date.now()})`
                  }
                : {}
            "
            @click="switchAssistant(assistant.name)"
          >
            <!-- 切换加载覆盖层 -->
            <div
              v-if="isSwitchingAssistant && assistant.name === nextAssistantName"
              class="assistant-tag-loading"
            >
              <div class="assistant-tag-spinner"></div>
            </div>
          </div>
        </div>
      </div>
      <!-- 桌宠大小 -->
      <div class="section-title">显示设置</div>
      <div class="setting-item">
        <form class="setting-row">
          <div class="label-group">
            <label>桌宠大小</label>
            <div class="description">调整桌宠助手大小</div>
          </div>
          <div class="size-control">
            <input
              v-model.number="petSizePercent"
              type="range"
              min="70"
              max="400"
              step="5"
              class="scale-slider"
              @change="onSizeChange"
            />
            <span class="scale-value">{{ petSizePercent }}%</span>
          </div>
        </form>
      </div>
      <div class="section-title">互动设置</div>
      <div class="setting-item">
        <form class="setting-row">
          <div class="label-group">
            <label>自动回复</label>
            <div class="description">开启后助手会在适当时机主动发起聊天</div>
          </div>
          <ToggleSwitch
            :model-value="config.autoChat"
            @update:model-value="(v) => updateConfig('autoChat', v)"
          />
        </form>
        <div class="divider"></div>
        <div class="divider"></div>
        <form class="setting-row">
          <div class="label-group">
            <label>安静模式</label>
            <div class="description">开启后暂停所有自动交互</div>
          </div>
          <ToggleSwitch
            :model-value="config.quietMode"
            @update:model-value="(v) => updateConfig('quietMode', v)"
          />
        </form>
        <div class="divider"></div>
        <form class="setting-row">
          <div class="label-group">
            <label>桌面台词板</label>
            <div class="description">在桌面显示助手台词板</div>
          </div>
          <ToggleSwitch
            :model-value="config.desktopSpeechBoard"
            @update:model-value="(v) => updateConfig('desktopSpeechBoard', v)"
          />
        </form>
        <div class="divider"></div>
        <form class="setting-row">
          <div class="label-group">
            <label>助手音量</label>
          </div>
          <div class="volume-control">
            <input
              v-model.number="volumePercent"
              type="range"
              min="0"
              max="100"
              step="1"
              class="scale-slider"
              @input="onVolumeChange"
            />
            <span class="scale-value">{{ volumePercent }}%</span>
          </div>
        </form>
        <div class="divider"></div>
        <form class="setting-row">
          <div class="label-group">
            <label>随机行为</label>
            <div class="description">助手偶尔会和阁下产生互动</div>
          </div>
          <ToggleSwitch
            :model-value="config.idleEvent"
            @update:model-value="(v) => updateConfig('idleEvent', v)"
          />
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import ToggleSwitch from '../components/ToggleSwitch.vue'
import { useConfigStore } from '../stores/useConfigStore'
import { storeToRefs } from 'pinia'
import { AssistantManager, type AssistantInfo } from '../services/assistantManager'

const configStore = useConfigStore()
const { config } = storeToRefs(configStore)
const assistantManager = AssistantManager.getInstance()

/** 桌宠窗口尺寸百分比 (70% ~ 150%) */
const petSizePercent = ref(100)
/** 基准宽度 */
const BASE_WIDTH = 300
/** 基准高度 */
const BASE_HEIGHT = 500
/** 音量百分百值 */
const volumePercent = ref(80)
/** 已加载的助力列表 */
const assistants = ref<AssistantInfo[]>([])
/** 当前助手名称 */
const currentAssistantName = ref('')
/** 是否正在切换助手 */
const isSwitchingAssistant = ref(false)
/** 下一个待切换的助手名称（用于触发加载动画） */
const nextAssistantName = ref('')

/**
 * 关闭当前设置窗口
 */
function closeWindow(): void {
  window.api.closeAssistantSettings()
}

/**
 * 更新配置项
 * @param key 配置键
 * @param value 新值
 */
function updateConfig<K extends keyof typeof config.value>(
  key: K,
  value: (typeof config.value)[K]
): void {
  configStore.updateConfig(key, value)
}

/**
 * 尺寸滑块变更：向主进程发送窗口 resize 指令
 */
function onSizeChange(): void {
  const scale = petSizePercent.value / 100
  const width = Math.round(BASE_WIDTH * scale)
  const height = Math.round(BASE_HEIGHT * scale)
  window.api.resizeAssistant(width, height)
  saveLocalSize()
}

/**
 * 音量滑块变更
 */
function onVolumeChange(): void {
  const normalized = clampVolume(volumePercent.value / 100)
  configStore.updateConfig('volume', normalized)
}

/**
 * 切换助手
 * @param name 助手名称
 */
async function switchAssistant(name: string): Promise<void> {
  // 防止重复点击或切换相同助手
  if (name === currentAssistantName.value || isSwitchingAssistant.value) return
  // 先记录下一个助手名称，触发加载动画
  nextAssistantName.value = name
  isSwitchingAssistant.value = true
  try {
    await assistantManager.setCurrentAssistant(name)
    currentAssistantName.value = name
  } finally {
    isSwitchingAssistant.value = false
  }
}

/**
 * 初始化：从持久化存储加载 petSizePercent
 */
function loadLocalSize(): void {
  try {
    const raw = localStorage.getItem('petSizePercent')
    if (raw) {
      const v = parseFloat(raw)
      if (Number.isFinite(v) && v >= 70 && v <= 400) {
        petSizePercent.value = v
      }
    }
  } catch {
    // 忽略
  }
}

/**
 * 持久化 petSizePercent
 */
function saveLocalSize(): void {
  localStorage.setItem('petSizePercent', String(petSizePercent.value))
}

function clampVolume(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0.8))
}

/**
 * 从 config 同步 volumePercent
 */
function syncVolumeFromConfig(): void {
  const raw = config.value.volume
  const normalized = clampVolume(raw)
  const pct = Math.round(normalized * 100)
  if (volumePercent.value !== pct) {
    volumePercent.value = pct
  }
}

onMounted(async () => {
  loadLocalSize()
  syncVolumeFromConfig()

  // 触发助手数据加载（主进程后台同步完成后会广播 assistant:data-updated）
  window.api.assistant.loadAssistantData()

  // 监听助手数据更新事件：后台同步完成后会携带完整的助手列表和当前助手
  window.api.ipcRenderer.on('assistant:data-updated', (data) => {
    const updateData = data as { assistants?: AssistantInfo[]; currentAssistant?: AssistantInfo }
    if (updateData?.assistants) {
      assistants.value = updateData.assistants
    }
    if (updateData?.currentAssistant) {
      currentAssistantName.value = updateData.currentAssistant.name
    }
  })

  // 同时主动拉取一次内存中的缓存数据（避免等后台同步太久）
  try {
    const result = await window.api.assistant.getAllAssistants()
    if (result?.data?.length) {
      assistants.value = result.data
    }
  } catch {
    // 忽略
  }

  try {
    const current = await assistantManager.getCurrentAssistant()
    if (current) {
      currentAssistantName.value = current.name
    }
  } catch {
    // 忽略
  }

  // 监听助手切换事件，同步当前选中状态
  window.api.onAssistantSwitched?.((assistant) => {
    if (assistant) {
      currentAssistantName.value = assistant.name
    }
  })
})

// petSizePercent 变更时持久化
watch(petSizePercent, () => saveLocalSize())

// 音量配置变更时同步滑块
watch(
  () => config.value.volume,
  () => syncVolumeFromConfig()
)
</script>

<style scoped>
.settings-panel {
  width: 100vw;
  height: 100vh;
  /* background-color: rgba(255, 255, 255, 0.96); */
  background: #f7f7f7;
  backdrop-filter: blur(10px);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(251, 114, 153, 0.15);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  background: #fb7299;
  color: white;
  user-select: none;
  -webkit-app-region: drag;
  app-region: drag;
}

.panel-title {
  font-size: 16px;
  font-weight: bold;
  letter-spacing: 1px;
}

.close-button {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
  -webkit-app-region: no-drag;
  app-region: no-drag;
}

.close-button:hover {
  background: rgba(255, 255, 255, 0.25);
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 18px 20px;
  scrollbar-width: thin;
  scrollbar-color: #ffc0d6 transparent;
}

.section-title {
  font-size: 13px;
  font-weight: bold;
  color: #fb7299;
  margin-top: 14px;
  margin-bottom: 6px;
  padding-left: 4px;
}

.setting-item {
  background: white;
  border-radius: 10px;
  padding: 12px 14px;
  margin-bottom: 8px;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 36px;
}

.label-group {
  display: flex;
  flex-direction: column;
}

.label-group label {
  font-size: 14px;
  color: #333;
  font-weight: 500;
}

.description {
  font-size: 11px;
  color: #999;
  margin-top: 2px;
}

.divider {
  width: 100%;
  height: 1px;
  background: #f0e0e4;
  margin: 8px 0;
}

/* 助手切换标签 */
.assistant-switch-row {
  margin-bottom: 8px;
}

.assistant-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.assistant-tag {
  position: relative;
  width: 80px;
  height: 80px;
  border-radius: 14px;
  background-size: cover;
  background-position: center;
  font-size: 12px;
  color: #666;
  background-color: #f5f5f5;
  border: 2px solid rgba(255, 255, 255, 0.85);
  cursor: pointer;
  transition: all 0.2s;
}

.assistant-tag:hover {
  background-color: #ffecf0;
  border-color: #ffc0d6;
}

.assistant-tag.active {
  background-color: #fb7299;
  color: white;
  border-color: #fb7299;
}

.assistant-tag-loading {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.85);
  border-radius: 14px;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10;
}

.assistant-tag-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid #f3f3f3;
  border-top: 2px solid #fb7299;
  border-radius: 50%;
  animation: assistant-tag-spin 1s linear infinite;
}

@keyframes assistant-tag-spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

/* 滑块控件 */
.size-control,
.volume-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.scale-slider {
  width: 100px;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: #ffc0d6;
  border-radius: 2px;
  outline: none;
}

.scale-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fb7299;
  cursor: pointer;
  box-shadow: 0 0 4px rgba(251, 114, 153, 0.3);
}

.scale-value {
  font-size: 12px;
  color: #fb7299;
  font-weight: bold;
  min-width: 36px;
  text-align: right;
}
</style>
