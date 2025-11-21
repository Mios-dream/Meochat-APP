<template>
  <teleport to="body">
    <div v-if="modelValue" class="blur-modal-overlay" @click="handleOverlayClick">
      <div class="blur-modal-container" :class="modalClass" @click.stop>
        <div v-if="showCloseButton" class="modal-close" @click="closeModal">
          <font-awesome-icon icon="times" />
        </div>
        <div class="modal-content">
          <slot></slot>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
interface Props {
  modelValue?: boolean
  modalClass?: string
  closeOnClickOutside?: boolean
  showCloseButton?: boolean
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'close'): void
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  modalClass: '',
  closeOnClickOutside: true,
  showCloseButton: true
})

const emit = defineEmits<Emits>()

const closeModal = (): void => {
  emit('update:modelValue', false)
  emit('close')
}

const handleOverlayClick = (): void => {
  if (props.closeOnClickOutside) {
    closeModal()
  }
}
</script>

<style scoped>
.blur-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  /* background-color: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px); */
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  animation: fadeIn 0.3s ease;
}

.blur-modal-container {
  /* background: #f6eef1bd; */
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(20px);
  border-radius: 15px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  /* border: 1px solid rgba(255, 255, 255, 0.18); */
  position: relative;
  animation: slideIn 0.3s ease;
}

.modal-close {
  position: absolute;
  top: 15px;
  right: 15px;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  transition: background 0.2s;
  z-index: 10;
}

.modal-close:hover {
  background: rgba(255, 255, 255, 0.8);
}

.modal-content {
  max-height: 80vh;
  overflow: hidden;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideIn {
  from {
    transform: translateY(-20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
</style>
