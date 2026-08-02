<template>
  <div class="background-container">
    <div class="dashboard-content">
      <div style="margin: 8px">
        <h1 class="page-title">助手管理</h1>
        <p class="page-title-description">管理助手状态、配置和相关信息</p>
      </div>
      <div id="assistant-container-background">
        <div id="assistant-container-background-inner"></div>

        <div id="assistant-container">
          <div id="assistant-component-container">
            <div id="assistant-work-time">
              <div class="content">
                <div id="work-time">
                  {{
                    assistantInfo?.userState.firstMeetTime
                      ? Math.floor(
                          (Date.now() / 1000 - assistantInfo.userState.firstMeetTime) /
                            (60 * 60 * 24)
                        )
                      : 0
                  }}天
                </div>
                <div class="title">已经陪伴阁下</div>
              </div>
            </div>
            <div id="assistant-love">
              <div
                class="head-img"
                :style="{
                  backgroundImage: `url(${assistantInfo?.avatar ? 'app-resource://' + assistantInfo?.avatar : '../assets/images/assistant_avatar_small.png'})`
                }"
              ></div>
              <div class="name">{{ assistantInfo?.name }}</div>
              <div class="progress-container">
                <div id="love-icon"><font-awesome-icon icon="fa-solid fa-heart" /></div>
                <div class="progress-bar-background">
                  <div class="progress-bar-fill" :style="{ width: `${lovePercentage}%` }"></div>
                </div>
              </div>
              <div class="love-level">一级</div>
            </div>
          </div>
          <div id="assistant-cover">
            <div
              id="assistant-image"
              :class="{ 'office-mode': isAssistantOpen }"
              :data-state="isAssistantOpen ? 'office' : 'normal'"
            ></div>
            <div id="assistant-status-container">
              <div id="assistant-status" :class="{ active: isAssistantOpen }">
                <svg viewBox="0 0 50 27" version="1.1">
                  <path
                    d="M36.7786459,0 C37.9213239,0 39.1207848,1.792704 40.3770287,5.378112 C45.7928925,5.99546744 50,10.5930138 50,16.1731827 C50,22.1731644 45.1360538,27.0371106 39.1360721,27.0371106 L10.8639279,27.0371106 C4.86394618,27.0371106 7.34785836e-16,22.1731644 0,16.1731827 C-6.73362532e-16,10.6747604 4.08474644,6.13038169 9.38524286,5.4090431 C10.6461657,1.80275089 11.8491424,0 12.9950178,0 C14.1302391,0 16.6110105,1.76938338 20.437332,5.30815013 L29.3363317,5.30815013 C33.1626532,1.76938338 35.6434246,0 36.7786459,0 Z"
                  ></path>
                </svg>
                <div class="status-text">
                  {{ isAssistantOpen ? '任职中' : '休息中' }}
                </div>
              </div>
            </div>
          </div>
          <div id="assistant-info">
            <div id="assistant-name">{{ assistantInfo?.name }}</div>
            <div id="assistant-organization">隶属于澪之梦工作室</div>
            <div id="assistant-basic-info">
              <span class="title">生日</span
              ><span id="assistant-birthday" class="content">{{
                formatBirthday(assistantInfo?.birthday)
              }}</span>
              <span class="title">身高</span
              ><span id="assistant-constellation" class="content"
                >{{ assistantInfo?.height }}cm</span
              >
            </div>
            <div id="assistant-introduction">
              <div class="introduction-text">
                {{ assistantInfo?.description }}
              </div>
            </div>
          </div>
        </div>
        <button id="assistant-button" @click="toggleAssistant()">
          <div id="assistant-button-icon"></div>
          <div id="assistant-button-text">
            {{ isAssistantOpen ? '休息' : '启用' }}
          </div>
        </button>
      </div>
      <div class="assistant-select-container">
        <div class="title">助手列表</div>
        <Loader v-if="assistantListLoading" class="loading-spinner"></Loader>
        <div class="add-assistant" @click="openAddAssistantDialog">
          添加助手
          <font-awesome-icon class="add-assistant-icon" icon="fa-solid fa-plus" />
        </div>
        <div class="assistant-list">
          <div
            v-for="assistant in assistantList"
            :key="assistant.name"
            class="assistant-item"
            :class="{
              active: assistant.name === assistantInfo?.name,
              syncing: isAssistantSyncing(assistant.name)
            }"
            @click="selectAssistant(assistant)"
            @contextmenu.prevent="showContextMenu($event, assistant)"
          >
            <div
              class="assistant-avatar"
              :class="{ active: assistant.name === assistantInfo?.name }"
              :style="
                assistant.avatar
                  ? {
                      backgroundImage: `url(${'app-resource://' + assistant.avatar}?t=${Date.now()})`
                    }
                  : {}
              "
            ></div>
            <div class="assistant-content">
              <div class="assistant-name">{{ assistant.name }}</div>
              <div
                class="assistant-status"
                :class="{ syncing: isAssistantSyncing(assistant.name) }"
              >
                {{
                  isAssistantSyncing(assistant.name)
                    ? '同步中'
                    : assistant.name === assistantInfo?.name
                      ? '任职中'
                      : '休息中'
                }}
              </div>
              <div class="love-progress-container">
                <div class="love-level">好感度</div>
                <div class="progress-container">
                  <div id="love-icon"><font-awesome-icon icon="fa-solid fa-heart" /></div>
                  <div class="progress-bar-background">
                    <div
                      class="progress-bar-fill"
                      :style="{
                        width: `${Math.max(0, Math.min(100, assistant.userState.love))}%`
                      }"
                    ></div>
                  </div>
                </div>
              </div>
            </div>
            <!-- 在助手头像上添加加载动画 -->
            <div
              v-if="isSwitchingAssistant && assistant.name === nextAssistantInfo?.name"
              class="avatar-loading-overlay"
            >
              <div class="spinner"></div>
            </div>
            <!-- 助手资源同步状态覆盖层（仅展示是否在更新） -->
            <div v-if="isAssistantSyncing(assistant.name)" class="sync-progress-overlay">
              <div class="sync-progress-content">
                <div class="sync-progress-icon">
                  <font-awesome-icon icon="fa-solid fa-arrow-down" />
                </div>
                <div class="sync-progress-text">资源更新中</div>
              </div>
            </div>
          </div>
          <!-- 助手列表为空时的空态提示 -->
          <div v-if="!assistantListLoading && assistantList.length === 0" class="assistant-empty">
            <font-awesome-icon icon="fa-solid fa-user" class="assistant-empty-icon" />
            <span class="assistant-empty-text">暂无助手</span>
          </div>
        </div>
      </div>
      <!-- 选择添加方式对话框 -->
      <BlurModal v-model="isVisibleSelectMethodDialog">
        <div class="select-method-dialog">
          <div class="dialog-title">选择添加方式</div>
          <div class="dialog-description">请选择您想要如何添加新助手</div>

          <div class="options-container">
            <div class="option-item" @click="handleManualAdd">
              <div class="option-icon">
                <font-awesome-icon icon="fa-solid fa-pen-to-square" />
              </div>
              <div class="option-content">
                <div class="option-title">手动创建</div>
                <div class="option-description">从头开始创建一个全新的助手角色</div>
              </div>
            </div>

            <div class="option-item" @click="handleImportCharacterCard">
              <div class="option-icon">
                <font-awesome-icon icon="fa-solid fa-download" />
              </div>
              <div class="option-content">
                <div class="option-title">导入角色卡</div>
                <div class="option-description">通过导入图片角色卡快速创建助手</div>
              </div>
            </div>

            <div class="option-item" @click="handleImportZipPackage">
              <div class="option-icon">
                <font-awesome-icon icon="fa-solid fa-file-zipper" />
              </div>
              <div class="option-content">
                <div class="option-title">导入zip角色包</div>
                <div class="option-description">导入包含 info.yaml 和 assets 的角色资源包</div>
              </div>
            </div>
          </div>
        </div>
      </BlurModal>
      <EditAssistantDialog
        v-model="isVisibleAddAssistantDialog"
        :editing-assistant="null"
        :is-import-from-card="isImportFromCard"
        :is-edit-mode="false"
        @cancel="closeAddAssistantDialog"
        @success="handleAssistantUpdated"
      />

      <!-- 添加编辑助手对话框 -->
      <EditAssistantDialog
        v-model="isVisibleEditAssistantDialog"
        :editing-assistant="editingAssistant"
        :is-edit-mode="true"
        @cancel="handleEditCancel"
        @success="handleAssistantUpdated"
      />
    </div>
    <ContextMenu
      :visible="contextMenuVisible"
      :style="contextMenuStyle"
      :items="contextMenuItems"
    />
    <ConfirmDialog
      v-model="showConfirmDialog"
      title="删除助手"
      :message="confirmMessage"
      @confirm="handleConfirmDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted, onActivated } from 'vue'
