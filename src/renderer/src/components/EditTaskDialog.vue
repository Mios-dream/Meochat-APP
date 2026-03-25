<template>
  <BlurModal :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)">
    <div class="moe-dialog-card">
      <div class="moe-decoration-circle top-right"></div>
      <div class="moe-decoration-circle bottom-left"></div>

      <div class="dialog-header">
        <h2 class="dialog-title">编辑任务</h2>
      </div>

      <div class="dialog-content">
        <div class="moe-form-section">
          <div class="form-group">
            <label class="form-label">任务名称</label>
            <div class="input-wrapper" :class="{ 'is-focus': focusedField === 'name' }">
              <div class="input-icon">
                <font-awesome-icon icon="fa-solid fa-tag" />
              </div>
              <input
                v-model="editingTask.name"
                type="text"
                class="moe-input"
                placeholder="给任务起个可爱的名字吧"
                @focus="focusedField = 'name'"
                @blur="focusedField = ''"
              />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">脚本入口</label>
            <div class="input-wrapper" :class="{ 'is-focus': focusedField === 'script' }">
              <div class="input-icon">
                <font-awesome-icon icon="fa-solid fa-code" />
              </div>
              <input
                v-model="editingTask.scriptPath"
                type="text"
                class="moe-input"
                placeholder="输入文件入口，例如 main.py，会和工作目录拼接"
                @focus="focusedField = 'script'"
                @blur="focusedField = ''"
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group half">
              <label class="form-label">Python 环境</label>
              <div class="input-wrapper small" :class="{ 'is-focus': focusedField === 'venv' }">
                <input
                  v-model="editingTask.venvPython"
                  type="text"
                  class="moe-input"
                  placeholder="venv/bin/python"
                  @focus="focusedField = 'venv'"
                  @blur="focusedField = ''"
                />
                <button class="icon-action-btn small" @click="browsePythonPath">
                  <font-awesome-icon icon="fa-solid fa-terminal" />
                </button>
              </div>
            </div>

            <div class="form-group half">
              <label class="form-label">工作目录</label>
              <div class="input-wrapper small" :class="{ 'is-focus': focusedField === 'workdir' }">
                <input
                  v-model="editingTask.workDir"
                  type="text"
                  class="moe-input"
                  placeholder="脚本目录"
                  @focus="focusedField = 'workdir'"
                  @blur="focusedField = ''"
                />
                <button class="icon-action-btn small" @click="browseWorkDir">
                  <font-awesome-icon icon="fa-solid fa-folder-tree" />
                </button>
              </div>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">备注描述</label>
            <div class="textarea-wrapper" :class="{ 'is-focus': focusedField === 'desc' }">
              <textarea
                v-model="editingTask.description"
                class="moe-textarea"
                placeholder="记录一下这个任务的用途..."
                rows="2"
                @focus="focusedField = 'desc'"
                @blur="focusedField = ''"
              ></textarea>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">任务优先级</label>
            <div class="priority-selector">
              <div
                v-for="priority in priorityOptions"
                :key="priority.value"
                class="priority-option"
                :class="{
                  active: editingTask.priority === priority.value,
                  critical: priority.value === 'critical',
                  high: priority.value === 'high',
                  medium: priority.value === 'medium',
                  low: priority.value === 'low'
                }"
                @click="editingTask.priority = priority.value"
              >
                <div class="priority-dot"></div>
                <span class="priority-label">{{ priority.label }}</span>
              </div>
            </div>
          </div>

          <div class="form-footer-row">
            <label class="moe-switch">
              <input v-model="editingTask.autoStart" type="checkbox" />
              <span class="slider round"></span>
              <span class="switch-label">自动启动</span>
            </label>

            <div class="action-buttons">
              <button class="moe-btn secondary" @click="closeDialog">取消</button>
              <button class="moe-btn primary" :disabled="!isFormValid" @click="submitEditTask">
                <font-awesome-icon icon="fa-solid fa-check" />
                <span>保存修改</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </BlurModal>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch } from 'vue'
import BlurModal from './BlurModal.vue'
import TaskManager from '../services/TaskManager'
import { PythonTask } from '../types/PythonService'

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'taskUpdated', taskId: number): void
}

