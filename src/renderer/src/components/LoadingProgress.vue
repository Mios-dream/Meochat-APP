<template>
  <div v-if="showContainer" id="loading-progress" :class="{ 'fade-out': isFadingOut }">
    <div class="progress-bar">
      <div class="progress-fill" :style="{ width: progress + '%' }"></div>
      <div class="progress-text">{{ Math.round(progress) }}%</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  progress: number
}>()

const isFadingOut = ref(false)
const showContainer = ref(true)

// 监听进度变化，实现淡出效果
watch(
  () => props.progress,
  (newProgress) => {
    if (newProgress >= 100) {
      // 开始淡出动画
      isFadingOut.value = true
      // 等待淡出动画完成后隐藏容器
      setTimeout(() => {
        showContainer.value = false
      }, 500) // 与CSS transition时间保持一致
    } else {
      // 如果进度回退，重置状态
      isFadingOut.value = false
      showContainer.value = true
    }
  }
)
</script>

<style scoped>
#loading-progress {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 250px;
  z-index: 100;
  opacity: 1;
  transition: opacity 0.5s ease-out;
}

#loading-progress.fade-out {
  opacity: 0;
}

.progress-bar {
  position: relative;
  height: 30px;
  background-color: rgba(255, 255, 255, 0.5);
  border-radius: 10px;
  overflow: hidden;
  padding: 5px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #a18cd1, #fbc2eb);
  border-radius: 20px;
  transition: width 0.1s ease;
}

.progress-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 12px;
  font-weight: bold;
  color: white;
  text-shadow: 0 0 2px rgba(255, 255, 255, 0.8);
}
</style>