import { useConfigStore } from '../stores/useConfigStore'
import ContextMenu from '../components/Toolbar.vue'
import { AssistantInfo, AssistantManager } from '../services/assistantManager'
import EditAssistantDialog from '../components/main/EditAssistantDialog.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import Loader from '../components/Loader.vue'
import BlurModal from '../components/BlurModal.vue'
import { NotificationService } from '../services/NotificationService'

// 通知服务实例（用于拦截删除默认助手时的提示）
const notificationService = NotificationService.getInstance()

// 从配置存储中获取配置
const configStore = useConfigStore()

// 状态跟踪助手窗口是否打开
const isAssistantOpen = ref(false)
// 助手管理器实例
const assistantManager = AssistantManager.getInstance()
// 当前助手信息
const assistantInfo = ref<AssistantInfo | null>(null)
const nextAssistantInfo = ref<AssistantInfo | null>()
// 当前助手的好感度（范围 -50~100，低于 0 不显示）
const currentLove = computed(() => assistantInfo.value?.userState.love ?? 0) // 当前好感度值
// 助手列表
const assistantList = ref<AssistantInfo[]>([])
// 是否可见添加助手对话框
const isVisibleAddAssistantDialog = ref(false)
// 是否显示选择添加方式对话框
const isVisibleSelectMethodDialog = ref(false)
// 是否正在加载助手列表
const assistantListLoading = ref(true)
// 是否从角色卡导入
const isImportFromCard = ref(false)
// 是否正在切换助手
const isSwitchingAssistant = ref(false)

