<template>
  <teleport to="body">
    <div class="notification-container">
      <transition-group name="notification" tag="div">
        <div
          v-for="notification in notifications"
          :key="notification.id"
          class="notification"
          :class="`notification-${notification.type}`"
          :style="{ top: `${notification.index * 10}px` }"
        >
          <div class="notification-icon-container">
            <div class="notification-icon">
              <font-awesome-icon :icon="getIconForType(notification.type)" />
            </div>
          </div>
          <div class="notification-content">
            <div class="notification-title">{{ notification.title }}</div>
            <div class="notification-message">{{ notification?.message }}</div>
          </div>
          <button class="notification-close" @click="removeNotification(notification.id)">
            <font-awesome-icon icon="times" />
          </button>
        </div>
      </transition-group>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { NotificationService } from '../services/NotificationService'

// 定义通知类型
interface Notification {
  id: number
  type: 'success' | 'info' | 'warning' | 'error'
  title: string
  message?: string
  duration: number
  index: number
}

const notifications = ref<Notification[]>([])
const notificationService = NotificationService.getInstance()
let nextId = 1

// 获取对应类型的图标
function getIconForType(type: string): string {
  switch (type) {
    case 'success':
      return 'fa-check-circle'
    case 'info':
      return 'fa-info-circle'
    case 'warning':
      return 'fa-exclamation-triangle'
    case 'error':
      return 'fa-exclamation-circle'
    default:
      return 'fa-info-circle'
  }
}

// 添加通知
function addNotification(notification: Omit<Notification, 'id' | 'index'>): void {
  // 限制最多显示3条通知
  if (notifications.value.length >= 3) {
    // 移除最旧的通知
    removeNotification(notifications.value[0].id)
  }

  const newNotification: Notification = {
    ...notification,
    id: nextId++,
    index: notifications.value.length
  }

  notifications.value.push(newNotification)

  // 更新所有通知的索引
  updateNotificationsIndex()

  // 设置自动关闭定时器
  if (notification.duration > 0) {
    setTimeout(() => {
      removeNotification(newNotification.id)
    }, notification.duration)
  }
}

// 移除通知
function removeNotification(id: number): void {
  const index = notifications.value.findIndex((n) => n.id === id)
  if (index !== -1) {
    notifications.value.splice(index, 1)
    // 更新剩余通知的索引
    updateNotificationsIndex()
  }
}

// 更新通知索引，用于计算位置
function updateNotificationsIndex(): void {
  notifications.value.forEach((notification, index) => {
    notification.index = index
  })
}

// 监听通知服务的通知事件
onMounted(() => {
  notificationService.addNotificationListener(addNotification)
})

onUnmounted(() => {
  notificationService.removeNotificationListener(addNotification)
})
</script>

<style scoped>
.notification-container {
  position: fixed;
  top: 100px;
  right: 50px;
  z-index: 9999;
  max-width: 320px;
}

.notification {
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 12px 16px;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.notification-icon-container {
  width: 36px;
  height: 36px;
  border-radius: 5px;
  margin-right: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.notification-icon {
  font-size: 20px;
}

.notification-content {
  flex: 1;
  min-width: 0;
}

.notification-title {
  font-weight: bold;
  font-size: 14px;
  margin-bottom: 4px;
}

.notification-message {
  font-size: 13px;
  color: #666;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  line-clamp: 4;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
}

.notification-close {
  background: none;
  border: none;
  font-size: 16px;
  color: #999;
  cursor: pointer;
  padding: 4px;
  margin-left: 8px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.notification-close:hover {
  background-color: #f5f5f5;
  color: #333;
}

/* 通知类型样式 */
.notification-info {
  border: 1px solid #188fff61;
}

.notification-info .notification-icon-container {
  background-color: #188fff34;
  color: #1890ff;
}

.notification-success {
  border: 1px solid #52c41a61;
}

.notification-success .notification-icon-container {
  background-color: #52c41a34;
  color: #52c41a;
}

.notification-warning {
  border: 1px solid #faad1461;
}

.notification-warning .notification-icon-container {
  background-color: #faad1434;
  color: #faad14;
}

.notification-error {
  border: 1px solid #f5222d61;
}

.notification-error .notification-icon-container {
  background-color: #f5222d34;
  color: #f5222d;
}

/* 过渡动画 */
.notification-enter-active,
.notification-leave-active {
  transition: all 0.3s ease;
}

.notification-enter-from {
  transform: translateX(100%);
  opacity: 0;
}

.notification-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

.notification-move {
  transition: top 0.3s ease;
}
</style>
