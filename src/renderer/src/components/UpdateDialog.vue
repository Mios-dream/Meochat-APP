<template>
  <BlurModal
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    @close="emit('close')"
  >
    <div class="update-modal">
      <div class="modal-title">
        <div class="title">{{ isUpdating ? '正在更新...' : '阁下检测到新版本啦~' }}</div>
        <div class="image"></div>
      </div>
      <div class="modal-content">
        <div class="version-info">
          <div class="version-item">
            <span class="version-label">MoeChat</span>
            <span class="version-number new-version">v{{ newVersion }}</span>
          </div>
        </div>

        <div v-if="releaseNotes" class="release-notes">
          <div class="notes-content">
            <MarkdownRenderer :markdown="releaseNotes" />
          </div>
        </div>

        <div v-if="isUpdating" class="progress-section">
          <div class="progress-bar-container">
            <div class="progress-bar" :style="{ width: downloadProgress + '%' }"></div>
          </div>
          <div class="progress-text">{{ Math.round(downloadProgress) }}%</div>
        </div>

        <div v-if="!isUpdating" class="modal-actions">
          <button class="btn update-btn" @click="startUpdate">立即更新</button>
          <button class="btn later-btn" @click="closeModal">稍后更新</button>
        </div>

        <!-- <div v-else class="updating-actions">
          <button class="btn minimize-btn" @click="minimizeModal">最小化</button>
        </div> -->
      </div>
    </div>
  </BlurModal>
</template>

<script setup lang="ts">
import BlurModal from './BlurModal.vue'
import MarkdownRenderer from './MarkdownRenderer.vue'
import { ref } from 'vue'

interface Props {
  modelValue: boolean
  currentVersion: string
  newVersion: string
  releaseNotes?: string
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'close'): void
  (e: 'confirm'): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

const isUpdating = ref(false)
const downloadProgress = ref(0)

window.api.onProgress((percent: number) => {
  downloadProgress.value = percent
})

const startUpdate = (): void => {
  isUpdating.value = true
  emit('confirm')
}

const closeModal = (): void => {
  emit('update:modelValue', false)
  emit('close')
}

defineExpose({
  isUpdating,
  downloadProgress
})
</script>

<style scoped>
.update-modal {
  /* padding: 30px; */
  width: 500px;
}

.modal-title {
  display: flex;
  align-items: center;
  width: 100%;
  height: 160px;
  margin-bottom: 20px;
  background-image: url('../assets/images/star.png');
  background-color: #fdb5cb;
  padding: 20px;
  border-radius: 15px;
  background-size: 35px auto;
}

.modal-title .title {
  text-align: start;
  color: #fb7299;
  font-family: 'LoliFont';
  font-size: 24px;
  text-shadow:
    -2px -2px 0 #fff,
    2px -2px 0 #fff,
    -2px 2px 0 #fff,
    2px 2px 0 #fff;
}

.modal-title .image {
  position: absolute;
  right: 80px;
  top: 10px;
  width: 120px;
  height: 120px;
  background-image: url('../assets/images/assistant_avatar_medium.png');
  z-index: 5;
  background-size: cover;
}

.modal-content {
  padding: 20px;
  margin-top: -50px;
  border-radius: 30px;
  background-color: white;
}

.version-info {
  background: rgba(255, 255, 255, 0.7);
  border-radius: 20px;
}

.version-item {
  display: flex;
  justify-content: start;
  margin-bottom: 10px;
  font-size: 20px;
}

.version-label {
  font-weight: bold;
  color: #666;
  margin-right: 5px;
}

.version-number {
  font-weight: bold;
}

.version-number.new-version {
  color: #fb7299;
}

.release-notes {
  background: rgba(255, 255, 255, 0.7);
  border-radius: 10px;
  margin-bottom: 20px;
}

.notes-content {
  max-height: 300px;
  overflow-y: auto;
  scrollbar-width: none;
}

.progress-section {
  text-align: center;
}

.progress-bar-container {
  height: 10px;
  background: #e0e0e0;
  border-radius: 5px;
  overflow: hidden;
  margin-bottom: 10px;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #fca9c2, #fb7299);
  border-radius: 5px;
  transition: width 0.3s ease;
}

.progress-text {
  font-weight: 600;
  color: #fb7299;
}

.modal-actions {
  display: flex;
  gap: 15px;
  justify-content: center;
}

.updating-actions {
  display: flex;
  justify-content: center;
}

.btn {
  padding: 7px 20px;
  border-radius: 50px;
  border: none;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 100px;
}

.update-btn {
  /* background: linear-gradient(90deg, #fca9c2, #fb7299); */
  background: #fca9c2;
  color: white;
}

.update-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(251, 114, 153, 0.4);
}

.later-btn {
  background: rgba(255, 255, 255, 0.7);
  color: #fca9c2;
  border: 2px solid #fca9c2;
}

.later-btn:hover {
  /* color: #fb7299; */
  background: rgba(255, 220, 230, 0.1);
}

.minimize-btn {
  background: rgba(255, 255, 255, 0.7);
  color: #fb7299;
  border: 2px solid #fca9c2;
  min-width: 120px;
}

.minimize-btn:hover {
  background: rgba(251, 114, 153, 0.1);
}
</style>