// 正在同步资源的助手名称集合（前端仅需展示「是否在更新」，无需关心具体进度）
const assistantSyncing = ref<Set<string>>(new Set())

// 事件监听清理函数
let removeUploadProgress: () => void = () => {}
let removeDownloadProgress: () => void = () => {}
let removeDataUpdated: () => void = () => {}

// 检查助手是否正在同步
function isAssistantSyncing(assistantName: string): boolean {
  return assistantSyncing.value.has(assistantName)
}

// 计算进度百分比（好感度范围 -50~100，低于 0 按 0 显示，最大 100%）
const lovePercentage = computed(() => {
  return Math.max(0, Math.min(100, currentLove.value))
})

// 右键菜单状态
const contextMenuVisible = ref(false)
const contextMenuStyle = ref({ top: '0px', left: '0px' })
const contextMenuAssistant = ref<AssistantInfo | null>(null)

// 编辑助手状态
const isVisibleEditAssistantDialog = ref(false)
const editingAssistant = ref<AssistantInfo | null>(null)

// 确认对话框相关状态
const showConfirmDialog = ref(false)
const confirmMessage = ref('')
const assistantToDelete = ref('')

// 选择助手
async function selectAssistant(assistant: AssistantInfo): Promise<void> {
  // 如果助手正在同步资源，禁止选择
  if (isAssistantSyncing(assistant.name)) {
    notificationService.warning({
      message: `「${assistant.name}」正在同步资源中，请稍候...`
    })
    return
  }

  // 先设置下一个助手信息，触发加载动画
  nextAssistantInfo.value = assistant
  // 设置加载状态为true
  isSwitchingAssistant.value = true
  try {
    await assistantManager.setCurrentAssistant(assistant.name)
    assistantInfo.value = await assistantManager.getCurrentAssistant()
  } finally {
    // 切换完成后，设置加载状态为false
    isSwitchingAssistant.value = false
  }
}

