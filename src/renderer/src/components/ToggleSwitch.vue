<template>
  <div class="toggle-switch" :class="{ checked: modelValue, disabled: disabled }" @click="toggle">
    <div class="toggle-slider">
      <div class="toggle-thumb"></div>
    </div>
    <input
      type="checkbox"
      class="toggle-input"
      :checked="modelValue"
      :disabled="disabled"
      @change="toggle"
    />
  </div>
</template>

<script setup lang="ts">
interface Props {
  modelValue?: boolean
  disabled?: boolean
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  disabled: false
})

const emit = defineEmits<Emits>()

const toggle = (): void => {
  if (!props.disabled) {
    emit('update:modelValue', !props.modelValue)
  }
}
</script>

<style scoped>
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 60px;
  height: 30px;
  cursor: pointer;
  border-radius: 15px;
  background-color: #e1e1e1;
  transition: all 0.3s ease;
  border: 1px solid #c8c8c8;
}

.toggle-switch.checked {
  background-color: var(--theme-color-light);
  border: 1px solid var(--theme-color);
}

.toggle-switch.disabled {
  border: 1px solid #bcbcbc;
  opacity: 0.6;
  cursor: not-allowed;
}

.toggle-slider {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border-radius: 15px;
  transition: all 0.3s ease;
}

.toggle-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background-color: white;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 1;
}

.toggle-switch.checked .toggle-thumb {
  transform: translateX(30px);
}

.toggle-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

/* 悬停效果
.toggle-switch:not(.disabled):hover .toggle-thumb {
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  transform: scale(1.1);
} */
.toggle-switch.checked:hover {
  box-shadow: 0 0 8px var(--theme-color);
}

.toggle-switch:hover .toggle-thumb {
  transform: scale(1.1);
}

.toggle-switch.checked:hover .toggle-thumb {
  transform: translateX(30px) scale(1.1);
}

/* 激活效果 */
.toggle-switch:active .toggle-thumb {
  transform: scale(0.95);
}

.toggle-switch.checked:active .toggle-thumb {
  transform: translateX(30px) scale(0.95);
}
</style>
