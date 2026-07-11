<template>
  <div class="tips-root" :class="{ visible: isVisible, leaving: isLeaving }">
    <div class="tips-card">
      <!-- 头像区域 -->
      <div class="avatar-section">
        <div class="avatar-glow"></div>
        <img src="../assets/images/助手Q版.png" class="avatar-img" />
      </div>

      <!-- 消息区域 -->
      <div class="message-section">
        <p class="message-text">{{ displayMessage }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const isVisible = ref(false)
const isLeaving = ref(false)
const displayMessage = ref('')

// 存储清理函数
const cleanups: (() => void)[] = []

onMounted(() => {
  // 使用 tipsApi 监听事件
  if (window.api.tipsApi) {
    cleanups.push(
      window.api.tipsApi.onShow((data) => {
        isLeaving.value = false
        isVisible.value = true
        if (data?.message) {
          displayMessage.value = data.message
        }
      })
    )

    cleanups.push(
      window.api.tipsApi.onHide(() => {
        isLeaving.value = true
        isVisible.value = false
      })
    )

    cleanups.push(
      window.api.tipsApi.onMessage((data) => {
        if (data.message) {
          displayMessage.value = data.message
        }
      })
    )

    // 通知主进程提示窗口已准备好
    window.api.tipsApi.ready()
  }
})

onUnmounted(() => {
  // 清理所有事件监听器
  cleanups.forEach((cleanup) => cleanup())
})
</script>

<style scoped>
/* ========== 容器 ========== */
.tips-root {
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  padding: 18px;
  pointer-events: none;
  opacity: 0;
  transform: translateX(40px) translateY(-8px);
  transition:
    opacity 0.5s cubic-bezier(0.22, 0.61, 0.36, 1),
    transform 0.5s cubic-bezier(0.22, 0.61, 0.36, 1);
}

.tips-root.visible {
  opacity: 1;
  transform: translateX(0) translateY(0);
}

.tips-root.leaving {
  opacity: 0;
  transform: translateX(24px) translateY(-4px) scale(0.96);
  transition:
    opacity 0.28s cubic-bezier(0.55, 0.06, 0.68, 0.19),
    transform 0.28s cubic-bezier(0.55, 0.06, 0.68, 0.19);
}

/* ========== 卡片 ========== */
.tips-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 22px 16px 16px;
  background: rgba(255, 255, 255, 0.88);
  border-radius: 22px;
  border: 1.5px solid rgba(251, 114, 153, 0.25);
  box-shadow:
    0 8px 10px rgba(251, 114, 153, 0.12),
    0 2px 8px rgba(251, 114, 153, 0.08),
    0 0 0 1px rgba(255, 255, 255, 0.5) inset;
  max-width: 380px;
  min-width: 260px;
  overflow: hidden;
  animation: card-enter 0.55s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.leaving .tips-card {
  animation: none;
}

@keyframes card-enter {
  0% {
    opacity: 0;
    transform: scale(0.88) translateY(-8px);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* 卡片内光晕 */
.card-shine {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 25% 40%, rgba(251, 114, 153, 0.06) 0%, transparent 65%);
  pointer-events: none;
}

/* ========== 头像区域 ========== */
.avatar-section {
  position: relative;
  flex-shrink: 0;
  width: 60px;
  height: 60px;
}

/* 头像光晕 */
.avatar-glow {
  position: absolute;
  inset: -6px;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgba(251, 114, 153, 0.25) 0%,
    rgba(251, 114, 153, 0.08) 50%,
    transparent 70%
  );
  animation: avatar-glow-pulse 2.8s ease-in-out infinite;
}

@keyframes avatar-glow-pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.5;
  }
  50% {
    transform: scale(1.3);
    opacity: 1;
  }
}

/* 头像图片 */
.avatar-img {
  background-color: white;
  border-radius: 50%;
  border: 2px solid #f982a6;
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  z-index: 1;
  animation: avatar-pop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes avatar-pop {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

/* ========== 消息区域 ========== */
.message-section {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.message-label {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.5px;
  color: #fb7299;
  text-transform: uppercase;
}

.message-text {
  margin: 0;
  font-size: 13px;
  line-height: 1.65;
  color: #4f4f4f;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-word;
  transition: opacity 0.2s ease;
}
</style>