// 计算属性
const contextMenuItems = computed(() => {
  // 如果助手正在同步中，禁用右键菜单
  if (contextMenuAssistant.value && isAssistantSyncing(contextMenuAssistant.value.name)) {
    return [
      {
        icon: 'fa-solid fa-spinner',
        text: '同步中...',
        action: () => {} // 空操作
      }
    ]
  }

  const items = [
    {
      icon: 'fa-solid fa-pen',
      text: '编辑',
      action: () => handleEditAssistant(contextMenuAssistant.value!)
    },
    {
      icon: 'fa-solid fa-trash',
      text: '删除',
      action: () => handleDeleteAssistant(contextMenuAssistant.value!.name)
    }
  ]

  return items
})

// 显示右键菜单
function showContextMenu(event: MouseEvent, assistant: AssistantInfo): void {
  contextMenuStyle.value = {
    top: `${event.clientY}px`,
    left: `${event.clientX}px`
  }
  contextMenuAssistant.value = assistant
  contextMenuVisible.value = true
}

// 隐藏右键菜单
function hideContextMenu(): void {
  contextMenuVisible.value = false
  contextMenuAssistant.value = null
}

// 处理编辑助手
function handleEditAssistant(assistant: AssistantInfo): void {
  editingAssistant.value = { ...assistant }
  isVisibleEditAssistantDialog.value = true
  hideContextMenu() // 关闭右键菜单
}

// 处理编辑取消
function handleEditCancel(): void {
  isVisibleEditAssistantDialog.value = false
  editingAssistant.value = null
}

// 处理助手更新成功
function handleAssistantUpdated(): void {
  getAssistants()

  // 重置编辑状态
  editingAssistant.value = null
}

async function getAssistants(): Promise<void> {
  assistantListLoading.value = true
  assistantList.value = await assistantManager.getAssistants()
  assistantInfo.value = await assistantManager.getCurrentAssistant()
  assistantListLoading.value = false
}

// 处理删除助手
async function handleDeleteAssistant(name: string): Promise<void> {
  // 设置确认对话框信息
  confirmMessage.value = `每一次的陪伴都值得珍藏，确定要与"${name}"就此告别吗？`
  assistantToDelete.value = name
  // 显示确认对话框
  showConfirmDialog.value = true
}

// 处理确认删除
async function handleConfirmDelete(): Promise<void> {
  if (!assistantToDelete.value) return

  const status = await assistantManager.deleteAssistant(assistantToDelete.value)
  if (status.success) {
    assistantList.value = await assistantManager.getAssistants()
    // 更新当前助手信息
    if (assistantInfo.value?.name === assistantToDelete.value) {
      assistantInfo.value = await assistantManager.getCurrentAssistant()
    }
  } else {
    console.error('删除助手失败', status.message)
  }

  // 重置状态
  assistantToDelete.value = ''
}

// 监听点击事件，点击其他地方关闭右键菜单
function handleClickOutside(event: MouseEvent): void {
  if (!contextMenuVisible.value) return
  const target = event.target as HTMLElement
  if (!target.closest('.context-menu') && !target.closest('.assistant-item')) {
    hideContextMenu()
  }
}

// 切换助手状态的函数
function toggleAssistant(): void {
  if (isAssistantOpen.value) {
    closeAssistant()
  } else {
    openAssistant()
  }
  configStore.updateConfig('assistantEnabled', isAssistantOpen.value)
}

// 格式化生日为"月日"格式
function formatBirthday(birthday?: string): string {
  if (!birthday) {
    return ''
  }
  const date = new Date(birthday)

  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  return `${month}月${day}日`
}
// 打开助手窗口
function openAssistant(): void {
  window.api.assistant.openAssistant()
  isAssistantOpen.value = true
}

// 关闭助手窗口
function closeAssistant(): void {
  window.api.assistant.closeAssistant()
  isAssistantOpen.value = false
}

// 打开添加助手对话框
function openAddAssistantDialog(): void {
  // 改为显示选择方式对话框
  isVisibleSelectMethodDialog.value = true
}

// 关闭添加助手对话框
function closeAddAssistantDialog(): void {
  isVisibleAddAssistantDialog.value = false
  isImportFromCard.value = false
}

// 处理手动添加
function handleManualAdd(): void {
  isImportFromCard.value = false
  isVisibleSelectMethodDialog.value = false
  isVisibleAddAssistantDialog.value = true
}

// 处理导入角色卡
function handleImportCharacterCard(): void {
  isImportFromCard.value = true
  isVisibleSelectMethodDialog.value = false
  isVisibleAddAssistantDialog.value = true
}

