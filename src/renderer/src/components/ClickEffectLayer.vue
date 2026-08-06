<!--
  src/renderer/src/components/ClickEffectLayer.vue

  全局点击光效层（蔚蓝档案风格，Canvas 2D 实现）。
  通过 teleport 挂载到 body，保证其不被路由过渡动画的 transform 影响
  （fixed 元素在 transform 祖先内会被当作绝对定位，导致定位错乱）。
  画布本身 pointer-events: none，完全不拦截任何点击/触摸事件；
  光效的生成、更新与绘制由 ClickEffectService 管理。
-->
<template>
  <Teleport to="body">
    <canvas ref="canvasEl" class="ce-layer" aria-hidden="true"></canvas>
  </Teleport>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { ClickEffectService } from '@renderer/services/ClickEffectService'

// 光效画布元素引用
const canvasEl = ref<HTMLCanvasElement | null>(null)
// 全局点击光效服务单例
const clickEffectService = ClickEffectService.getInstance()

onMounted(() => {
  if (canvasEl.value) {
    clickEffectService.mount(canvasEl.value)
  }
})

onUnmounted(() => {
  clickEffectService.unmount()
})
</script>

<style scoped>
/* 光效画布：全屏固定层，置于绝大多数 UI 之上（低于窗口控制按钮 99999），不响应指针事件 */
.ce-layer {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  z-index: 99998;
  pointer-events: none;
}
</style>
