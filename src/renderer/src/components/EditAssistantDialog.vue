<template>
  <BlurModal :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)">
    <div class="add-assistant-dialog">
      <div class="add-assistant-title">{{ isEditMode ? '编辑助手' : '聘用助手' }}</div>
      <div class="add-assistant-tips">
        {{
          isEditMode ? '为你的助手更新信息吧' : '和阁下的每一次相遇都是一个奇迹，因此我会无比珍惜'
        }}
      </div>
      <form class="add-assistant-form" @submit.prevent="handleSubmit">
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
                  <input id="assistantBirthday" v-model="formData.birthday" type="date" required />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label for="assistantPersonality">角色性格</label>
          <input
            id="assistantPersonality"
            v-model="formData.personality"
            type="text"
            required
            placeholder="例如：活泼、内向等"
          />
        </div>

        <div class="form-group">
          <label for="assistantDescription">描述</label>
          <textarea
            id="assistantDescription"
            v-model="formData.description"
            required
            placeholder="请输入助手的详细描述"
          ></textarea>
        </div>

        <div class="form-actions">
          <button type="button" class="cancel-btn" @click="handleCancel">取消</button>
          <button type="submit" class="submit-btn">
            {{ isEditMode ? '保存修改' : '添加助手' }}
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
import { AssistantManager } from '../server/assistantManager'

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

// 是否为编辑模式
const isEditMode = computed(() => !!props.editingAssistant)

// 文件上传相关
const fileInput = ref<HTMLInputElement>()
const previewImage = ref('')
const uploadedFilePath = ref('')
const isUploading = ref(false)
// 表单数据
const formData = ref<AssistantInfo>({
  name: '',
  avatar: '',
  birthday: new Date().toISOString().split('T')[0], // 默认今天
  height: 0,
  weight: 0,
  personality: '',
  description: ''
})

// 重置表单
const resetForm = (): void => {
  formData.value = {
    name: '',
    avatar: '',
    // 转换为yyyy-MM-dd格式
    birthday: new Date().toISOString().split('T')[0],
    height: 0,
    weight: 0,
    personality: '',
    description: ''
  }
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
        name: newAssistant.name,
        avatar: newAssistant.avatar || '',
        birthday: newAssistant.birthday,
        height: newAssistant.height,
        weight: newAssistant.weight,
        personality: newAssistant.personality || '',
        description: newAssistant.description || ''
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
  { immediate: true }
)

// 触发文件选择
const triggerFileInput = (): void => {
  fileInput.value?.click()
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
// 提交表单
const handleSubmit = async (): Promise<void> => {
  if (!formData.value.name) {
    return
  }

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
      alert('文件保存失败，请重试')
      return
    } finally {
      isUploading.value = false
    }
  }

  try {
    if (isEditMode.value && props.editingAssistant) {
      // 编辑模式：更新助手信息
      const updatedAssistant: AssistantInfo = {
        ...props.editingAssistant,
        ...formData.value,
        birthday: new Date(formData.value.birthday).toISOString().split('T')[0], // 转换为Date对象
        conversationExamples: []
      }
      // 更新助手信息
      const success = await assistantManager.updateAssistant(updatedAssistant)
      console.log('更新状态:', success)
      if (success) {
        console.log('助手信息更新成功')
        emit('success')
      } else {
        throw new Error('更新助手失败')
      }
    } else {
      // 添加模式：创建新助手
      const assistantInfo: AssistantInfo = {
        ...formData.value,
        firstMeetTime: new Date().getTime(),
        love: 0,
        birthday: formData.value.birthday, // 转换为Date对象
        conversationExamples: [],
        extraDescription: ''
      }

      // 添加新助手
      assistantManager.addAssistant(assistantInfo)
      console.log('助手添加成功')
      emit('success')
    }

    // 关闭对话框并重置表单
    emit('update:modelValue', false)
  } catch (error) {
    console.error(isEditMode.value ? '更新助手失败:' : '添加助手失败:', error)
    alert(isEditMode.value ? '更新助手失败，请重试' : '添加助手失败，请重试')
  }
}

// 取消操作
const handleCancel = (): void => {
  emit('cancel')
  emit('update:modelValue', false)
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
  /* font-family: 'LoliFont'; */
}

.add-assistant-tips {
  font-size: 16px;
  color: #666;
  text-align: start;
  margin-bottom: 30px;
  /* font-family: 'LoliFont'; */
}

.add-assistant-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
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

.upload-btn {
  padding: 10px 20px;
  background-color: #fb7299;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.upload-btn:hover {
  background-color: #ff97b3;
}

.form-group {
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
}

.form-group label {
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
  min-height: 80px;
  resize: vertical;
}

.form-row {
  display: flex;
  gap: 15px;
}

.half-width {
  flex: 1;
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
  background: #fb7299;
  color: white;
}

.submit-btn:hover {
  background: #ff97b3;
}

.submit-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}
</style>