// 处理导入 zip 角色包
async function handleImportZipPackage(): Promise<void> {
  isVisibleSelectMethodDialog.value = false
  const selectResult = await window.api.system.selectFile({
    title: '选择zip角色包',
    buttonLabel: '导入',
    filters: [{ name: '角色压缩包', extensions: ['zip'] }]
  })

  if (!selectResult.success) {
    if (selectResult.error !== '取消选择') {
      notificationService.error({ message: selectResult.error })
    }
    return
  }

  assistantListLoading.value = true
  try {
    const importResult = await assistantManager.importAssistantFromZip(selectResult.filePath)
    if (!importResult.success) {
      notificationService.error({
        message: importResult.error || 'zip角色包导入失败'
      })
      return
    }

    await getAssistants()
  } catch (error) {
    notificationService.error({
      message: error instanceof Error ? error.message : 'zip角色包导入失败'
    })
  } finally {
    assistantListLoading.value = false
  }
}

// 处理助手资源下载/上传进度事件
//
// 兼容两种载荷：
// - 后台下载（首次启动/资源更新）：{ status, assistantName, progress }
// - 资产上传（添加/编辑助手）：{ assistantName, progress }
//
// 前端只需维护「助手是否正在同步」的集合状态，无需展示具体进度百分比。
function handleDownloadProgress(payload: {
  status?: string
  assistantName?: string
  progress?: number
}): void {
  const { status, assistantName, progress } = payload

  // 后台下载整体结束（completed / idle）：清空所有同步标记
  if (status === 'completed' || status === 'idle') {
    assistantSyncing.value = new Set()
    return
  }

  // checking 状态或缺少助手名：忽略
  if (!assistantName) {
    return
  }

  const newSet = new Set(assistantSyncing.value)

  // 下载中 / 上传进行中（未完成）：标记该助手正在同步
  if (status === 'downloading' || (progress !== undefined && progress < 100)) {
    newSet.add(assistantName)
  } else if (progress !== undefined && progress >= 100) {
    // 单个助手同步完成：移除标记
    newSet.delete(assistantName)
  }

  assistantSyncing.value = newSet
}

// 处理助手数据更新事件（后台云端同步完成后触发）
function handleAssistantDataUpdated(payload: {
  assistants: AssistantInfo[]
  currentAssistant: AssistantInfo | null
}): void {
  // console.log('助手数据已更新', payload)
  if (payload.assistants) {
    assistantList.value = payload.assistants
  }
  // 当前助手可能为 null（列表清空/后端删除全部助手），需显式清空，
  // 避免残留已删除助手的卡片展示。
  assistantInfo.value = payload.currentAssistant
}

// 当组件挂载时，获取助手状态
onMounted(() => {
  window.api.assistant.getAssistantStatus().then((status: boolean) => {
    isAssistantOpen.value = status
  })

  getAssistants()

  // 监听助手资源上传进度事件（添加/编辑助手时上传资产）
  removeUploadProgress = window.api.assistant.onUploadProgress(handleDownloadProgress)

  // 监听助手资源后台下载进度事件（首次启动/资源同步时下载资产）
  removeDownloadProgress = window.api.assistant.onDownloadProgress(handleDownloadProgress)

  // 监听助手数据更新事件
  removeDataUpdated = window.api.assistant.onAssistantDataUpdated(handleAssistantDataUpdated)

  // 添加事件监听
  document.addEventListener('click', handleClickOutside)
})

onActivated(() => {
  getAssistants()
})

onUnmounted(() => {
  assistantListLoading.value = true
  // 移除事件监听
  document.removeEventListener('click', handleClickOutside)
  // 移除助手资源上传/下载进度监听
  removeUploadProgress()
  removeDownloadProgress()
  // 移除助手数据更新监听
  removeDataUpdated()
})
</script>

<style scoped>
#assistant-container-background {
  width: 100%;
  height: 500px;
  margin-top: 50px;
  margin-bottom: 50px;
  background-color: white;
  background-image: url('../assets/images/char_background.png');
  background-size: 20px;
  border-radius: 20px;
  display: flex;
  justify-content: center;
  align-items: end;
  position: relative;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
}