interface Props {
  modelValue: boolean
  task: PythonTask | null
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 优先级选项
const priorityOptions = [
  { value: 'critical', label: '核心' },
  { value: 'high', label: '高' },
  { value: 'medium', label: '中' },
  { value: 'low', label: '低' }
]

// 用于UI交互的状态
const focusedField = ref<string>('')

// 编辑中的任务数据
const editingTask = reactive<Omit<PythonTask, 'id'>>({
  name: '',
  description: '',
  scriptPath: '',
  venvPython: '',
  workDir: '',
  autoStart: false,
  priority: 'high'
})

const taskManager = TaskManager.getInstance()

// 表单验证
const isFormValid = computed(() => {
  return editingTask.name.trim() !== '' && editingTask.scriptPath.trim() !== ''
})

// 监听传入的任务数据变化
watch(
  () => props.task,
  (newTask) => {
    if (newTask) {
      Object.assign(editingTask, {
        name: newTask.name,
        description: newTask.description,
        scriptPath: newTask.scriptPath,
        venvPython: newTask.venvPython,
        workDir: newTask.workDir,
        autoStart: newTask.autoStart,
        priority: newTask.priority
      })
    }
  },
  { immediate: true }
)

async function browsePythonPath(): Promise<void> {
  const result = await window.api.fileSelectAPI.selectFile({
    title: '选择Python路径',
    filters: [{ name: 'Python', extensions: ['exe'] }]
  })
  if (result.success) {
    editingTask.venvPython = result.filePath
  }
}

async function browseWorkDir(): Promise<void> {
  const result = await window.api.fileSelectAPI.selectFolder({
    title: '选择工作目录'
  })
  if (result.success) {
    editingTask.workDir = result.folderPath
  }
}

// 提交编辑
function submitEditTask(): void {
  if (!isFormValid.value || !props.task) return

  const taskData = {
    name: editingTask.name.trim(),
    description: editingTask.description.trim(),
    scriptPath: editingTask.scriptPath.trim(),
    venvPython: editingTask.venvPython.trim(),
    workDir: editingTask.workDir.trim(),
    autoStart: editingTask.autoStart,
    priority: editingTask.priority
  }

  taskManager.updateTask(props.task.id, taskData)
  emit('taskUpdated', props.task.id)
  closeDialog()
}

function resetForm(): void {
  editingTask.name = ''
  editingTask.description = ''
  editingTask.scriptPath = ''
  editingTask.venvPython = ''
  editingTask.workDir = ''
  editingTask.autoStart = false
  editingTask.priority = 'high'
}

const closeDialog = (): void => {
  resetForm()
  emit('update:modelValue', false)
}
</script>

<style scoped>
/* 复用AddTaskDialog的样式 */
.moe-dialog-card {
  width: 520px;
  max-width: 95vw;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20px);
  border-radius: 24px;
  padding: 30px;
  box-shadow:
    0 20px 60px rgba(251, 114, 153, 0.15),
    0 0 0 1px rgba(255, 255, 255, 0.8) inset;
  position: relative;
  overflow: hidden;
  font-family: 'Segoe UI', 'PingFang SC', sans-serif;
}

.moe-decoration-circle {
  position: absolute;
  border-radius: 50%;
  filter: blur(40px);
  z-index: 0;
  pointer-events: none;
}

.top-right {
  width: 150px;
  height: 150px;
  background: rgba(251, 114, 153, 0.1);
  top: -50px;
  right: -50px;
}

.bottom-left {
  width: 200px;
  height: 200px;
  background: rgba(64, 169, 255, 0.08);
  bottom: -80px;
  left: -80px;
}

.dialog-header {
  position: relative;
  z-index: 1;
  text-align: center;
  margin-bottom: 25px;
}

.dialog-title {
  font-size: 22px;
  color: #333;
  margin: 0;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.dialog-content {
  position: relative;
  z-index: 1;
}

.form-group {
  margin-bottom: 18px;
}

.form-row {
  display: flex;
  gap: 15px;
  margin-bottom: 18px;
}

.form-group.half {
  flex: 1;
  margin-bottom: 0;
}

.form-label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #666;
  padding-left: 4px;
}

