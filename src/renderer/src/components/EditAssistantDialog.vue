<template>
  <BlurModal :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)">
    <div class="add-assistant-dialog">
      <div class="add-assistant-title">{{ isEditMode ? '编辑助手' : '聘用助手' }}</div>
      <div class="add-assistant-tips">和阁下的每一次相遇都是一个奇迹，因此我会无比珍惜</div>

      <!-- 选项卡导航 -->
      <div class="tabs">
        <button
          v-for="tab in tabs"
          :key="tab.value"
          :class="['tab-btn', { active: activeTab === tab.value }]"
          @click="activeTab = tab.value"
        >
          <font-awesome-icon :icon="tab.icon" />
          <span>{{ tab.label }}</span>
        </button>
      </div>

      <form class="add-assistant-form" @submit.prevent="handleSubmit">
        <!-- 基本信息选项卡 -->
        <div v-show="activeTab === 'basic'">
          <div class="form-row">
            <div class="avatar-upload-section">
              <label>角色头像</label>
              <div class="avatar-upload-container">
                <div
                  v-if="previewImage"
                  class="avatar-preview"
                  :style="{ backgroundImage: `url(${previewImage})` }"
                >
                  <button type="button" class="remove-avatar" @click="removeAvatar">×</button>
                </div>
                <div v-else class="avatar-placeholder" @click="triggerFileInput">
                  <font-awesome-icon icon="fa-solid fa-user" />
                  <p>点击上传头像</p>
                </div>
                <input
                  id="assistantAvatar"
                  ref="fileInput"
                  type="file"
                  accept="image/*"
                  style="display: none"
                  @change="handleFileSelect"
                />
              </div>
            </div>
            <div class="form-group">
              <div class="form-row">
                <div class="form-group">
                  <label for="assistantName">名字</label>
                  <input
                    id="assistantName"
                    v-model="formData.name"
                    type="text"
                    required
                    placeholder="给助手起一个名字吧"
                  />
                </div>
              </div>
              <div class="form-group">
                <div class="form-row">
                  <div class="form-group">
                    <label for="assistantHeight">身高(cm)</label>
                    <input
                      id="assistantHeight"
                      v-model.number="formData.height"
                      type="text"
                      required
                    />
                  </div>
                  <div class="form-group">
                    <label for="assistantWeight">体重(kg)</label>
                    <input
                      id="assistantWeight"
                      v-model.number="formData.weight"
                      type="text"
                      required
                    />
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label for="assistantBirthday">生日</label>
                    <input
                      id="assistantBirthday"
                      v-model="formData.birthday"
                      type="date"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="form-group">
            <label for="assistantPersonality">角色性格</label>
            <textarea
              id="assistantPersonality"
              v-model="formData.personality"
              type="text"
              required
              placeholder="例如：活泼、内向等"
              rows="2"
            ></textarea>
          </div>

          <div class="form-group">
            <label for="assistantDescription">描述</label>
            <textarea
              id="assistantDescription"
              v-model="formData.description"
              required
              placeholder="请输入助手的详细描述"
              rows="5"
            ></textarea>
          </div>

          <div class="form-group">
            <label for="assistantUser">对用户的称呼</label>
            <input
              id="assistantUser"
              v-model="formData.user"
              type="text"
              placeholder="例如：主人、阁下等"
            />
          </div>

          <div class="form-group">
            <label for="extraDescription">额外描述</label>
            <textarea
              id="extraDescription"
              v-model="formData.extraDescription"
              placeholder="可以添加一些额外的背景故事或特征描述"
              rows="4"
            ></textarea>
          </div>

          <div class="form-group">
            <label for="mask">用户设定</label>
            <textarea
              id="mask"
              v-model="formData.mask"
              placeholder="用于在提示词中填充用户的信息，进行个性化对话"
              rows="3"
            ></textarea>
          </div>

          <div class="form-group">
            <label for="customPrompt">自定义提示词</label>
            <textarea
              id="customPrompt"
              v-model="formData.customPrompt"
              placeholder="可以添加自定义的系统提示词"
              rows="4"
            ></textarea>
          </div>

          <div class="form-group">
            <label>开场白（每行一个）</label>
            <div class="message-examples">
              <div
                v-for="(_example, index) in formData.startWith"
                :key="index"
                class="example-item"
              >
                <textarea
                  v-model="formData.startWith[index]"
                  placeholder="输入开场白..."
                  rows="2"
                ></textarea>
                <button type="button" class="remove-example" @click="removeStartWith(index)">
                  ×
                </button>
              </div>
              <button type="button" class="add-example" @click="addStartWith">
                <font-awesome-icon icon="fa-solid fa-plus" /> 添加开场白
              </button>
            </div>
          </div>
        </div>
        <div v-show="activeTab === 'advanced'">
          <div class="settings-section">
            <h4>系统设置</h4>
            <div class="setting-item">
              <form class="setting-from">
                <div class="title">
                  <label>启用长期记忆</label>
                  <div class="description">助手可以记住长期对话内容</div>
                </div>
                <ToggleSwitch
                  :model-value="formData.settings.enableLongMemory"
                  @update:model-value="formData.settings.enableLongMemory = $event"
                />
              </form>
              <div class="divider"></div>
              <form class="setting-from">
                <div class="title">
                  <label>启用核心记忆</label>
                  <div class="description">助手可以记住重要的关键信息</div>
                </div>
                <ToggleSwitch
                  :model-value="formData.settings.enableCoreMemory"
                  @update:model-value="formData.settings.enableCoreMemory = $event"
                />
              </form>
              <div class="divider"></div>
              <form class="setting-from">
                <div class="title">
                  <label>启用知识库</label>
                  <div class="description">助手可以访问预设的知识库内容</div>
                </div>
                <ToggleSwitch
                  :model-value="formData.settings.enableLoreBooks"
                  @update:model-value="formData.settings.enableLoreBooks = $event"
                />
              </form>
              <div class="divider"></div>
              <form class="setting-from">
                <div class="title">
                  <label>启用情绪系统</label>
                  <div class="description">助手可以表达和体验情绪变化</div>
                </div>
                <ToggleSwitch
                  :model-value="formData.settings.enableEmotionSystem"
                  @update:model-value="formData.settings.enableEmotionSystem = $event"
                />
              </form>
            </div>
          </div>
          <div class="settings-section">
            <h4>语音设置</h4>
            <div class="setting-item">
              <form class="setting-from">
                <div class="title">
                  <label for="textLang">语音语言</label>
                  <div class="description">设置助手的语音输出语言</div>
                </div>
                <select id="textLang" v-model="formData.gsvSetting.textLang">
                  <option value="zh">中文</option>
                  <option value="en">英文</option>
                  <option value="ja">日文</option>
                </select>
              </form>
              <div class="divider"></div>

              <form class="setting-from">
                <div class="title">
                  <label for="seed">随机种子</label>
                  <div class="description">控制语音生成的随机性，-1表示随机</div>
                </div>
                <input
                  id="seed"
                  v-model.number="formData.gsvSetting.seed"
                  type="number"
                  min="-1"
                  placeholder="-1表示随机"
                />
              </form>
              <div class="divider"></div>

              <form class="setting-from">
                <div class="title">
                  <label for="topK">TopK值</label>
                  <div class="description">控制语音生成的多样性</div>
                </div>

                <input id="topK" v-model.number="formData.gsvSetting.topK" type="number" min="1" />
              </form>
              <div class="divider"></div>
              <form class="setting-from">
                <div class="title">
                  <label for="promptText">参考音频</label>
                  <div class="description">用于合成语音的参考音频文件地址</div>
                </div>
                <input
                  id="promptText"
                  v-model="formData.gsvSetting.refAudioPath"
                  type="text"
                  placeholder="输入参考音频文件地址..."
                />
              </form>
              <div class="divider"></div>

              <form class="setting-from">
                <div class="title">
                  <label for="promptText">参考文本</label>
                  <div class="description">对应参考音频的文本</div>
                </div>
                <input
                  id="promptText"
                  v-model="formData.gsvSetting.promptText"
                  type="text"
                  placeholder="输入参考文本..."
                />
              </form>
            </div>
          </div>
        </div>

        <div class="form-actions">
          <button type="button" class="cancel-btn" @click="handleCancel">取消</button>
          <button type="submit" class="submit-btn">
            <span v-if="!isSubmitting">{{ isEditMode ? '保存修改' : '添加助手' }}</span>
            <span v-else class="loading-spinner">
              <font-awesome-icon icon="fa-solid fa-circle-notch" class="fa-spin" />
              处理中...
            </span>
          </button>
        </div>
      </form>
    </div>
  </BlurModal>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import BlurModal from './BlurModal.vue'