#assistant-container-background-inner {
  position: absolute;
  left: 0;
  width: 70px;
  height: 500px;
  overflow: hidden;
  border-radius: 20px 0 0 20px;
  background-image: url('../assets/images/assistant_show.png');
  background-size: contain;
  background-repeat: no-repeat;
}

#assistant-component-container {
  width: auto;
  height: 100%;
  padding: 20px;
  position: absolute;
  left: 30px;
}

#assistant-love {
  width: 110px;
  height: 110px;
  position: relative;
  background-color: white;
  /* background: linear-gradient(to top left, #fbd786, #fb7299); */
  border: 1px solid #ffc0d6;
  border-radius: 20px;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  margin-bottom: 20px;
}

#assistant-work-time {
  width: 110px;
  height: 110px;
  position: relative;
  background-color: white;
  border: 1px solid #ffc0d6;
  border-radius: 20px;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  margin-bottom: 20px;
}

#assistant-work-time .content {
  z-index: 1;
}

#work-time-background {
  position: absolute;
  color: #ffb3cd;
  font-size: 120px;
  z-index: 0;
}

#assistant-love {
  align-items: start;
  padding: 10px;
}

#assistant-love .head-img {
  width: 100%;
  height: 50px;
  border-radius: 10px;
  background-color: #ffcddec9;
  margin-bottom: 3px;
  background-size: 100% auto;
  background-repeat: no-repeat;
  background-position: 50% 30%;
}

#assistant-love .name {
  height: 13px;
  color: #fb7299;
  font-weight: bold;
  font-family: 'LoliFont';
  font-size: 13px;
}

#assistant-love .love-level {
  color: gray;
  font-size: 10px;
}

/* 进度条容器 */
.progress-container {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

/* 进度条背景 */
.progress-bar-background {
  width: 100%;
  height: 6px;
  background-color: #ffe6f0; /* 淡粉色背景 */
  border-radius: 3px;
  overflow: hidden;
}

/* 进度条填充 */
.progress-bar-fill {
  height: 100%;
  background-color: #fb7299; /* 粉色进度条 */
  border-radius: 3px;
  transition: width 0.3s ease;
}

/* 进度文本样式 */
#love-icon {
  color: #fb7299;
  font-size: 12px;
  font-weight: bold;
}

#assistant-work-time #work-time {
  color: #fb7299;
  font-size: 20px;
  font-weight: bold;
}

#assistant-work-time .title {
  color: #fb7299;
  font-size: 12px;
}

#assistant-container {
  width: auto;
  height: 500px;
  position: relative;
  overflow: visible;
  display: flex;
  flex-direction: row;
}

#assistant-cover {
  width: 400px;
  height: 100%;
  position: relative;
  margin-left: 100px;
}

#assistant-info {
  padding: 50px;
  max-width: 420px;
  height: 100%;
}

#assistant-name {
  color: #fb7299;
  font-size: 35px;
  font-weight: bold;
  font-family: 'LoliFont';
}

#assistant-organization {
  margin-top: 20px;
  width: fit-content;
  padding: 10px 10px;
  color: #a3abe5;
  background-color: #e6f4ff;
  border-radius: 10px;
  font-size: 20px;
  font-family: 'LoliFont';
  text-align: center;
}

#assistant-basic-info {
  margin-top: 20px;
  height: 50px;
  width: auto;
  font-family: 'LoliFont';
}
#assistant-basic-info .title {
  color: #ffb3cd;
  font-size: 15px;
  margin-right: 15px;
}

#assistant-basic-info .content {
  color: #ffb3cd;
  font-size: 25px;
  margin-right: 20px;
}

#assistant-introduction {
  margin-left: -20px;
  width: 440px;
  height: auto;

  background-image: url('../assets/images/backplane.png');
  background-size: 100%;
  background-repeat: no-repeat;
  background-position: top left;
  padding: 12% 4% 5% 9%;
  box-sizing: border-box;
  position: relative;
}

.introduction-text {
  width: 100%;
  height: 100%;
  max-height: 210px;
  color: gray;
  font-size: 15px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  line-clamp: 10;
  -webkit-line-clamp: 10;
  line-height: 1.4;
  word-wrap: break-word;
  word-break: break-word;
}

