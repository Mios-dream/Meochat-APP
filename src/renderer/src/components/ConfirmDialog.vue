<template>
  <BlurModal :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)">
    <div class="confirm-dialog">
      <div class="confirm-title">{{ title }}</div>
      <div class="confirm-content">{{ message }}</div>
      <div class="confirm-actions">
        <button class="cancel-btn" @click="handleCancel">取消</button>
        <button class="confirm-btn" @click="handleConfirm">确认</button>
      </div>
    </div>
  </BlurModal>
</template>

<script setup lang="ts">
import BlurModal from './BlurModal.vue'

interface Props {
  modelValue: boolean
  title?: string
  message: string
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'confirm'): void
  (e: 'cancel'): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

const handleConfirm = (): void => {
  emit('update:modelValue', false)
  emit('confirm')
}

const handleCancel = (): void => {
  emit('update:modelValue', false)
  emit('cancel')
}
</script>

<style scoped>
.confirm-dialog {
  padding: 40px;
  width: auto;
  max-width: 420px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 15px;
}

.confirm-title {
  font-size: 20px;
  font-weight: bold;
  color: var(--theme-color);
  margin-bottom: 15px;
  text-align: center;
  font-family: 'LoliFont';
}

.confirm-content {
  font-size: 16px;
  color: #656565;
  margin-bottom: 25px;
  text-align: center;
  line-height: 1.5;
}

.confirm-actions {
  display: flex;
  justify-content: space-between;
  gap: 15px;
}

.cancel-btn,
.confirm-btn {
  flex: 1;
  padding: 7px 16px;
  border: none;
  border-radius: 25px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.cancel-btn {
  background-color: #f5f5f5;
  color: #656565;
}

.cancel-btn:hover {
  background-color: #e0e0e0;
}

.confirm-btn {
  background-color: var(--theme-color);
  color: white;
  box-shadow: 0 4px 12px rgba(251, 114, 153, 0.3);
}

.confirm-btn:hover {
  background-color: var(--theme-color-dark);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(251, 114, 153, 0.4);
}
</style>
