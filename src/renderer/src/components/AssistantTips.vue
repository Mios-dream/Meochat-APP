<template>
  <div id="tips-container">
    <div id="assistant-tips" ref="tipsElementRef" :class="{ active: isVisible }">
      <span v-for="char in chars" :key="char.id" :style="getCharStyle(char)">
        {{ char.char }}
      </span>
      <span
        v-if="currentIcon"
        class="tip-icon-wrapper"
        :style="{ animationDelay: `${iconDelay}ms` }"
      >
        <img :src="currentIcon.path" class="tip-icon-img" />
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onActivated, onMounted, ref } from 'vue'
import { ChatManager } from '../chat/ChatManager'
import type { CharRenderData } from '../services/MessageTips'

const chatService = ChatManager.getInstance()
const tipsElementRef = ref<HTMLElement | null>(null)

const chars = ref<CharRenderData[]>([])
const isVisible = ref(false)
const currentIcon = ref<{ path: string } | undefined>(undefined)
const iconDelay = ref(0)
let hideTimer: ReturnType<typeof setTimeout> | null = null

function getCharStyle(char: CharRenderData): Record<string, string> {
  if (char.delay > 0) {
    const animName = char.dim ? 'tipCharFadeInDim' : 'tipCharFadeIn'
    return {
      opacity: '0',
      animation: `${animName} 200ms ease-out forwards`,
      animationDelay: `${char.delay}ms`
    }
  }
  return {
    opacity: char.dim ? '0.45' : '1'
  }
}

function bindTipsElement(): void {
  if (tipsElementRef.value) {
    chatService.initializeMessageTips(tipsElementRef.value, onRender)
  }
}

function onRender(data: {
  chars: CharRenderData[]
  icon?: { path: string }
  totalAnimDuration: number
}): void {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }

  if (data.chars.length > 0) {
    chars.value = data.chars
    currentIcon.value = data.icon
    iconDelay.value = data.totalAnimDuration
    isVisible.value = true
  } else {
    isVisible.value = false
    hideTimer = setTimeout(() => {
      chars.value = []
      currentIcon.value = undefined
      hideTimer = null
    }, 1000)
  }
}

onMounted(bindTipsElement)
onActivated(bindTipsElement)

defineProps<{
  isActive: boolean
  fontSize?: string
}>()
</script>

<style scoped>
#tips-container {
  top: 50%;
  left: 50%;
  transform: translateX(-50%);
  width: 80%;
  max-width: 600px;
  position: absolute;
}

#assistant-tips {
  animation: shake 50s ease-in-out 5s infinite;
  background-color: rgba(255, 255, 255, 0.9);
  border: 1px solid #ff96b4;
  border-radius: 12px;
  font-size: v-bind("fontSize || '14px'");
  line-height: 30px;
  min-height: 70px;
  max-height: 40vh;
  opacity: 0;
  overflow: hidden;
  padding: 20px 20px;
  transition: opacity 1s;
  word-break: break-all;
  z-index: 10;
  pointer-events: none;
  color: rgba(80, 80, 80);
}

#assistant-tips.active {
  opacity: 1 !important;
  transition: opacity 0.2s;
}

#assistant-tips .fa-lg {
  color: #0099cc;
}

