<template>
  <div class="volume-slider-container">
    <div class="slider-label">
      <slot name="label">{{ label }}</slot>
    </div>
    <div class="slider-wrapper">
      <input
        type="range"
        :min="min"
        :max="max"
        :step="step"
        :value="modelValue"
        @input="handleInput"
        class="volume-slider"
        :disabled="disabled"
      />
      <div class="slider-value" v-if="showValue">{{ modelValue }}{{ unit }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  modelValue: number
  label?: string
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  showValue?: boolean
  unit?: string
}

withDefaults(defineProps<Props>(), {
  modelValue: 0,
  label: '',
  min: 0,
  max: 100,
  step: 1,
  disabled: false,
  showValue: true,
  unit: '%',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void
}>()

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', Number(target.value))
}
</script>

<style scoped>
.volume-slider-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  margin: 5px;
}

.slider-label {
  font-size: 16px;
  color: #656565;
  margin-bottom: 8px;
  text-align: left;
}

.slider-wrapper {
  display: flex;
  align-items: center;
  /* gap: 15px; */
}

.volume-slider {
  flex: 1;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: #ffe6f0;
  border-radius: 3px;
  outline: none;
}

.volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fb7299;
  cursor: pointer;
  box-shadow: 0 0 5px rgba(251, 114, 153, 0.5);
  border: 2px solid white;
  transition: all 0.2s ease;
}

.volume-slider::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fb7299;
  cursor: pointer;
  box-shadow: 0 0 5px rgba(251, 114, 153, 0.5);
  border: 2px solid white;
  transition: all 0.2s ease;
}

.volume-slider::-webkit-slider-thumb:hover {
  transform: scale(1.1);
  background: #f982a6;
}

.volume-slider::-moz-range-thumb:hover {
  transform: scale(1.1);
  background: #f982a6;
}

.volume-slider:disabled::-webkit-slider-thumb {
  background: #cccccc;
  cursor: not-allowed;
}

.volume-slider:disabled::-moz-range-thumb {
  background: #cccccc;
  cursor: not-allowed;
}

.slider-value {
  min-width: 40px;
  text-align: center;
  font-size: 14px;
  color: #fb7299;
  font-weight: bold;
}
</style>
