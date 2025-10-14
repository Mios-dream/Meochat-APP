<template>
  <div id="container" :class="{ focus: isWindowFocused }">
    <aside class="titlebar">
      <div class="titlebar-icons">
        <div
          v-for="(item, index) in titlebarIcons"
          :key="index"
          class="titlebar-item"
          :style="{ backgroundColor: item.color }"
          @click="item.action"
          :title="item.text"
        ></div>
      </div>
    </aside>
    <div class="tabs-container">
      <div id="tabs">
        <div
          v-for="(item, index) in tabsItems"
          :key="index"
          class="tab-item"
          :class="activeTab === index ? 'active' : ''"
          @click="item.action"
        >
          <div class="icon">
            <font-awesome-icon :icon="item.icon" />
          </div>
        </div>
      </div>
    </div>
    <main>
      <component :is="currentComponent" v-if="currentComponent" class="slide-in" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import HomeView from './HomeView.vue'
import AssistantManagerView from './AssistantManagerView.vue'
import PluginsView from './PluginManagerView.vue'

const activeTab = ref(0)
const isWindowFocused = ref(true) // 默认聚焦状态

const titlebarIcons = [
  {
    color: '#f3bc4f',
    text: '最小化',
    action: () => {
      console.log('minimize')
      window.electronAPI.minimizeApp()
    },
  },
  {
    color: '#64c857',
    text: '最大化',
    action: () => {
      console.log('maximize')
      window.electronAPI.maximizeApp()
    },
  },
  {
    color: '#e97168',
    text: '关闭',
    action: () => {
      console.log('close')
      window.electronAPI.closeApp()
    },
  },
]

// 计算属性
const tabsItems = computed(() => [
  {
    icon: 'fa-solid fa-house',
    text: '主页',
    action: () => {
      switchTab(0)
    },
  },
  {
    icon: 'fa-solid fa-user-circle',
    text: '助手管理',
    action: () => {
      switchTab(1)
    },
  },
  {
    icon: 'fa-solid fa-puzzle-piece',
    text: '插件',
    action: () => {
      switchTab(2)
    },
  },
  {
    icon: 'fa-solid fa-gear',
    text: '设置',
    action: () => {},
  },
])

// 标签页映射表
const tabComponents = [HomeView, AssistantManagerView, PluginsView]

const currentComponent = computed(() => {
  return tabComponents[activeTab.value]
})
function switchTab(index: number) {
  activeTab.value = index
}

// 窗口聚焦事件处理
function handleFocus() {
  isWindowFocused.value = false
}

function handleBlur() {
  isWindowFocused.value = true
}

onMounted(() => {
  // 添加事件监听器
  window.addEventListener('focus', handleFocus)
  window.addEventListener('blur', handleBlur)

  // 初始化聚焦状态
  isWindowFocused.value = document.hasFocus()
})

onUnmounted(() => {
  // 移除事件监听器
  window.removeEventListener('focus', handleFocus)
  window.removeEventListener('blur', handleBlur)
})
</script>

<style>
* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
  width: 100%;
  overflow: hidden;
}

main {
  width: 100%;
  height: auto;
  margin-top: 40px;
  padding-left: 80px;
  overflow: auto;
  scrollbar-width: none; /* Firefox */
}

#container {
  width: 100vw;
  height: 100vh;
  display: flex;
  /* background-color: #eff4f9; */
  background-color: rgba(255, 255, 255, 0.4);
  overflow: hidden;
  transition: background-color 0.3s ease;
}

#container.focus {
  background-color: #eff4f9;
}

.titlebar {
  position: absolute;
  top: 0;
  height: 40px;
  user-select: none;
  width: 100%;
  /* background-color: #eeeef6bd; */
  -webkit-app-region: drag;
  app-region: drag;
}

.titlebar-icons {
  position: absolute;
  right: 0;
  width: 100px;
  height: 30px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-direction: row;
  margin-right: 15px;
  -webkit-app-region: no-drag;
  app-region: no-drag;
}

.titlebar-item {
  width: 15px;
  height: 15px;
  border-radius: 100%;
  cursor: pointer;
}

.tabs-container {
  position: absolute;
  left: 0;
  width: 80px;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: end;
}
#tabs {
  background-color: #eeeef6bd;
  border-radius: 50px;
  box-shadow: 0 3px 15px rgba(179, 179, 179, 0.5);
  width: 60px;
  height: auto;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
  padding: 4px;
}

.tab-item {
  cursor: pointer;
  width: 45px;
  height: 45px;
  border-radius: 100px;
  white-space: nowrap;
  position: relative;

  color: #4f4f4f;
  background-color: white;
  margin: 4px;
  transition: all 0.2s ease-in-out;
}

.tab-item:hover {
  background-color: #e8eaef;
  /* color: white; */
  box-shadow: 0 1px 8px #cbcbcb;
  transform: scale(1.1);
}

.tab-item.active {
  background-color: #fb7299;
  color: white;
  box-shadow: 0 3px 15px #fb7299;
}

.tab-item .icon {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