.input-wrapper {
  display: flex;
  align-items: center;
  background: #f4f6f9;
  border: 2px solid transparent;
  border-radius: 14px;
  padding: 4px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.input-wrapper.is-focus {
  background: #fff;
  border-color: #fb7299;
  box-shadow: 0 4px 12px rgba(251, 114, 153, 0.1);
}

.input-icon {
  width: 36px;
  display: flex;
  justify-content: center;
  color: #adb5bd;
  font-size: 14px;
  transition: color 0.3s;
}

.input-wrapper.is-focus .input-icon {
  color: #fb7299;
}

.moe-input {
  flex: 1;
  border: none;
  background: transparent;
  padding: 8px 5px;
  font-size: 14px;
  color: #333;
  width: 100%;
}

.moe-input:focus {
  outline: none;
}

.moe-input::placeholder {
  color: #ccc;
}

.textarea-wrapper {
  background: #f4f6f9;
  border: 2px solid transparent;
  border-radius: 14px;
  padding: 10px;
  transition: all 0.3s ease;
}

.textarea-wrapper.is-focus {
  background: #fff;
  border-color: #fb7299;
}

.moe-textarea {
  width: 100%;
  border: none;
  background: transparent;
  resize: none;
  font-size: 14px;
  font-family: inherit;
  color: #333;
}

.moe-textarea:focus {
  outline: none;
}

.icon-action-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: white;
  border-radius: 10px;
  color: #fb7299;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  margin-right: 2px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
  transition: all 0.2s;
}

.icon-action-btn:hover {
  background: #fb7299;
  color: white;
  transform: translateY(-1px);
}

.input-wrapper.small {
  padding: 2px;
  border-radius: 10px;
}

.input-wrapper.small .moe-input {
  padding: 6px 10px;
  font-size: 13px;
}

.icon-action-btn.small {
  width: 28px;
  height: 28px;
  font-size: 12px;
}

.form-footer-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 25px;
  padding-top: 20px;
  border-top: 1px dashed #eee;
}

.moe-switch {
  position: relative;
  display: flex;
  align-items: center;
  cursor: pointer;
  gap: 10px;
}

.moe-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  background-color: #e4e7ed;
  transition: 0.4s;
  border-radius: 34px;
}

.slider:before {
  position: absolute;
  content: '';
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.4s;
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

input:checked + .slider {
  background-color: #fb7299;
}

input:checked + .slider:before {
  transform: translateX(20px);
}

.switch-label {
  font-size: 14px;
  color: #666;
  font-weight: 500;
}

.action-buttons {
  display: flex;
  gap: 12px;
}

.moe-btn {
  padding: 10px 24px;
  border-radius: 20px;
  border: none;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  gap: 8px;
}

.moe-btn.secondary {
  background: #f0f0f0;
  color: #666;
}

.moe-btn.secondary:hover {
  background: #e4e4e4;
  color: #333;
}

.moe-btn.primary {
  background: linear-gradient(135deg, #fb7299 0%, #e85a85 100%);
  color: white;
  box-shadow: 0 6px 15px rgba(251, 114, 153, 0.35);
}

.moe-btn.primary:hover:not(:disabled) {
  transform: translateY(-2px) scale(1.02);
  box-shadow: 0 8px 20px rgba(251, 114, 153, 0.45);
}

.moe-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.priority-selector {
  display: flex;
  gap: 8px;
  background: #f4f6f9;
  border-radius: 14px;
  padding: 4px;
  border: 2px solid transparent;
}

.priority-option {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 13px;
  font-weight: 500;
}

.priority-option:hover {
  background: rgba(255, 255, 255, 0.5);
}

.priority-option.active {
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.priority-option.critical.active {
  color: #ff4757;
}

.priority-option.high.active {
  color: #ffa502;
}

.priority-option.medium.active {
  color: #2ed573;
}

.priority-option.low.active {
  color: #70a1ff;
}

.priority-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  transition: all 0.3s ease;
}

.priority-option.critical .priority-dot {
  background: #ff4757;
}

.priority-option.high .priority-dot {
  background: #ffa502;
}

.priority-option.medium .priority-dot {
  background: #2ed573;
}

.priority-option.low .priority-dot {
  background: #70a1ff;
}

.priority-option.active .priority-dot {
  transform: scale(1.2);
}

.priority-label {
  font-weight: 600;
}

/* 底部区域 */
.form-footer-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 25px;
  padding-top: 20px;
  border-top: 1px dashed #eee;
}
</style>
