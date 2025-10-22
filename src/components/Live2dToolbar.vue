<!-- src/components/ContextMenu.vue -->
<template>
  <div
    id="live2d-context-menu"
    v-show="visible"
    :style="style"
    @mouseleave="collapsed = true"
    @mouseenter="collapsed = false"
  >
    <div v-for="(item, index) in items" :key="index" class="menu-item" @click="item.action">
      <div class="icon">
        <font-awesome-icon :icon="item.icon" />
      </div>
      <div class="text">{{ item.text }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface MenuItem {
  icon: string
  text: string
  action: (event: PointerEvent) => void
}

const props = defineProps<{
  visible: boolean
  style: { top: string; left: string }
  items: MenuItem[]
  locked: boolean
}>()

const collapsed = ref(true)

const emit = defineEmits(['update:locked'])

const toggleLock = () => {
  emit('update:locked', !props.locked)
}
</script>

<style scoped>
#live2d-context-menu {
  position: fixed;
  background-color: rgba(255, 255, 255, 0.914);
  border: 1px solid rgba(128, 128, 128, 0.4);
  border-radius: 30px;
  box-shadow: 0 3px 15px rgba(128, 128, 128, 0.6);
  z-index: 10000;
  width: 50px;
  height: auto;
  overflow: hidden;
  transition: width 0.5s;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 8px;
}

#live2d-context-menu:not(.collapsed) {
  /* width: 150px; */
  transition: width 0.5s;
}

#live2d-context-menu:hover {
  width: 150px;
}

#live2d-context-menu .menu-item {
  cursor: pointer;
  max-width: auto;
  height: 40px;
  border-radius: 100px;
  white-space: nowrap;
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: start;
  color: #4f4f4f;
}

.menu-item .icon {
  width: 40px;
  height: 40px;
  border-radius: 30px;
  display: flex;
  align-items: center;
  padding-left: 7px;
}

.menu-item:hover {
  /* background-color: #ffc0d6; */
  background-color: #ffa0c1;
  box-shadow: 0px 0px 10px #ffc0d6;
  color: white !important;
  width: 100%;
}

.menu-item .text {
  position: absolute;
  left: 40px;
}
</style>
