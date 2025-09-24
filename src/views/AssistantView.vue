<template></template>

<style>
/* html, */
/* body {
  overflow: hidden;
  margin: 0;
}
html {
  overscroll-behavior-x: none;
  touch-action: none;
}
body {
  display: flex;
  flex-wrap: wrap;
}
body > canvas:only-child {
  width: 100vw;
  height: 100vh;
} */
html,
body {
  overflow: hidden;
  margin: 0;
  background: transparent; /* 添加这行 */
}
body > canvas {
  background: transparent; /* 确保canvas背景透明 */
}
</style>

<script setup lang="ts">
import { LAppDelegate } from '../stores/live2d/delegate'
// import * as LAppDefine from './define'

/**
 * 等页面加载完后载入模型
 */
window.addEventListener(
  'load',
  (): void => {
    // Initialize WebGL and create the application instance
    if (!LAppDelegate.getInstance().initialize()) {
      return
    }

    LAppDelegate.getInstance().run()
  },
  { passive: true },
)

/**
 * 浏览器窗口即将关闭时释放
 */
window.addEventListener('beforeunload', (): void => LAppDelegate.releaseInstance(), {
  passive: true,
})

let pressTimer = null
let isDragging = false
let offsetX: number, offsetY: number
let petContainer

window.addEventListener('mousemove', (e) => {
  if (!isDragging) return
  window.assistantAPI.dragWindow(e.screenX, e.screenY) // 📡 移动窗口
})

window.addEventListener('mouseup', () => {
  if (pressTimer) clearTimeout(pressTimer)
  if (isDragging) {
    isDragging = false
    window.assistantAPI.stopDrag() // 📡 停止拖拽
  } else {
    console.log('点击宠物！可以加互动~')
  }
})

// 将事件绑定到父容器或document上
document.addEventListener('mousedown', (e) => {
  // 检查点击的是否是目标元素
  if (e.target.id === 'live2d' || e.target.closest('#live2d')) {
    petContainer = e.target.id === 'live2d' ? e.target : e.target.closest('#live2d')
    // 处理mousedown逻辑
    offsetX = e.clientX
    offsetY = e.clientY

    pressTimer = setTimeout(() => {
      isDragging = true
      window.assistantAPI.startDrag(offsetX, offsetY)
    }, 100)
  }
})
</script>
