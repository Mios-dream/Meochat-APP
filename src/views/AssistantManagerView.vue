<template>
  <div id="assistant-content" class="p-6 slide-in">
    <div class="mb-8">
      <h1 class="text-[clamp(1.5rem,3vw,2.5rem)] font-bold mb-2">助手管理</h1>
      <p class="text-gray-500">管理助手状态、配置和相关信息</p>
    </div>

    <!-- 助手状态卡片 -->
    <div class="bg-white rounded-xl shadow-soft p-6 mb-8">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div class="flex items-center space-x-6">
          <div
            id="assistant-avatar"
            class="w-20 h-20 rounded-xl gradient-bg flex items-center justify-center"
            style="background-image: url('/Hiyori/avatar.png'); background-size: cover"
          ></div>
          <div>
            <h2 class="text-2xl font-bold">澪</h2>
            <div class="flex items-center mt-2">
              <span
                class="flex items-center px-3 py-1 rounded-full text-sm mr-4"
                :class="{
                  'bg-green-100 text-green-600': isAssistantOpen,
                  'bg-red-100 text-red-600': !isAssistantOpen,
                }"
              >
                <span
                  class="w-2 h-2 rounded-full mr-2 pulse-animation"
                  :class="{
                    'bg-green-500': isAssistantOpen,
                    'bg-red-500': !isAssistantOpen,
                  }"
                ></span>
                {{ isAssistantOpen ? '任职中' : '休息中' }}
              </span>
              <span class="text-gray-500 text-sm">已陪伴阁下: 3天8小时</span>
            </div>
          </div>
        </div>
        <div class="flex space-x-4">
          <button
            id="start-assistant"
            @click="toggleAssistant"
            class="px-6 py-2.5 hover:bg-green-600 text-white rounded-lg transition-colors flex items-center"
            :class="{
              'bg-red-500 hover:bg-red-600': isAssistantOpen,
              'bg-green-500 hover:bg-green-600': !isAssistantOpen,
            }"
          >
            <i
              class="fa"
              :class="{
                'fa-power-off': !isAssistantOpen,
                'fa-times': isAssistantOpen,
              }"
              mr-2
            ></i>
            {{ isAssistantOpen ? '关闭桌宠' : '启用桌宠' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 资源使用和信息 -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
      <!-- 资源使用情况 -->
      <div class="lg:col-span-2 bg-white rounded-xl shadow-soft p-6">
        <h3 class="font-semibold text-lg mb-6">资源使用情况</h3>
        <div class="space-y-6">
          <!-- CPU 使用率 -->
          <div>
            <div class="flex justify-between mb-2">
              <span class="text-sm font-medium">CPU 使用率</span>
              <span class="text-sm font-medium">24%</span>
            </div>
            <div class="w-full bg-gray-100 rounded-full h-2.5">
              <div class="bg-primary h-2.5 rounded-full" style="width: 24%"></div>
            </div>
          </div>

          <!-- 内存使用率 -->
          <div>
            <div class="flex justify-between mb-2">
              <span class="text-sm font-medium">内存使用率</span>
              <span class="text-sm font-medium">32%</span>
            </div>
            <div class="w-full bg-gray-100 rounded-full h-2.5">
              <div class="bg-secondary h-2.5 rounded-full" style="width: 32%"></div>
            </div>
          </div>

          <!-- 磁盘使用率 -->
          <div>
            <div class="flex justify-between mb-2">
              <span class="text-sm font-medium">磁盘使用率</span>
              <span class="text-sm font-medium">18%</span>
            </div>
            <div class="w-full bg-gray-100 rounded-full h-2.5">
              <div class="bg-accent h-2.5 rounded-full" style="width: 18%"></div>
            </div>
          </div>

          <!-- 网络流量 -->
          <div>
            <div class="flex justify-between mb-2">
              <span class="text-sm font-medium">网络流量</span>
              <span class="text-sm font-medium">上行: 128KB/s 下行: 456KB/s</span>
            </div>
            <div class="w-full bg-gray-100 rounded-full h-2.5">
              <div class="gradient-bg h-2.5 rounded-full" style="width: 45%"></div>
            </div>
          </div>
        </div>

        <div class="mt-6 h-64">
          <canvas id="resourceChart"></canvas>
        </div>
      </div>

      <!-- 助手信息 -->
      <div class="bg-white rounded-xl shadow-soft p-6">
        <h3 class="font-semibold text-lg mb-6">助手信息</h3>
        <div class="space-y-4">
          <div class="flex justify-between pb-3 border-b border-gray-100">
            <span class="text-gray-500">核心版本</span>
            <span class="font-medium">v0.0.1</span>
          </div>
          <div class="flex justify-between pb-3 border-b border-gray-100">
            <span class="text-gray-500">更新时间</span>
            <span class="font-medium">2025-09-30</span>
          </div>
          <div class="flex justify-between pb-3 border-b border-gray-100">
            <span class="text-gray-500">核心状态</span>
            <span class="text-green-500 flex items-center">
              <i class="fa fa-check-circle mr-1"></i> 正常
            </span>
          </div>
          <div class="flex justify-between pb-3 border-b border-gray-100">
            <span class="text-gray-500">已安装插件</span>
            <span class="font-medium">12 个</span>
          </div>
        </div>

        <button
          class="mt-6 w-full py-2.5 gradient-bg text-white rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center"
        >
          <i class="fa fa-info-circle mr-2"></i> 查看详细信息
        </button>
      </div>
    </div>

    <!-- 助手配置 -->
    <div class="bg-white rounded-xl shadow-soft p-6">
      <div class="flex items-center justify-between mb-6">
        <h3 class="font-semibold text-lg">助手配置</h3>
        <button class="text-secondary text-sm hover:underline transition-colors">
          高级设置 <i class="fa fa-angle-right ml-1"></i>
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">唤醒词</label>
          <input
            type="text"
            value="小助手"
            class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">唤醒设置</label>
          <select
            class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
          >
            <option>使用唤醒词唤醒</option>
            <option>自定识别</option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">调用对话框快捷键</label>
          <input
            type="text"
            value="alt+a"
            class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">响应速度</label>
          <select
            class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
          >
            <option>快速</option>
            <option>平衡</option>
            <option>详细</option>
          </select>
        </div>
      </div>

      <div class="mt-6 space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h4 class="font-medium">启动时自动运行</h4>
            <p class="text-xs text-gray-500">系统启动时自动启动助手</p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked class="sr-only peer" />
            <div
              class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"
            ></div>
          </label>
        </div>

        <div class="flex items-center justify-between">
          <div>
            <h4 class="font-medium">自动更新</h4>
            <p class="text-xs text-gray-500">自动下载并安装更新</p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked class="sr-only peer" />
            <div
              class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"
            ></div>
          </label>
        </div>
      </div>

      <div class="mt-6 flex justify-end">
        <button
          class="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-dark rounded-lg transition-colors mr-3"
        >
          取消
        </button>
        <button
          class="px-6 py-2.5 gradient-bg text-white rounded-lg hover:opacity-90 transition-opacity"
        >
          保存设置
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
// 添加状态跟踪助手窗口是否打开
const isAssistantOpen = ref(false)

// 切换助手状态的函数
function toggleAssistant() {
  if (isAssistantOpen.value) {
    closeAssistant()
  } else {
    openAssistant()
  }
}

function openAssistant() {
  window.electronAPI.openAssistant()
  isAssistantOpen.value = true
}

function closeAssistant() {
  window.electronAPI.closeAssistant()
  isAssistantOpen.value = false
}

// 当组件挂载时，获取助手状态
onMounted(() => {
  window.electronAPI.getAssistantStatus().then((status: boolean) => {
    isAssistantOpen.value = status
  })
})
</script>
