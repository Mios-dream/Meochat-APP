<template>
  <BlurModal :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)">
    <div class="add-task-dialog-container">
      <div class="dialog-header">
        <h2 class="dialog-title">添加新任务</h2>
      </div>
      <div class="dialog-content">
        <!-- 文件夹选择区域 -->
        <div class="folder-selection-section">
          <div class="folder-selection-header">
            <h3>选择项目文件夹</h3>
            <p class="folder-selection-description">
              选择MoeChat项目的文件夹，将根据文件夹内容自动填充任务信息
            </p>
          </div>
          <div class="folder-selection-area" @click="selectTaskDirectory">
            <div class="folder-icon">
              <font-awesome-icon icon="fa-solid fa-folder-open" size="2x" />
            </div>
            <div class="folder-text">
              <p v-if="!selectedFolder" class="folder-placeholder">点击选择项目文件夹</p>
              <p v-else class="folder-path">{{ selectedFolder }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </BlurModal>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import BlurModal from './BlurModal.vue'
import TaskManager from '../services/TaskManager'

interface Emits {
  (e: 'update:modelValue', value: boolean): void
}

interface Props {
  modelValue: boolean
}

defineProps<Props>()

const emit = defineEmits<Emits>()

// 添加响应式变量来跟踪选择的文件夹
const selectedFolder = ref<string | null>(null)

const taskManager = TaskManager.getInstance()

// 文件夹选择处理函数
async function selectTaskDirectory(): Promise<void> {
  try {
    const result = await window.api.selectTaskDir()
    console.log('选择的文件夹路径:', result)

    if (!result.success && result.error) {
      console.error(result.error)
      return
    }

    if (result.success && result.tasks.length > 0) {
      // 添加任务
      result.tasks.forEach((task) => taskManager.addTask(task))
      console.log('添加任务:', result.tasks)
      closeDialog()
    }
  } catch (error) {
    console.error('选择文件夹时出错:', error)
  }
}

const closeDialog = (): void => {
  emit('update:modelValue', false)
}
</script>

<style scoped>
.add-task-dialog-container {
  width: 500px;
  max-width: 90vw;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 15px;
  padding: 25px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
}

.dialog-header {
  margin-bottom: 20px;
  text-align: center;
}

.dialog-title {
  font-size: 24px;
  color: #333;
  margin: 0;
  font-weight: 600;
}

.dialog-content {
  margin-bottom: 30px;
}

/* 文件夹选择区域样式 */
.folder-selection-section {
  margin-bottom: 25px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 12px;
  border: 2px dashed #dee2e6;
  transition: all 0.3s ease;
}

.folder-selection-section:hover {
  border-color: #fb7299;
  background: #fff5f8;
}

.folder-selection-header h3 {
  margin: 0 0 8px 0;
  color: #495057;
  font-size: 18px;
  font-weight: 600;
}

.folder-selection-description {
  margin: 0 0 15px 0;
  color: #6c757d;
  font-size: 14px;
  line-height: 1.4;
}

.folder-selection-area {
  display: flex;
  align-items: center;
  padding: 20px;
  background: white;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 2px solid #e9ecef;
}

.folder-selection-area:hover {
  border-color: #fb7299;
  box-shadow: 0 4px 12px rgba(251, 114, 153, 0.15);
}

.folder-icon {
  color: #fb7299;
  margin-right: 15px;
}

.folder-text {
  flex: 1;
}

.folder-placeholder {
  margin: 0;
  color: #adb5bd;
  font-size: 16px;
  font-style: italic;
}

.folder-path {
  margin: 0;
  color: #495057;
  font-size: 16px;
  word-break: break-all;
}

.auto-fill-status {
  margin-top: 15px;
  padding: 10px 15px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
}

.auto-fill-status.success {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.auto-fill-status.warning {
  background: #fff3cd;
  color: #856404;
  border: 1px solid #ffeaa7;
}

.auto-fill-status.error {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

/* 表单区域样式 */
.form-section {
  transition: opacity 0.3s ease;
}

.form-section.form-disabled {
  opacity: 0.6;
  pointer-events: none;
}

.form-group {
  margin-bottom: 20px;
}

.form-label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #555;
  font-size: 16px;
}

.form-textarea {
  width: 100%;
  min-height: 80px;
  padding: 12px 15px;
  border: 2px solid #ddd;
  border-radius: 10px;
  font-size: 16px;
  resize: vertical;
  transition: border-color 0.3s;
  background-color: #f8f9fa;
}

.form-textarea:focus {
  outline: none;
  border-color: #fb7299;
}

.form-textarea:disabled {
  background-color: #e9ecef;
  cursor: not-allowed;
}

.input-with-button {
  display: flex;
  gap: 10px;
}

.browse-button {
  padding: 0 15px;
  background-color: #fb7299;
  color: white;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: background-color 0.3s;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 50px;
}

.browse-button:hover:not(:disabled) {
  background-color: #fb7299cc;
}

.browse-button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 15px;
}

.cancel-button,
.submit-button {
  padding: 10px 25px;
  border: none;
  border-radius: 25px;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.cancel-button {
  background-color: #f0f0f0;
  color: #666;
}

.cancel-button:hover {
  background-color: #e0e0e0;
}

.submit-button {
  background-color: #fb7299;
  color: white;
  box-shadow: 0 4px 12px rgba(251, 114, 153, 0.3);
}

.submit-button:hover:not(:disabled) {
  background-color: #fb7299cc;
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(251, 114, 153, 0.4);
}

.submit-button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.folder-selection {
  margin-bottom: 20px;
}

.select-folder-btn {
  background-color: #4caf50;
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
}

.select-folder-btn:hover {
  background-color: #45a049;
}

.selected-path {
  margin-top: 10px;
  padding: 10px;
  background-color: #f0f0f0;
  border-radius: 4px;
  font-size: 14px;
}
</style>
