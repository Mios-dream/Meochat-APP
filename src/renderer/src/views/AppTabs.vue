<template>
  <div id="container" :class="{ focus: isWindowFocused }">
    <aside class="titlebar">
      <div class="titlebar-icons">
        <div
          v-for="(item, index) in titlebarIcons"
          :key="index"
          class="titlebar-item"
          :style="{ backgroundColor: item.color }"
          :title="item.text"
          @click="item.action"
        ></div>
      </div>
    </aside>

    <main>
      <component :is="currentComponent" v-if="currentComponent" />
    </main>
    <div id="tabs-container">
      <div id="tabs">
        <template v-for="(item, index) in tabsItems" :key="index">
          <!-- 普通标签 -->
          <div
            v-if="!item.special"
            class="tab-item"
            :class="{ active: activeTab === index }"
            @click="item.action"
          >
            <div class="icon">
              <font-awesome-icon :icon="item.icon" />
            </div>
          </div>

          <!-- 特殊标签 -->
          <div
            v-else
            class="special-tab"
            :class="{ active: activeTab === index }"
            @click="item.action"
          >
            <div id="assistant-space-button"></div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import HomeView from './HomeView.vue'
import AssistantManagerView from './AssistantManagerView.vue'
import PluginsView from './PluginManagerView.vue'
import AssistantSpaceView from './AssistantSpaceView.vue'
import SettingView from './SettingView.vue'

const activeTab = ref(0)
const isWindowFocused = ref(true) // 默认聚焦状态

const titlebarIcons = [
  {
    color: '#f3bc4f',
    text: '最小化',
    action: () => {
      console.log('minimize')
      window.api.minimizeApp()
    }
  },
  {
    color: '#64c857',
    text: '最大化',
    action: () => {
      console.log('maximize')
      window.api.maximizeApp()
    }
  },
  {
    color: '#e97168',
    text: '关闭',
    action: () => {
      console.log('close')
      window.api.hideApp()
    }
  }
]

// 计算属性
const tabsItems = computed(() => [
  {
    icon: 'fa-solid fa-house',
    text: '主页',
    action: () => {
      switchTab(0)
    }
  },
  {
    icon: 'fa-solid fa-user-circle',
    text: '助手管理',
    action: () => {
      switchTab(1)
    }
  },
  {
    special: true,
    action: () => {
      switchTab(2)
    }
  },
  {
    icon: 'fa-solid fa-puzzle-piece',
    text: '插件',
    action: () => {
      switchTab(3)
    }
  },
  {
    icon: 'fa-solid fa-gear',
    text: '设置',
    action: () => {
      switchTab(4)
    }
  }
])

// 标签页映射表
const tabComponents = [HomeView, AssistantManagerView, AssistantSpaceView, PluginsView, SettingView]

const currentComponent = computed(() => {
  return tabComponents[activeTab.value]
})
function switchTab(index: number): void {
  activeTab.value = index
}

// 窗口聚焦事件处理
function handleFocus(): void {
  isWindowFocused.value = false
}

function handleBlur(): void {
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
  background: transparent;
}

main {
  width: 100%;
  height: 100%;
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
  z-index: 99999;
}

.titlebar-item {
  width: 15px;
  height: 15px;
  border-radius: 100%;
  cursor: pointer;
}

#tabs-container {
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  width: 400px;
  height: 90px;
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: end;
  transition: all 0.2s ease-in-out;
}

#tabs {
  /* background-color: #eeeef6bd; */
  background-color: rgb(247, 247, 247, 0.3);
  backdrop-filter: blur(10px);
  border-radius: 50px;
  box-shadow: 0 3px 15px rgba(179, 179, 179, 0.5);
  width: auto;
  height: 70px;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 4px;
}

.tab-item {
  cursor: pointer;
  width: 55px;
  height: 55px;
  border-radius: 100%;
  white-space: nowrap;
  position: relative;
  color: #4f4f4f;
  background-color: white;
  font-size: 20px;
  margin: 10px;
  transition: all 0.2s ease-in-out;
  box-shadow: 0 0 10px #4f4f4f28;
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

.special-tab {
  margin-bottom: 30px;
  width: 90px;
  height: 90px;
  /* border-radius: 100px 100px 40px 40px; */
  border-radius: 100%;
  color: white;
  /* border: 2px solid #fb7299a9; */
  border: 2px solid rgb(232, 232, 232);
  background-color: white;
  position: relative;
  box-shadow: 0 0 10px #4f4f4f28;
  transition: all 0.2s ease-in-out;
}
.special-tab:hover {
  transform: scale(1.05);
}

.special-tab.active {
  background-color: #ff9ab7;
  border: 2px solid #fb7299a9;
  box-shadow: 0 0 10px #fb7299;
}

#assistant-space-button {
  position: absolute;
  bottom: 0;
  height: 120px;
  width: 100%;
  background-image: url('../assets/images/assistant_avatar_medium.png');
  overflow: hidden;
  border-radius: 0 0 100px 100px;
  background-size: 120px;
  background-position: center top;
  background-repeat: no-repeat;
  image-rendering: -webkit-optimize-contrast;
  image-rendering: smooth;
  image-rendering: auto;
}
</style>
