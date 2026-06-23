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
import Notification from './components/Notification.vue'
</script>

<style scoped>
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
