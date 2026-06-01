<template>
  <div id="chatBoxContainer" @blur="hideChatBox">
    <ChatBox :is-visible="isVisible" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import ChatBox from '../components/ChatBox.vue'

const isVisible = ref(false)
const inputRef = ref()
let isFirst = true

// 监听窗口可见性变化
function handleVisibilityChange(): void {
  if (document.visibilityState === 'visible') {
    isVisible.value = true
    setTimeout(() => {
      if (inputRef.value) {
        inputRef.value.focus()
      }
    }, 100)
  } else {
    isVisible.value = false
  }
}

function hideChatBox(): void {
  if (isFirst) {
    isFirst = false
    return
  }

  // 先播放消失动画
  isVisible.value = false

  // 等待动画完成后再隐藏窗口
  setTimeout(() => {
    window.api.hideChatBox()
  }, 500)
}

onMounted(() => {
  // 监听页面可见性变化
  document.addEventListener('visibilitychange', handleVisibilityChange)

  window.addEventListener('blur', hideChatBox)

  // 初始显示动画：使用 nextTick + requestAnimationFrame 确保组件首次渲染完成后
  // 再触发 CSS 过渡动画，避免窗口 show() 后组件状态未就绪导致的闪烁
  nextTick(() => {
    requestAnimationFrame(() => {
      isVisible.value = true
      if (inputRef.value) {
        inputRef.value.focus()
      }
    })
  })
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  window.removeEventListener('blur', hideChatBox)
})
</script>

<style scoped>
#chatBoxContainer {
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
}
</style>
