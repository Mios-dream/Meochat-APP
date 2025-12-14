<!-- TaskCard.vue -->
<template>
  <div class="task-card" :class="{ selected: isSelected }" @click="$emit('select', task.id)">
    <div class="task-card-header">
      <div :class="['state', { active: serviceStatus?.running }]"></div>
      <div :class="['state-icon', { active: serviceStatus?.running }]">
        <font-awesome-icon icon="fa-solid fa-bolt" />
      </div>
      <h2 class="task-card-title">{{ task.name }}</h2>
    </div>
    <div class="task-card-description">{{ task.description }}</div>
    <div class="task-card-content">
      <div class="task-card-info-container">
        <div class="task-card-info-title">PID</div>
        <div class="task-card-info-content">
          {{ serviceStatus?.running ? serviceStatus.pid : 'N/A' }}
        </div>
      </div>
      <div class="task-card-info-container">
        <div class="task-card-info-title">MEM</div>
        <div class="task-card-info-content">
          {{ serviceStatus?.running ? serviceStatus.memory + ' MB' : 'N/A' }}
        </div>
      </div>
    </div>
    <div class="divider"></div>
    <div class="task-card-bottom-content">
      <div class="task-card-action-container">
        <button
          v-if="!serviceStatus?.running"
          class="task-card-action-button play"
          @click.stop="$emit('start', task.id)"
        >
          <font-awesome-icon icon="fa-solid fa-play" />
        </button>
        <button v-else class="task-card-action-button stop" @click.stop="$emit('stop', task.id)">
          <font-awesome-icon icon="fa-solid fa-stop" />
        </button>
        <button class="task-card-action-button restart" @click.stop="$emit('restart', task.id)">
          <font-awesome-icon icon="fa-solid fa-rotate-right" />
        </button>
      </div>
      <div class="task-card-status-text">
        {{ serviceStatus?.running ? 'RUNNING' : 'STOPPED' }}
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { PythonTask } from '@renderer/types/PythonService'
import TaskManager from '../services/TaskManager'
import { computed } from 'vue'

// 获取任务管理器实例
const taskManager = TaskManager.getInstance()

const { task, isSelected } = defineProps<{
  task: PythonTask
  isSelected?: boolean
}>()

const serviceStatus = computed(() => {
  const status = taskManager.tasksStatus.get(task.id)
  return status
})

// 定义事件发射器
defineEmits<{
  (e: 'select', id: number): void
  (e: 'start', id: number): void
  (e: 'stop', id: number): void
  (e: 'restart', id: number): void
}>()
</script>

<style scoped>
.task-card {
  position: relative;
  height: 270px;
  background-color: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  border-radius: 20px;
  padding: 20px 30px;
  transition: all 0.3s ease;
  border: 1px solid transparent;
  cursor: pointer;
  margin-top: -20px;
}

.task-card:hover {
  border: 1px solid #fca5b9;
  box-shadow: 7px 6px 20px #fca5b970;
  /* transform: translateY(-2px); */
  z-index: 1;
}

.task-card.selected {
  border: 1px solid #fca5b9;
  box-shadow: 7px 6px 20px #fca5b990;
  transform: translateY(-1px);
  z-index: 10;
}

.task-card-header {
  display: flex;
  align-items: center;
}

.state {
  position: absolute;
  right: 20px;
  top: 20px;
  height: 10px;
  width: 10px;
  background-color: rgba(128, 128, 128, 0.4);
  border-radius: 50%;
  margin-right: 5px;
  transition: all 0.3s ease;
  box-shadow: none;
}

.state.active {
  position: absolute;
  right: 20px;
  top: 20px;
  height: 10px;
  width: 10px;
  background-color: rgb(74 222 128);
  border-radius: 50%;
  margin-right: 5px;
  animation: blink 3s infinite;
}

@keyframes blink {
  0% {
    box-shadow: none;
  }
  50% {
    box-shadow: 0 0px 7px #34d399;
  }
  100% {
    box-shadow: none;
  }
}

.state-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background-color: #f3f4f6;
  color: gray;
  transition: all 0.3s ease;
}

.state-icon.active {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background-color: #fca5b944;
  color: var(--theme-color);
}

.task-card-title {
  margin-left: 10px;
  font-size: 1.2em;
  font-weight: bold;
  color: #333;
}

.task-card-description {
  font-size: 13px;
  color: #666;
  margin: 0;
  text-overflow: ellipsis;
  line-clamp: 1;
  -webkit-line-clamp: 1;
  overflow: hidden;
}

.task-card-content {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  margin-top: 15px;
  gap: 10px;
}

.task-card-info-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 55px;
  background-color: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 5px;
  padding: 5px 10px;
}

.task-card-info-title {
  font-size: 14px;
  font-weight: bold;
  color: #9ca3af;
}

.task-card-info-content {
  font-size: 12px;
  color: #333;
}

.divider {
  margin-top: 15px;
  width: 100%;
  height: 1px;
  background-color: #e5e7eb;
}

.task-card-bottom-content {
  display: flex;
  width: 100%;
  height: 50px;
  align-items: center;
  justify-content: space-between;
}

.task-card-action-button {
  height: 30px;
  width: 30px;
  border-radius: 100%;
  border: none;
  transition: all 0.2s ease;
  cursor: pointer;
}

.task-card-action-button.play {
  background-color: #34d399;
  color: white;
}

.task-card-action-button.stop {
  background-color: #f87171;
  color: white;
}

.task-card-action-button.stop:hover {
  box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3);
}

.task-card-action-button.play:hover {
  background-color: #34d389;
  box-shadow: 0 4px 15px rgba(52, 211, 153, 0.3);
}

.task-card-action-button.restart {
  margin-left: 10px;
  background-color: #e8e8e8;
  color: #999;
  transition: all 0.2s ease;
}

.task-card-action-button.restart:hover {
  margin-left: 10px;
  background-color: #d8d8d8;
  color: #666;
}

.task-card-status-text {
  font-size: 12px;
  color: #fca5b9;
}
</style>