import type { AssistantInfo } from '../server/assistantManager'
import { AssistantManager, createNullAssistant } from '../server/assistantManager'
import ToggleSwitch from './ToggleSwitch.vue'

const assistantManager = AssistantManager.getInstance()
// 存储待处理的文件
const selectedFile = ref<File | null>(null)

interface Props {
  modelValue: boolean
  editingAssistant?: AssistantInfo | null
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'cancel'): void
  (e: 'success'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 选项卡配置
const tabs = [
  { label: '基本信息', value: 'basic', icon: 'fa-solid fa-user' },
  { label: '高级选项', value: 'advanced', icon: 'fa-solid fa-sliders' }
]

// 当前活动选项卡
const activeTab = ref('basic')

// 是否为编辑模式
const isEditMode = computed(() => !!props.editingAssistant)

// 加载状态
const isUploading = ref(false)
const isSubmitting = ref(false)

// 文件上传相关
const fileInput = ref<HTMLInputElement>()
const previewImage = ref('')
const uploadedFilePath = ref('')
// 表单数据
const formData = ref<AssistantInfo>(createNullAssistant())

// 重置表单
const resetForm = (): void => {
  formData.value = createNullAssistant()
  previewImage.value = ''
  uploadedFilePath.value = ''
  selectedFile.value = null
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

// 监听编辑助手数据变化
watch(
  () => props.editingAssistant,
  (newAssistant) => {
    if (newAssistant) {
      // 设置表单数据为编辑的助手信息
      formData.value = {
        ...newAssistant,
        // 确保嵌套对象正确初始化
        settings: { ...newAssistant.settings },
        gsvSetting: { ...newAssistant.gsvSetting },
        startWith: [...(newAssistant.startWith || [])],
        messageExamples: [...(newAssistant.messageExamples || [])]
      }

      // 如果有头像，设置预览
      if (newAssistant.avatar) {
        // 尝试使用 app-resource 协议加载头像
        previewImage.value = `app-resource://${newAssistant.avatar}`
      } else {
        previewImage.value = ''
      }
    } else {
      resetForm()
    }
  },
  { immediate: true, deep: true }
)

// 触发文件选择
const triggerFileInput = (): void => {
  if (!isSubmitting.value) {
    fileInput.value?.click()
  }
}

// 处理文件选择
const handleFileSelect = async (event: Event): Promise<void> => {
  const input = event.target as HTMLInputElement
  if (input.files && input.files[0]) {
    const file = input.files[0]

    // 创建预览
    const reader = new FileReader()
    reader.onload = (e) => {
      previewImage.value = e.target?.result as string
    }
    reader.readAsDataURL(file)

    // 仅保存文件信息，不立即上传
    selectedFile.value = file
  }
}

function readFileAsBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (event) => {
      const arrayBuffer = event.target?.result as ArrayBuffer
      resolve(arrayBuffer)
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

// 移除头像
const removeAvatar = (): void => {
  previewImage.value = ''
  uploadedFilePath.value = ''
  formData.value.avatar = ''
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

// 添加开场白
const addStartWith = (): void => {
  formData.value.startWith.push('')
}

// 移除开场白
const removeStartWith = (index: number): void => {
  formData.value.startWith.splice(index, 1)
}

// 提交表单
const handleSubmit = async (): Promise<void> => {
  if (!formData.value.name || isSubmitting.value) {
    return
  }

  try {
    // 如果有选中的文件，则先保存文件
    if (selectedFile.value) {
      try {
        isUploading.value = true
        const fileBuffer = await readFileAsBuffer(selectedFile.value)

        // 调用IPC保存文件，传递助手名称作为参数
        const savedPath = await window.api.saveAssistantImageFile(
          fileBuffer,
          formData.value.name,
          'avatar'
        )
        formData.value.avatar = savedPath
      } catch (error) {
        console.error('文件保存失败:', error)
        const errorMessage = error instanceof Error ? error.message : '文件保存失败'
        alert(`文件保存失败: ${errorMessage}`)
        return
      } finally {
        isUploading.value = false
      }
    }

    // 设置提交状态为true，显示加载动画
    isSubmitting.value = true

    // 处理日期格式
    const processedFormData = {
      ...formData.value,
      birthday: new Date(formData.value.birthday).toISOString().split('T')[0]
    }
    // 将响应式数据转换为普通JavaScript对象
    const plainProcessedFormData = JSON.parse(JSON.stringify(processedFormData))

    if (isEditMode.value && props.editingAssistant) {
      // 编辑模式：更新助手信息
      const updatedAssistant: AssistantInfo = {
        ...props.editingAssistant,
        ...plainProcessedFormData,
        updatedAt: Date.now()
      }

      // 更新助手信息
      const success = await assistantManager.updateAssistant(updatedAssistant)
      console.log('更新状态:', success)
      if (success) {
        console.log('助手信息更新成功')
        emit('success')
        // 关闭对话框并重置表单
        emit('update:modelValue', false)
      } else {
        throw new Error('更新助手失败')
      }
    } else {
      // 添加模式：创建新助手
      const assistantInfo: AssistantInfo = {
        ...plainProcessedFormData,
        firstMeetTime: new Date().getTime(),
        love: 0,
        updatedAt: Date.now(),
        assetsLastModified: Date.now()
      }

      // 添加新助手
      await assistantManager.addAssistant(assistantInfo)
      console.log('助手添加成功')
      emit('success')
      // 关闭对话框并重置表单
      emit('update:modelValue', false)
    }
  } catch (error) {
    console.error(isEditMode.value ? '更新助手失败:' : '添加助手失败:', error)
    // 获取详细的错误信息
    const errorMessage = error instanceof Error ? error.message : '操作失败'
    // 显示详细的失败原因
    alert(`${isEditMode.value ? '更新助手' : '添加助手'}失败: ${errorMessage}`)
  } finally {
    // 无论成功或失败，都将提交状态设为false
    isSubmitting.value = false
  }
}

// 取消操作
const handleCancel = (): void => {
  if (!isSubmitting.value) {
    emit('cancel')
    emit('update:modelValue', false)
  }
}
</script>

<style scoped>
/* 保持原有的样式不变 */
.add-assistant-dialog {
  width: 600px;
  height: 80vh;
  padding: 30px;
  border-radius: 15px;
  overflow-y: auto;
  scrollbar-width: none;
}

.add-assistant-title {
  font-size: 27px;
  font-weight: bold;
  color: #fb7299;
  text-align: start;
  margin-bottom: 5px;
}

.add-assistant-tips {
  font-size: 16px;
  color: #666;
  text-align: start;
  margin-bottom: 20px;
}

/* 选项卡样式 */
.tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  border-bottom: 2px solid #e0e0e0;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 10px 20px;
  background: none;
  border: none;
  border-bottom: 3px solid transparent;
  font-size: 14px;
  color: #666;
  cursor: pointer;
  transition: all 0.3s;
}

.tab-btn:hover {
  color: #fb7299;
}

.tab-btn.active {
  color: #fb7299;
  border-bottom-color: #fb7299;
  font-weight: 500;
}

.add-assistant-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* 添加SettingView风格的设置项样式 */
.divider {
  width: 100%;
  height: 1px;
  background-color: #e0e0e0;
  margin-top: 10px;
  margin-bottom: 10px;
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

.setting-item h4 {
  margin: 0 0 15px 0;
  color: #333;
  font-size: 16px;
}

.setting-from {
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
  flex: 1;
  margin-right: 20px;
}

.setting-from .title label {
  font-weight: 500;
  color: #333;
  font-size: 14px;
}

.setting-from .title .description {
  font-size: 12px;
  color: gray;
  margin-top: 4px;
}

.setting-from input,
.setting-from select {
  width: auto;
  max-width: 200px;
  padding: 10px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.setting-from input:focus,
.setting-from select:focus {
  outline: none;
  border-color: #fb7299;
}

/* 头像上传区域样式 */
.avatar-upload-section {
  width: 150px;
  height: auto;
}

.avatar-upload-section label {
  font-weight: 500;
  color: #333;
  font-size: 14px;
}

.avatar-upload-container {
  display: flex;
  align-items: center;
}

.avatar-preview,
.avatar-placeholder {
  width: 150px;
  height: 200px;
  border-radius: 20px;
  border: 2px solid rgb(218, 218, 218);
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  background-size: cover;
  background-position: center;
  cursor: pointer;
}

.avatar-placeholder {
  background-color: #f9f9f9;
  color: #999;
  flex-direction: column;
  gap: 10px;
}

.avatar-placeholder font-awesome-icon {
  font-size: 36px;
}

.avatar-placeholder p {
  margin: 0;
  font-size: 14px;
}

.remove-avatar {
  position: absolute;
  top: -10px;
  right: -10px;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background-color: #ff4757;
  color: white;
  border: none;
  font-size: 20px;
  cursor: pointer;
  display: flex;
  justify-content: center;
  align-items: center;
}

.form-group {
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
}

.form-group label {
  margin-top: 20px;
  margin-bottom: 4px;
  font-weight: 500;
  color: #333;
  font-size: 14px;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #fb7299;
}

.form-group textarea {
  resize: vertical;
}

.form-row {
  display: flex;
  gap: 15px;
  margin: 0;
}

.form-row label {
  margin: 0;
}

.half-width {
  flex: 1;
}

.settings-section h4 {
  margin: 0 0 15px 0;
  color: #333;
  font-size: 16px;
}

/* 开场白样式 */
.message-examples {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.example-item {
  position: relative;
}

.example-item textarea {
  padding-right: 30px;
}

.remove-example {
  position: absolute;
  top: 5px;
  right: 5px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background-color: #ff4757;
  color: white;
  border: none;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  justify-content: center;
  align-items: center;
}

.add-example {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px;
  background: none;
  border: 2px dashed #e0e0e0;
  border-radius: 8px;
  color: #666;
  cursor: pointer;
  transition: all 0.3s;
}

.add-example:hover {
  border-color: #fb7299;
  color: #fb7299;
}

.form-actions {
  display: flex;
  gap: 15px;
  justify-content: flex-end;
  margin-top: 20px;
}

.cancel-btn,
.submit-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.cancel-btn {
  background: #f5f5f5;
  color: #666;
}

.cancel-btn:hover {
  background: #e0e0e0;
}

.submit-btn {
  background: var(--theme-color, #fb7299);
  color: white;
}

.submit-btn:hover {
  background: var(--theme-color-light, #ff97b3);
}

.submit-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

/* 加载动画样式 */
.loading-spinner {
  display: flex;
  align-items: center;
  gap: 8px;
}

.loading-spinner font-awesome-icon {
  animation: spin 1s linear infinite;
  font-size: 16px;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