#assistant-status-container {
  width: 100px;
  height: auto;
  position: absolute;
  color: white;
  font-size: 20px;
  font-weight: bold;
  bottom: 100px;
  left: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

#assistant-status {
  width: 100%;
  height: 100%;
  position: relative;
}

#assistant-status:not(.active) path {
  fill: #fb7299;
}

#assistant-status.active path {
  fill: #7cc0ff;
}

.status-text {
  position: absolute;
  top: 60%;
  left: 50%;
  transform: translate(-50%, -60%);
  width: 100%;
  text-align: center;
  font-weight: bold;
  z-index: 1;
}
#assistant-image {
  width: 400px;
  height: 600px;
  position: absolute;
  bottom: 0;
  left: 20px;
  background-size: cover;
  background-position: top;
  background-repeat: no-repeat;
  transition: opacity 1s ease;
  opacity: 1;
}

#assistant-image::before,
#assistant-image::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-size: cover;
  background-position: top;
  background-repeat: no-repeat;
  transition: opacity 1s ease;
}

#assistant-image::before {
  background-image: url('../assets/images/assistant.png');
  opacity: 1;
}

#assistant-image::after {
  background-image: url('../assets/images/assistant_office.png');
  opacity: 0;
}

#assistant-image[data-state='office']::before {
  opacity: 0;
}

#assistant-image[data-state='office']::after {
  opacity: 1;
}

#assistant-button {
  position: absolute;
  bottom: 20px;
  width: 150px;
  height: 50px;
  /* backdrop-filter: blur(10px); */
  background-color: #fb7299cb;
  border-radius: 100px;
  /* box-shadow: 0 0 5px rgba(0, 0, 0, 0.2); */
  box-shadow: 0 0 10px #ffb3ce;
  cursor: pointer;
  display: flex;
  justify-content: start;
  align-items: center;
  padding: 5px;
  border: none;
}

#assistant-button-icon {
  width: 40px;
  height: 40px;
  border-radius: 100%;
  padding: 10px;
  /* background-color: #ffb3cd; */
  background-color: white;
  background-image: url('../assets/images/momona_icon.png');
  background-size: 30px;
  background-position: center;
  background-repeat: no-repeat;
}

#assistant-button-text {
  /* color: #ffb3cd; */
  color: white;
  font-size: 20px;
  font-weight: bold;
  margin-left: 20px;
}

.assistant-select-container {
  position: relative;
  padding: 10px 20px;
  width: 100%;
  max-height: 310px;
  background-color: white;
  border-radius: 20px;
  margin-bottom: 100px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
}

.assistant-select-container .title {
  color: #fb7299;
  font-size: 20px;
  font-weight: bold;
  margin-left: 10px;
}

.assistant-list {
  margin-top: 10px;
  width: 100%;
  max-height: 260px;
  display: flex;
  justify-content: flex-start;
  align-items: center;
  gap: 30px 40px;
  padding: 10px;
  /* 换行 */
  flex-wrap: wrap;
  overflow-y: auto;
  scrollbar-width: none;
}

/* 助手列表为空时的空态提示 */
.assistant-empty {
  width: 100%;
  height: 160px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 10px;
  color: #b0b0b0;
}

.assistant-empty-icon {
  font-size: 32px;
  opacity: 0.6;
}

.assistant-empty-text {
  font-size: 14px;
}

.assistant-item {
  position: relative;
  display: flex;
  justify-content: start;
  align-items: center;
  width: 300px;
  height: 80px;
  border-radius: 15px;
  padding: 10px;
  background-size: cover;
  background-position: center;
  cursor: pointer;
  flex-shrink: 0;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.15);
  background-color: white;
  box-sizing: content-box;
  transition: all 0.4s ease-in-out;
}
.assistant-item.active {
  box-shadow: 0 0 10px var(--theme-color-light);
  transition: all 0.4s ease-in-out;
}

.assistant-item.syncing {
  border: 2px solid #ffb3cd;
  animation: card-sync-pulse 2s ease-in-out infinite;
  cursor: not-allowed;
  opacity: 0.85;
  pointer-events: auto;
}

@keyframes card-sync-pulse {
  0%,
  100% {
    box-shadow: 0 0 10px rgba(251, 114, 153, 0.2);
  }
  50% {
    box-shadow: 0 0 20px rgba(251, 114, 153, 0.4);
  }
}

