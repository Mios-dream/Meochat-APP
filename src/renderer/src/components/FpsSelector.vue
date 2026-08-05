<!--
  FpsSelector.vue — 渲染帧率档位选择器

  以分段按钮形式提供 30/60/120 三档固定帧率，配合 AppConfig.renderFps 使用。
  固定档位的理由见 appConfig.ts 中 RenderFps 类型注释：显示器刷新率离散，
  中间值无实际意义，固定档位语义清晰。
-->
<template>
  <div class="fps-selector">
    <button
      v-for="fps in RENDER_FPS_OPTIONS"
      :key="fps"
      type="button"
      class="fps-btn"
      :class="{ active: modelValue === fps }"
      @click="$emit('update:modelValue', fps)"
    >
      {{ fps }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { RENDER_FPS_OPTIONS, type RenderFps } from '@shared/types/appConfig'

/**
 * 当前选中的帧率档位。
 * 通过 update:modelValue 事件通知父组件，与 v-model 双向绑定兼容。
 */
defineProps<{
  modelValue: RenderFps
}>()

defineEmits<{
  (e: 'update:modelValue', value: RenderFps): void
}>()
</script>

<style scoped>
/* 分段按钮容器 */
.fps-selector {
  display: flex;
  gap: 0;
  border-radius: 25px;
}

/* 单个档位按钮：显示数值 + FPS 语义后缀 */
.fps-btn {
  min-width: 72px;
  padding: 8px 14px;
  border: 2px solid transparent;
  border-radius: 20px;
  background: transparent;
  color: #888;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

/* 选中态：使用主题色高亮 */
.fps-btn.active {
  color: #fff;
  background-color: var(--theme-color);
  border-color: var(--theme-color);
  box-shadow: 0 4px 12px rgba(251, 114, 153, 0.3);
}

/* 未选中态悬停提示 */
.fps-btn:not(.active):hover {
  color: var(--theme-color);
}
</style>
