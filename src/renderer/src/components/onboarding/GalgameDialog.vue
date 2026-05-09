<template>
  <div class="galgame-dialog" :class="{ hidden: !visible }">
    <div class="dialog-inner">
      <!-- speaker tag -->
      <div v-if="speaker" class="speaker-tag">
        <span class="speaker-deco">◆</span>
        {{ speaker }}
      </div>

      <!-- dialogue text area -->
      <div class="dialog-text-area" @click="handleClick">
        <div class="dialog-text">
          <span class="text-content">{{ typewriterText || text }}</span>
          <span v-if="isTyping" class="cursor-blink">|</span>
        </div>

        <!-- continue indicator -->
        <div v-if="!isTyping && !hasOptions && !showInput" class="continue-indicator">
          <span class="continue-arrow">▼</span>
        </div>
      </div>

      <!-- options -->
      <div v-if="!isTyping && hasOptions && !showInput" class="dialog-options">
        <button
          v-for="(opt, idx) in options"
          :key="idx"
          class="option-btn"
          :style="{ '--opt-delay': `${idx * 120}ms` }"
          @click="selectOption(opt.value)"
        >
          {{ opt.label }}
        </button>
      </div>

      <!-- input -->
      <div v-if="!isTyping && showInput && !hasOptions" class="dialog-input-area">
        <template v-if="inputType === 'text'">
          <input
            ref="inputRef"
            v-model="inputValue"
            type="text"
            class="dialog-input"
            :placeholder="inputPlaceholder"
            @keyup.enter="submitInput"
          />
          <button class="input-submit" :disabled="!inputValue.trim()" @click="submitInput">
            确认
          </button>
        </template>
        <template v-else-if="inputType === 'date'">
          <input
            ref="inputRef"
            v-model="inputValue"
            type="date"
            class="dialog-input dialog-input-date"
            @keyup.enter="submitInput"
          />
          <button class="input-submit" :disabled="!inputValue.trim()" @click="submitInput">
            确认
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'

interface DialogOption {
  label: string
  value: string
}

const props = withDefaults(
  defineProps<{
    visible?: boolean
    speaker: string
    text: string
    typewriterText?: string
    isTyping?: boolean
    options?: DialogOption[]
    inputType?: 'text' | 'date' | null
    inputPlaceholder?: string
  }>(),
  {
    visible: true,
    isTyping: false,
    options: () => [],
    inputType: null,
    inputPlaceholder: ''
  }
)

const emit = defineEmits<{
  advance: []
  select: [value: string]
  submit: [value: string]
  skipTyping: []
}>()

const inputValue = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

const hasOptions = computed(() => props.options.length > 0)
const showInput = computed(() => props.inputType !== null)

function handleClick(): void {
  if (props.isTyping) {
    emit('skipTyping')
    return
  }
  if (!hasOptions.value && !showInput.value) {
    emit('advance')
  }
}

function selectOption(value: string): void {
  emit('select', value)
}

function submitInput(): void {
  if (inputValue.value.trim()) {
    emit('submit', inputValue.value.trim())
    inputValue.value = ''
  }
}

watch(
  () => props.inputType,
  async (type) => {
    if (type) {
      await nextTick()
      inputRef.value?.focus()
    }
  }
)

watch(
  () => props.visible,
  async (v) => {
    if (v && props.inputType) {
      await nextTick()
      inputRef.value?.focus()
    }
  }
)
</script>

<style scoped>
.galgame-dialog {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 10;
  display: flex;
  justify-content: center;
  padding: 0 40px 32px;
  transition:
    opacity 0.4s ease,
    transform 0.4s ease;
}

.galgame-dialog.hidden {
  opacity: 0;
  transform: translateY(24px);
  pointer-events: none;
}

.dialog-inner {
  position: relative;
  width: 100%;
  max-width: 820px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.88) 0%, rgba(255, 245, 248, 0.94) 100%);
  border: 1px solid rgba(251, 114, 153, 0.25);
  border-radius: 16px;
  padding: 22px 28px;
  backdrop-filter: blur(18px);
  box-shadow:
    0 16px 48px rgba(200, 100, 130, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.5);
}

.speaker-tag {
  position: absolute;
  top: -14px;
  left: 24px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: linear-gradient(135deg, #f48fb1, #ec407a);
  color: #fff;
  font-weight: 700;
  font-size: 13px;
  padding: 4px 16px;
  border-radius: 20px;
  letter-spacing: 0.04em;
  box-shadow: 0 4px 14px rgba(236, 64, 122, 0.4);
}

.speaker-deco {
  font-size: 10px;
  opacity: 0.85;
}

.dialog-text-area {
  min-height: 72px;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  user-select: none;
}

.dialog-text {
  flex: 1;
  color: #5d3040;
  font-size: 15px;
  line-height: 1.85;
  letter-spacing: 0.03em;
  font-family:
    'Microsoft YaHei',
    'PingFang SC',
    system-ui,
    -apple-system,
    sans-serif;
}

.text-content {
  white-space: pre-wrap;
}

.cursor-blink {
  color: #fb7299;
  animation: blink 0.7s step-end infinite;
  font-weight: 300;
}

.continue-indicator {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
  padding-right: 4px;
}

.continue-arrow {
  color: rgba(251, 114, 153, 0.5);
  font-size: 12px;
  animation: continuePulse 1.5s ease-in-out infinite;
}

.dialog-options {
  margin-top: 14px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.option-btn {
  border: 1px solid rgba(251, 114, 153, 0.35);
  border-radius: 10px;
  background: rgba(251, 114, 153, 0.06);
  color: #7d2d44;
  font-size: 14px;
  padding: 9px 20px;
  cursor: pointer;
  font-family: inherit;
  letter-spacing: 0.03em;
  transition:
    background 0.22s ease,
    border-color 0.22s ease,
    transform 0.15s ease;
  animation: optionSlideIn 0.35s ease both;
  animation-delay: var(--opt-delay, 0ms);
}

.option-btn:hover {
  background: rgba(251, 114, 153, 0.18);
  border-color: rgba(251, 114, 153, 0.6);
  color: #5d2035;
  transform: translateY(-1px);
}

.option-btn:active {
  transform: scale(0.97);
}

.dialog-input-area {
  margin-top: 14px;
  display: flex;
  gap: 10px;
  animation: optionSlideIn 0.3s ease both;
}

.dialog-input {
  flex: 1;
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(251, 114, 153, 0.25);
  border-radius: 10px;
  padding: 10px 14px;
  color: #5d3040;
  font-size: 14px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.22s ease;
}

.dialog-input:focus {
  border-color: rgba(251, 114, 153, 0.55);
}

.dialog-input::placeholder {
  color: rgba(180, 120, 140, 0.4);
}

.dialog-input-date {
  color-scheme: light;
}

.dialog-input-date::-webkit-calendar-picker-indicator {
  filter: invert(0.4) sepia(1) saturate(3) hue-rotate(300deg);
}

.input-submit {
  border: none;
  border-radius: 10px;
  padding: 10px 22px;
  background: linear-gradient(135deg, #f48fb1, #ec407a);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  transition:
    opacity 0.2s ease,
    transform 0.15s ease;
  letter-spacing: 0.04em;
}

.input-submit:hover:not(:disabled) {
  transform: translateY(-1px);
}

.input-submit:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
}

@keyframes continuePulse {
  0%,
  100% {
    opacity: 0.35;
    transform: translateY(0);
  }
  50% {
    opacity: 0.8;
    transform: translateY(4px);
  }
}

@keyframes optionSlideIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