.assistant-item.active::after {
  content: '任职中';
  position: absolute;
  left: 0px;
  top: 20px;
  font-size: 12px;
  font-weight: bold;
  text-align: center;
  color: white;
  width: 50px;
  height: 20px;
  border-radius: 0 20px 20px 0;
  background-color: var(--theme-color);
}

.assistant-avatar {
  width: 80px;
  height: 80px;
  min-width: 80px;
  min-height: 80px;
  border-radius: 10px;
  background-size: cover;
  background-position: center;
  border: 2px solid rgb(180, 180, 180);
  transition: all 0.4s ease-in-out;
}

.assistant-avatar.active {
  border: 2px solid var(--theme-color-light);
  transition: all 0.4s ease-in-out;
}

.assistant-content {
  position: relative;
  height: 80px;
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  align-items: start;
  margin-left: 10px;
}

.assistant-name {
  font-size: 17px;
  color: #636363;
  /* font-family: 'LoliFont'; */
  font-weight: bold;
}

.assistant-status {
  right: 10px;
  top: 0;
  position: absolute;
  font-size: 14px;
  color: var(--theme-color);
  margin-top: 5px;
}

.assistant-status.syncing {
  color: #fb7299;
  animation: status-blink 1.5s ease-in-out infinite;
}

@keyframes status-blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.love-progress-container {
  width: 100%;
  color: gray;
  font-size: 13px;
}

.add-assistant {
  top: 10px;
  right: 20px;
  position: absolute;
  display: flex;
  background-image: none;
  justify-content: center;
  align-items: center;
  font-size: 12px;
  font-weight: bold;
  padding: 4px 16px;
  background-color: transparent;
  color: var(--theme-color-light);
  border: 2px solid var(--theme-color-light);
  border-radius: 50px;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
}

.add-assistant:hover {
  background-color: var(--theme-color);
  border: 2px solid var(--theme-color);
  color: transparent;
  transition: all 0.2s ease-in-out;
}

.add-assistant:hover .add-assistant-icon {
  color: white;
  transform: translateX(-25px);
  transition: all 0.2s ease-in-out;
}

.loading-spinner {
  position: absolute;
  top: 13px;
  left: 120px;
  color: #fb7299;
  stroke: #fb7299;
}

.assistant-loading-tip {
  position: absolute;
  top: 13px;
  left: 150px;
  color: #fb7299;
  font-size: 12px;
}

/* 选择方式对话框样式 */
.select-method-dialog {
  width: 400px;
  padding: 30px;
  text-align: center;
}

.dialog-title {
  font-size: 24px;
  font-weight: bold;
  color: #fb7299;
  margin-bottom: 10px;
  font-family: 'LoliFont';
}

.dialog-description {
  color: #666;
  margin-bottom: 30px;
  font-size: 16px;
}

.options-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 30px;
}

.option-item {
  display: flex;
  align-items: center;
  padding: 20px;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 15px;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 2px solid #f6f6f6;
}

.option-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  border-color: #ffb3cd;
}

.option-icon {
  width: 50px;
  height: 50px;
  background: #ffebf0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20px;
  color: #fb7299;
  font-size: 24px;
}

.option-content {
  flex: 1;
  text-align: left;
}

.option-title {
  font-size: 18px;
  font-weight: bold;
  color: #333;
  margin-bottom: 5px;
}

.option-description {
  color: #666;
  font-size: 14px;
}

.avatar-loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.8);
  border-radius: 15px;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid #f3f3f3;
  border-top: 2px solid #fb7299;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

/* 助手资源同步进度覆盖层 */
.sync-progress-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.92);
  border-radius: 15px;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 11;
  backdrop-filter: blur(2px);
}

.sync-progress-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 80%;
}

.sync-progress-icon {
  width: 28px;
  height: 28px;
  background: linear-gradient(135deg, #fb7299, #ff97b3);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 12px;
  animation: sync-pulse 1.5s ease-in-out infinite;
}

@keyframes sync-pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.8;
  }
}

.sync-progress-text {
  font-size: 11px;
  color: #fb7299;
  font-weight: bold;
  text-align: center;
}
</style>
