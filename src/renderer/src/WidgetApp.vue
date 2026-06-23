<template>
  <div class="widget-shell">
    <router-view />
  </div>
</template>

<script setup lang="ts"></script>

<style scoped>
.widget-shell {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}
</style>
