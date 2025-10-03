<template>
  <body class="bg-light text-dark h-screen flex overflow-hidden">
    <!-- 侧边导航栏 -->
    <aside
      class="w-64 bg-white shadow-soft flex-shrink-0 hidden md:flex flex-col transition-all duration-300 ease-in-out z-10"
    >
      <!-- 应用Logo和名称 -->
      <div class="p-6 border-b border-gray-100">
        <div class="flex items-center space-x-3">
          <div class="w-10 h-10 rounded-lg gradient-bg flex items-center justify-center">
            <i class="fa fa-robot text-white text-xl"></i>
          </div>
          <h1 class="text-xl font-bold">助手控制台</h1>
        </div>
      </div>

      <!-- 导航菜单 -->
      <nav class="flex-1 py-6 px-2 overflow-y-auto">
        <ul class="space-y-1">
          <li>
            <a
              class="flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer"
              :class="activeTab === 'dashboard' ? 'sidebar-item-active' : 'hover:bg-gray-100'"
              @click="switchTab('dashboard')"
            >
              <i class="fa fa-home w-5 h-5 mr-3"></i>
              <span>主页</span>
            </a>
          </li>
          <li>
            <a
              class="flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer"
              :class="activeTab === 'assistant' ? 'sidebar-item-active' : 'hover:bg-gray-100'"
              @click="switchTab('assistant')"
            >
              <i class="fa fa-user-circle w-5 h-5 mr-3"></i>
              <span>助手管理</span>
            </a>
          </li>
          <li>
            <a
              class="flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer"
              :class="activeTab === 'plugins' ? 'sidebar-item-active' : 'hover:bg-gray-100'"
              @click="switchTab('plugins')"
            >
              <i class="fa fa-puzzle-piece w-5 h-5 mr-3"></i>
              <span>插件管理</span>
            </a>
          </li>
          <li>
            <a
              class="flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer"
              :class="activeTab === 'settings' ? 'sidebar-item-active' : 'hover:bg-gray-100'"
              @click="switchTab('settings')"
            >
              <i class="fa fa-cog w-5 h-5 mr-3"></i>
              <span>系统设置</span>
            </a>
          </li>
          <li>
            <a
              class="flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer"
              :class="activeTab === 'logs' ? 'sidebar-item-active' : 'hover:bg-gray-100'"
              @click="switchTab('logs')"
            >
              <i class="fa fa-history w-5 h-5 mr-3"></i>
              <span>操作日志</span>
            </a>
          </li>
          <li>
            <a
              class="flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer"
              :class="activeTab === 'tasks' ? 'sidebar-item-active' : 'hover:bg-gray-100'"
              @click="switchTab('tasks')"
            >
              <i class="fa fa-tasks w-5 h-5 mr-3"></i>
              <span>任务调度</span>
            </a>
          </li>
          <li>
            <a
              class="flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer"
              :class="activeTab === 'help' ? 'sidebar-item-active' : 'hover:bg-gray-100'"
              @click="switchTab('help')"
            >
              <i class="fa fa-question-circle w-5 h-5 mr-3"></i>
              <span>帮助与关于</span>
            </a>
          </li>
        </ul>
      </nav>
    </aside>

    <!-- 主内容区 -->
    <main class="flex-1 flex flex-col overflow-hidden">
      <!-- 顶部工具栏 -->
      <header
        class="h-16 bg-white border-b border-gray-100 shadow-sm flex items-center justify-between px-6 z-10"
      >
        <div class="flex items-center">
          <button
            id="mobile-menu-btn"
            class="md:hidden mr-4 text-gray-500 hover:text-dark transition-colors"
          >
            <i class="fa fa-bars text-xl"></i>
          </button>
          <h2 class="text-lg font-semibold">{{ currentTitle }}</h2>
        </div>

        <div class="flex items-center space-x-4">
          <button class="relative text-gray-500 hover:text-dark transition-colors">
            <i class="fa fa-bell text-xl"></i>
            <span class="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>
          <button class="relative text-gray-500 hover:text-dark transition-colors">
            <i class="fa fa-search text-xl"></i>
          </button>
        </div>
      </header>

      <!-- 页面内容容器 -->
      <div class="flex-1 overflow-y-auto bg-gray-50">
        <!-- 使用 Vue 组件渲染内容 -->
        <component :is="currentComponent" v-if="currentComponent" class="slide-in" />
      </div>
    </main>
  </body>
</template>

<style type="text/tailwindcss">
@layer utilities {
  .content-auto {
    content-visibility: auto;
  }
  .gradient-bg {
    background: linear-gradient(135deg, #ffcad4 0%, #f7b8b8 100%);
  }
  .gradient-bg-reverse {
    background: linear-gradient(135deg, #f7b8b8 0%, #ffcad4 100%);
  }
  .gradient-purple {
    background: linear-gradient(135deg, #c7ceea 0%, #a0a7cc 100%);
  }
  .card-gradient {
    background: linear-gradient(145deg, white 0%, #fffafa 100%);
  }
  .sidebar-item-active {
    background-color: #ffc0d6;
    color: white;
  }
  .text-gradient {
    background-clip: text;
    -webkit-background-clip: text;
    color: transparent;
    background-image: linear-gradient(90deg, #f7b8b8, #c7ceea);
  }
  .pulse-animation {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.7;
    }
  }
  .slide-in {
    animation: slideIn 0.3s ease-out forwards;
  }
  @keyframes slideIn {
    from {
      transform: translateX(-20px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
}
</style>

<script setup lang="ts">
import { ref, computed } from 'vue'
import HomeView from './HomeView.vue'
import AssistantManagerView from './AssistantManagerView.vue'
import PluginsView from './PluginManagerView.vue'

// 当前激活的标签页
const activeTab = ref('dashboard')

// 标签页映射表
const tabComponents = {
  dashboard: HomeView,
  assistant: AssistantManagerView,
  plugins: PluginsView,
  settings: null, // 需要创建对应组件
  logs: null, // 需要创建对应组件
  tasks: null, // 需要创建对应组件
  help: null, // 需要创建对应组件
}

// 标签页标题映射表
const tabTitles = {
  dashboard: '主页',
  assistant: '助手管理',
  plugins: '插件管理',
  settings: '系统设置',
  logs: '操作日志',
  tasks: '任务调度',
  help: '帮助与关于',
}

// 计算属性：当前应该显示的组件
const currentComponent = computed(() => {
  return tabComponents[activeTab.value]
})

// 计算属性：当前标签页标题
const currentTitle = computed(() => {
  return tabTitles[activeTab.value] || '未知页面'
})

// 切换标签页的方法
// 切换标签页的方法
function switchTab(tabName: string) {
  activeTab.value = tabName
}

// 移动端菜单切换
document.addEventListener('DOMContentLoaded', function () {
  const mobileMenuBtn = document.getElementById('mobile-menu-btn')
  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', function () {
      const sidebar = document.querySelector('aside')
      sidebar.classList.toggle('hidden')
      sidebar.classList.toggle('fixed')
      sidebar.classList.toggle('h-full')
    })
  }
})
</script>
