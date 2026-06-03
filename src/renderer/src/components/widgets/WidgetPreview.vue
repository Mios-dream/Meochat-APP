<template>
  <div class="widget-preview" :class="{ enabled: enabled }">
    <!-- 预览头部 -->
    <div class="preview-header">
      <font-awesome-icon class="preview-name-icon" :icon="icon" />
      <h3 class="preview-name">{{ name }}</h3>
      <button class="action-btn add-btn" title="添加实例" @click="$emit('add')">
        <font-awesome-icon icon="fa-solid fa-plus" />
      </button>
    </div>

    <!-- 预览内容 -->
    <div class="preview-content">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  name: string
  description: string
  icon: string | string[]
  enabled?: boolean
}

defineProps<Props>()

defineEmits<{
  (e: 'add'): void
}>()
</script>

<style scoped>
.widget-preview {
  position: relative;
  display: flex;
  flex-direction: column;
  aspect-ratio: 1.4 / 1;
  background-color: #ffd8e7;
  border-radius: 20px;
  padding: 5px 14px 14px 14px;
  transition: all 0.3s ease;
  /* border: 2px solid rgba(255, 255, 255, 0.78); */
  overflow: hidden;
}

.widget-preview::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url('../../assets/images/background_circle.png');
  background-repeat: repeat;
  background-size: 48px 32px;
  opacity: 0.34;
  pointer-events: none;
}

/* 左下角双层圆角星星装饰 */
.widget-preview::after {
  content: '';
  position: absolute;
  left: -6px;
  bottom: -6px;
  width: 52px;
  height: 52px;
  pointer-events: none;
  z-index: 2;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cdefs%3E%3Cpath id='star' d='M82,76 C96,36 104,36 118,76 C159,77 161,84 129,109 C141,149 134,154 100,130 C66,154 59,149 71,109 C39,84 41,77 82,76 Z'/%3E%3C/defs%3E%3C!-- 白色外轮廓 --%3E%3Cuse href='%23star' transform='translate(100,100) scale(1.42) translate(-100,-100)' fill='none' stroke='white' stroke-width='9' stroke-linejoin='round' stroke-linecap='round'/%3E%3C!-- 粉色线条边框 --%3E%3Cuse href='%23star' transform='translate(100,100) scale(1.32) translate(-100,-100)' fill='none' stroke='%23ffc0d6' stroke-width='5' stroke-linejoin='round' stroke-linecap='round'/%3E%3C!-- 粉色实心 --%3E%3Cuse href='%23star' transform='translate(100,100) scale(0.86) translate(-100,-100)' fill='%23ffc0d6' stroke='none'/%3E%3C/svg%3E");
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  animation: starTwinkle 4s ease-in-out infinite;
}

/* 星星缩放动画 */
@keyframes starTwinkle {
  0%,
  100% {
    transform: scale(1) rotate(0deg);
  }
  50% {
    transform: scale(1.06) rotate(3deg);
  }
}

.widget-preview.enabled {
  border-color: rgba(139, 30, 63, 0.42);
  box-shadow: 0 12px 28px rgba(139, 30, 63, 0.22);
}

.preview-header {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 28px;
  margin-bottom: 5px;
  padding-right: 36px;
}

.preview-name {
  position: relative;
  margin: 0;
  padding-left: 30px;
  color: #fff;
  font-family: 'SanJiFangYuanFont';
  font-size: 18px;
  /* font-weight: 1200; */
  text-align: left;
  text-shadow:
    2px 0 0 var(--theme-color),
    -2px 0 0 var(--theme-color),
    0 2px 0 var(--theme-color),
    0 -2px 0 var(--theme-color),
    2px 2px 0 var(--theme-color),
    -2px 2px 0 var(--theme-color),
    2px -2px 0 var(--theme-color),
    -2px -2px 0 var(--theme-color);
}

.preview-name-icon {
  position: absolute;
  left: 0;
  top: 50%;
  font-size: 21px;
  transform: translateY(-50%);
  color: var(--theme-color);
  filter: drop-shadow(1px 0 0 #fff) drop-shadow(-1px 0 0 #fff) drop-shadow(0 1px 0 #fff)
    drop-shadow(0 -1px 0 #fff);
  font-weight: 900;
  letter-spacing: 2px;
}

.preview-content {
  position: relative;
  z-index: 1;
  flex: 1;
  min-height: 0;
  background-color: white;
  background-image: url('../../assets/images/char_background.png');
  background-repeat: repeat;
  background-size: 20px 20px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  overflow: hidden;
}

.action-btn {
  position: absolute;
  top: 0;
  right: 0;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.86);
  color: #8b1e3f;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  transition: all 0.2s ease;
}

.action-btn:hover {
  background: #fff;
  transform: scale(1.06);
}

.add-btn:hover {
  background: #fff;
  color: var(--theme-color);
}
</style>
