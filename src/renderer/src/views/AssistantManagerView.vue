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
                    assistantInfo?.firstMeetTime
                      ? Math.floor(
                          (new Date().getTime() - assistantInfo.firstMeetTime) /
                            (1000 * 60 * 60 * 24)
                        )
                      : 0
                  }}天
                </div>
                <div class="title">已经陪伴阁下</div>
              </div>
            </div>
            <div id="assistant-love">
              <div class="head-img"></div>
              <div class="name">澪</div>
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
                formatBirthday(assistantInfo.birthday)
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
          <div id="assistant-button-icon">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              xmlns:xlink="http://www.w3.org/1999/xlink"
              width="20px"
              height="20px"
              viewBox="0 0 30 29"
              version="1.1"
            >
              <g id="页面-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
                <g
                  id="编组备份-4"
                  transform="translate(15.000000, 14.500000) rotate(-360.000000) translate(-15.000000, -14.500000) "
                >
                  <path
                    id="形状结合备份"
                    d="M5.43663626,1.71067672 L15,6.10319495 L24.5633637,1.71067672 C25.9928735,1.05409314 27.6747719,1.70108843 28.319989,3.15578115 C28.4857179,3.52943 28.5714286,3.93468483 28.5714286,4.34463088 L28.5714286,24.6564389 C28.5714286,26.2524442 27.3000086,27.5462621 25.7316327,27.5462621 L4.26836735,27.5462621 C2.69999137,27.5462621 1.42857143,26.2524442 1.42857143,24.6564389 L1.42857143,4.34463088 C1.42857143,2.74862559 2.69999137,1.45480767 4.26836735,1.45480767 C4.67121661,1.45480767 5.06945585,1.54202825 5.43663626,1.71067672 Z"
                    fill="#FFF3F6"
                  />
                  <path
                    id="形状结合备份-2"
                    d="M23.9756611,0.385654866 L15,4.50810845 L6.02433891,0.385654866 C5.47244683,0.132167067 4.87387164,0.0010697942 4.26836735,0.0010697942 C1.91101315,0.0010697942 0,1.94574833 0,4.34463088 L0,24.6564389 C0,27.0553215 1.91101315,29 4.26836735,29 L25.7316327,29 C28.0889868,29 30,27.0553215 30,24.6564389 L30,4.34463088 C30,3.72845972 29.8711722,3.11933972 29.6220727,2.55772523 C28.6522764,0.371243146 26.1242918,-0.601225878 23.9756611,0.385654866 Z M28.319989,3.15578115 C28.4857179,3.52943 28.5714286,3.93468483 28.5714286,4.34463088 L28.5714286,24.6564389 C28.5714286,26.2524442 27.3000086,27.5462621 25.7316327,27.5462621 L4.26836735,27.5462621 C2.69999137,27.5462621 1.42857143,26.2524442 1.42857143,24.6564389 L1.42857143,4.34463088 C1.42857143,2.74862559 2.69999137,1.45480767 4.26836735,1.45480767 C4.67121661,1.45480767 5.06945585,1.54202825 5.43663626,1.71067672 L15,6.10319495 L24.5633637,1.71067672 C25.9928735,1.05409314 27.6747719,1.70108843 28.319989,3.15578115 Z"
                    fill="#FF7499"
                    fill-rule="nonzero"
                  />
                  <path
                    id="形状结合"
                    d="M8,15.5462621 C9.1045695,15.5462621 10,16.4416926 10,17.5462621 L10,27.5462621 L6,27.5462621 L6,17.5462621 C6,16.4416926 6.8954305,15.5462621 8,15.5462621 Z M22,15.5462621 C23.1045695,15.5462621 24,16.4416926 24,17.5462621 L24,27.5462621 L20,27.5462621 L20,17.5462621 C20,16.4416926 20.8954305,15.5462621 22,15.5462621 Z M26.0365338,2.8003841 C26.749432,2.8003841 27.3273501,3.38848315 27.3273501,4.1139401 L27.3273501,4.1139401 L27.3273501,9.5339094 C27.3273501,9.74557731 27.2770836,9.95411035 27.1808308,10.141752 C26.8509401,10.7848631 26.0711916,11.0340672 25.4392138,10.698365 L25.4392138,10.698365 L17.9726508,6.7321785 L25.4612211,2.93806578 C25.6399479,2.84751318 25.8368801,2.8003841 26.0365338,2.8003841 Z M3.95315399,2.8003841 C4.15280766,2.8003841 4.34973987,2.84751318 4.52846665,2.93806578 L12.017037,6.7321785 L4.55047393,10.698365 C3.91849613,11.0340672 3.13874766,10.7848631 2.80885696,10.141752 C2.71260415,9.95411035 2.66233766,9.74557731 2.66233766,9.5339094 L2.66233766,4.1139401 C2.66233766,3.38848315 3.24025582,2.8003841 3.95315399,2.8003841 Z"
                    fill="#FF97B3"
                  />
                </g>
              </g>
            </svg>
          </div>
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
            :class="{ active: assistant.name === assistantInfo?.name }"
            @click="selectAssistant(assistant)"
            @contextmenu.prevent="showContextMenu($event, assistant)"
          >
            <div
              class="assistant-avatar"
              :class="{ active: assistant.name === assistantInfo?.name }"
              :style="
                assistant.avatar
                  ? {
                      backgroundImage: `url(${'app-resource://' + assistant.avatar})`
                    }
                  : {}
              "
            ></div>
            <div class="assistant-content">
              <div class="assistant-name">{{ assistant.name }}</div>
              <div class="assistant-status">
                {{ assistant.name === assistantInfo?.name ? '任职中' : '休息中' }}
              </div>
              <div class="love-progress-container">
                <div class="love-level">好感度</div>
                <div class="progress-container">
                  <div id="love-icon"><font-awesome-icon icon="fa-solid fa-heart" /></div>
                  <div class="progress-bar-background">
                    <div
                      class="progress-bar-fill"
                      :style="{
                        width: `${(assistant.love / 200) * 100}%`
                      }"
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <AddAssistantDialog
        v-model="isVisibleAddAssistantDialog"
        :editing-assistant="null"
        @cancel="closeAddAssistantDialog"
        @success="handleAssistantUpdated"
      />

      <!-- 添加编辑助手对话框 -->
      <AddAssistantDialog
        v-model="isVisibleEditAssistantDialog"
        :editing-assistant="editingAssistant"
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
import { ref, onMounted, computed, onUnmounted } from 'vue'
import { useConfigStore } from '../stores/useConfigStore'
import ContextMenu from '../components/Toolbar.vue'
import { AssistantInfo, AssistantManager } from '../server/assistantManager'
import AddAssistantDialog from '../components/EditAssistantDialog.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import Loader from '../components/Loader.vue'

