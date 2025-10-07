<!-- src/components/LoadingProgress.vue -->
<template>
  <div id="loading-progress" v-show="visible">
    <div class="progress-bar">
      <div class="progress-fill" :style="{ width: progress + '%' }"></div>
      <div class="progress-text">{{ Math.round(progress) }}%</div>
    </div>
  </div>
</template>

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

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  progress: number
}>()

const visible = computed(() => props.progress < 100)
</script>
