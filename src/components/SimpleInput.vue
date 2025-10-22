<template>
  <div class="themed-input-container">
    <label v-if="label" :for="id" class="input-label">{{ label }}</label>
    <div class="input-wrapper">
      <input
        :id="id"
        :type="type"
        :value="localValue"
        @input="handleInput"
        @focus="isFocused = true"
        @blur="handleBlur"
        :placeholder="placeholder"
        :disabled="disabled"
        :readonly="readonly"
        class="themed-input"
        :class="{
          focused: isFocused,
          'has-error': hasError || localError,
          'with-icon': $slots.icon,
        }"
      />
      <div v-if="$slots.icon" class="input-icon">
        <slot name="icon"></slot>
      </div>
    </div>
    <div v-if="(errorMessage && hasError) || localError" class="error-message">
      {{ errorMessage || localError }}
    </div>
    <div v-if="helperText && !hasError && !localError" class="helper-text">
      {{ helperText }}
    </div>
    <!-- 显示校验状态 -->
    <div v-if="isValidating" class="helper-text">正在校验中...</div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

interface Props {
  modelValue: string | number
  label?: string
  placeholder?: string
  type?: string
  id?: string
  disabled?: boolean
  readonly?: boolean
  hasError?: boolean
  errorMessage?: string
  helperText?: string
  validator?: (value: string) => Promise<boolean> // 添加校验函数
  validationErrorMessage?: string // 自定义校验错误信息
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  label: '',
  placeholder: '',
  type: 'text',
  id: undefined,
  disabled: false,
  readonly: false,
  hasError: false,
  errorMessage: '',
  helperText: '',
  validator: undefined,
  validationErrorMessage: '输入值无效',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number): void
  (e: 'validated', value: boolean): void // 校验结果事件
}>()

const isFocused = ref(false)
const localValue = ref(props.modelValue)
const localError = ref('')
const isValidating = ref(false)

// 监听外部值变化，同步到本地值
watch(
  () => props.modelValue,
  (newValue) => {
    localValue.value = newValue
  },
)

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  localValue.value = target.value
  // 输入时清除本地错误
  localError.value = ''
}

const handleBlur = async () => {
  isFocused.value = false
  // 只有当值发生变化时才触发校验和更新
  if (localValue.value !== props.modelValue) {
    // 如果有校验函数，则进行校验
    if (props.validator) {
      isValidating.value = true
      localError.value = ''
      try {
        const isValid = await props.validator(localValue.value as string)
        if (isValid) {
          emit('update:modelValue', localValue.value)
          emit('validated', true)
        } else {
          localError.value = props.validationErrorMessage
          emit('validated', false)
        }
      } catch (error) {
        localError.value = '校验失败，请重试'
        emit('validated', false)
      } finally {
        isValidating.value = false
      }
    } else {
      // 没有校验函数则直接更新
      emit('update:modelValue', localValue.value)
      emit('validated', true)
    }
  }
}
</script>

<style scoped>
.themed-input-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  position: relative;
}

.input-label {
  font-size: 16px;
  color: #656565;
  margin-bottom: 8px;
  text-align: left;
  font-weight: 500;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.themed-input {
  width: 100%;
  padding: 7px 20px;
  font-size: 16px;
  color: black;
  background-color: #e9e7e95e;
  /* background-color: white; */
  border: 3px solid rgb(220, 220, 220);
  border-radius: 10px;
  transition: all 0.3s ease;
  box-sizing: border-box;
}

.themed-input::placeholder {
  color: rgba(0, 0, 0, 0.3);
  font-size: 15px;
  font-weight: bold;
}

.themed-input.with-icon {
  padding-left: 50px;
}

.themed-input.focused,
.themed-input:focus {
  background-color: white;
  outline: none;
  box-shadow: 0 0 15px #ffc0d663;
  border-color: #fb7299;
  border: 3px solid #ffc0d6;
}

.themed-input:focus::placeholder {
  color: transparent;
}

.themed-input.has-error {
  border-color: #ff6b6b;
  box-shadow: 0 0 10px #ff6b6b40;
}

.themed-input.has-error.focused,
.themed-input.has-error:focus {
  box-shadow: 0 0 15px #ff6b6b63;
}

.themed-input:disabled {
  cursor: not-allowed;
  opacity: 0.6;
  background-color: #f5f5f5;
}

.input-icon {
  position: absolute;
  left: 20px;
  color: #fb7299;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.error-message {
  color: #ff6b6b;
  position: absolute;
  top: -30px;
  right: 5px;
  font-size: 14px;
  margin-top: 5px;
  text-align: left;
  padding-left: 5px;
}

.helper-text {
  color: #999;
  position: absolute;
  top: -30px;
  right: 5px;
  font-size: 14px;
  margin-top: 5px;
  text-align: left;
  padding-left: 5px;
}

.themed-input[type='number'] {
  -moz-appearance: textfield;
}

.themed-input[type='number']::-webkit-outer-spin-button,
.themed-input[type='number']::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
</style>