// 从配置存储中获取配置
const configStore = useConfigStore()

// 状态跟踪助手窗口是否打开
const isAssistantOpen = ref(false)
// 助手管理器实例
const assistantManager = AssistantManager.getInstance()
// 当前助手信息
const assistantInfo = ref<AssistantInfo>(assistantManager.getCurrentAssistant())
// 当前助手的好感度
const currentLove = ref(assistantInfo.value?.love || 0) // 当前好感度值
// 助手列表
const assistantList = ref(assistantManager.getAssistants())
// 是否可见添加助手对话框
const isVisibleAddAssistantDialog = ref(false)
// 是否正在加载助手列表
const assistantListLoading = ref(true)

// 计算进度百分比
const lovePercentage = computed(() => {
  return (currentLove.value / 200) * 100
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
  await assistantManager.setCurrentAssistant(assistant.name)
  assistantInfo.value = assistantManager.getCurrentAssistant()
}

// 计算属性
const contextMenuItems = computed(() => [
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
])

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
  // 重新加载助手列表
  assistantManager.loadAssistants()
  assistantList.value = assistantManager.getAssistants()

  // 如果当前正在编辑的助手是当前选中的助手，更新当前助手信息
  if (editingAssistant.value && assistantInfo.value?.name === editingAssistant.value.name) {
    assistantInfo.value = assistantManager.getCurrentAssistant()
  }

  // 重置编辑状态
  editingAssistant.value = null
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

  const success = await assistantManager.deleteAssistant(assistantToDelete.value)
  if (success) {
    assistantList.value = assistantManager.getAssistants()
    // 更新当前助手信息
    if (assistantInfo.value?.name === assistantToDelete.value) {
      assistantInfo.value = assistantManager.getCurrentAssistant()
    }
  } else {
    alert('删除助手失败')
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
  window.api.openAssistant()
  isAssistantOpen.value = true
}

// 关闭助手窗口
function closeAssistant(): void {
  window.api.closeAssistant()
  isAssistantOpen.value = false
}

// 打开添加助手对话框
function openAddAssistantDialog(): void {
  isVisibleAddAssistantDialog.value = true
}
// 关闭添加助手对话框
function closeAddAssistantDialog(): void {
  isVisibleAddAssistantDialog.value = false
}

// 当组件挂载时，获取助手状态
onMounted(() => {
  window.api.getAssistantStatus().then((status: boolean) => {
    isAssistantOpen.value = status
  })

  // 加载助手数据
  assistantManager.loadAssistants().then(() => {
    assistantListLoading.value = false
    assistantList.value = assistantManager.getAssistants()
    selectAssistant(assistantManager.getCurrentAssistant())
  })

  // 添加事件监听
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  assistantListLoading.value = true
  // 移除事件监听
  document.removeEventListener('click', handleClickOutside)
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
  padding: 5px 10px;
}

#assistant-love .head-img {
  width: 100%;
  height: 50px;
  border-radius: 10px;
  background-color: #ffcddec9;
  margin-bottom: 3px;
  background-image: url('../assets/images/assistant_avatar_small.png');
  background-size: 70% auto;
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
</style>