@keyframes shake {
  2% {
    transform: translate(0.5px, -1.5px) rotate(-0.5deg);
  }
  4% {
    transform: translate(0.5px, 1.5px) rotate(1.5deg);
  }
  6% {
    transform: translate(1.5px, 1.5px) rotate(1.5deg);
  }
  8% {
    transform: translate(2.5px, 1.5px) rotate(0.5deg);
  }
  10% {
    transform: translate(0.5px, 2.5px) rotate(0.5deg);
  }
  12% {
    transform: translate(1.5px, 1.5px) rotate(0.5deg);
  }
  14% {
    transform: translate(0.5px, 0.5px) rotate(0.5deg);
  }
  16% {
    transform: translate(-1.5px, -0.5px) rotate(1.5deg);
  }
  18% {
    transform: translate(0.5px, 0.5px) rotate(1.5deg);
  }
  20% {
    transform: translate(2.5px, 2.5px) rotate(1.5deg);
  }
  22% {
    transform: translate(0.5px, -1.5px) rotate(1.5deg);
  }
  24% {
    transform: translate(-1.5px, 1.5px) rotate(-0.5deg);
  }
  26% {
    transform: translate(1.5px, 0.5px) rotate(1.5deg);
  }
  28% {
    transform: translate(-0.5px, -0.5px) rotate(-0.5deg);
  }
  30% {
    transform: translate(1.5px, -0.5px) rotate(-0.5deg);
  }
  32% {
    transform: translate(2.5px, -1.5px) rotate(1.5deg);
  }
  34% {
    transform: translate(2.5px, 2.5px) rotate(-0.5deg);
  }
  36% {
    transform: translate(0.5px, -1.5px) rotate(0.5deg);
  }
  38% {
    transform: translate(2.5px, -0.5px) rotate(-0.5deg);
  }
  40% {
    transform: translate(-0.5px, 2.5px) rotate(0.5deg);
  }
  42% {
    transform: translate(-1.5px, 2.5px) rotate(0.5deg);
  }
  44% {
    transform: translate(-1.5px, 1.5px) rotate(0.5deg);
  }
  46% {
    transform: translate(1.5px, -0.5px) rotate(-0.5deg);
  }
  48% {
    transform: translate(2.5px, -0.5px) rotate(0.5deg);
  }
  50% {
    transform: translate(-1.5px, 1.5px) rotate(0.5deg);
  }
  52% {
    transform: translate(-0.5px, 1.5px) rotate(0.5deg);
  }
  54% {
    transform: translate(-1.5px, 1.5px) rotate(0.5deg);
  }
  56% {
    transform: translate(0.5px, 2.5px) rotate(1.5deg);
  }
  58% {
    transform: translate(2.5px, 2.5px) rotate(0.5deg);
  }
  60% {
    transform: translate(2.5px, -1.5px) rotate(1.5deg);
  }
  62% {
    transform: translate(-1.5px, 0.5px) rotate(1.5deg);
  }
  64% {
    transform: translate(-1.5px, 1.5px) rotate(1.5deg);
  }
  66% {
    transform: translate(0.5px, 2.5px) rotate(1.5deg);
  }
  68% {
    transform: translate(2.5px, -1.5px) rotate(1.5deg);
  }
  70% {
    transform: translate(2.5px, 2.5px) rotate(0.5deg);
  }
  72% {
    transform: translate(-0.5px, -1.5px) rotate(1.5deg);
  }
  74% {
    transform: translate(-1.5px, 2.5px) rotate(1.5deg);
  }
  76% {
    transform: translate(-1.5px, 2.5px) rotate(1.5deg);
  }
  78% {
    transform: translate(-1.5px, 2.5px) rotate(0.5deg);
  }
  80% {
    transform: translate(-1.5px, 0.5px) rotate(-0.5deg);
  }
  82% {
    transform: translate(-1.5px, 0.5px) rotate(-0.5deg);
  }
  84% {
    transform: translate(-0.5px, 0.5px) rotate(1.5deg);
  }
  86% {
    transform: translate(2.5px, 1.5px) rotate(0.5deg);
  }
  88% {
    transform: translate(-1.5px, 0.5px) rotate(1.5deg);
  }
  90% {
    transform: translate(-1.5px, -0.5px) rotate(-0.5deg);
  }
  92% {
    transform: translate(-1.5px, -1.5px) rotate(1.5deg);
  }
  94% {
    transform: translate(0.5px, 0.5px) rotate(-0.5deg);
  }
  96% {
    transform: translate(2.5px, -0.5px) rotate(-0.5deg);
  }
  98% {
    transform: translate(-1.5px, -1.5px) rotate(-0.5deg);
  }
  0%,
  100% {
    transform: translate(0, 0) rotate(0);
  }
}
</style>

<style>
@keyframes tipCharFadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes tipCharFadeInDim {
  from {
    opacity: 0;
  }
  to {
    opacity: 0.45;
  }
}

@keyframes tipIconFadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.tip-icon-wrapper {
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
  white-space: nowrap;
  opacity: 0;
  animation: tipIconFadeIn 200ms ease-out forwards;
  margin-left: 4px;
}

.tip-icon-img {
  width: 1.1em;
  height: 1.1em;
  object-fit: contain;
  vertical-align: middle;
}
</style>
