<template>
  <div>
    <button @click="openAssistant">启用助手</button>
    <button @click="closeAssistant">关闭助手</button>
  </div>
</template>

<script setup lang="ts">
console.log('App.vue')
const openAssistant = () => {
  window.electronAPI.openAssistant()
}

const closeAssistant = () => {
  window.electronAPI.closeAssistant()
}
</script>
