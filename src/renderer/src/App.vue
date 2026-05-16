<template>
  <div class="app-shell">
    <router-view v-slot="{ Component, route }">
      <Transition name="route-fade" mode="default" appear>
        <div :key="route.path" class="route-screen">
          <component :is="Component" />
        </div>
      </Transition>
    </router-view>
    <Notification />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import Notification from './components/Notification.vue'
import { AssistantManager } from './services/assistantManager'
import { logService } from './services/LogService'

logService.info('应用启动')

// 助手管理器实例
const assistantManager = AssistantManager.getInstance()

onMounted(async () => {
  const onboardingState = await window.api.onboarding.getState()
  if (!onboardingState.completed) {
    return
  }

  await assistantManager.initialize()
})

</script>

<style>
.app-shell {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

.route-screen {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.route-fade-enter-active,
.route-fade-leave-active {
  transition:
    opacity 0.8s ease,
    transform 0.8s ease;
}

.route-fade-enter-from,
.route-fade-leave-to {
  opacity: 0;
  transform: scale(1.01);
}
</style>
