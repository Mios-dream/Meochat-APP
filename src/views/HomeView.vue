<template>
  <div id="dashboard-content" class="p-5 slide-in">
    <!-- 欢迎区域 -->
    <div class="mb-8">
      <h1 class="text-[clamp(1.5rem,3vw,2.5rem)] font-bold mb-2">欢迎回来，阁下</h1>
      <p class="text-gray-500">
        今天是 <span id="current-date">{{ currentDate }}</span
        >，这是您的助手状态概览
      </p>
    </div>

    <!-- 状态卡片 -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <div
        class="bg-white rounded-xl shadow-soft p-6 transition-all duration-300 hover:shadow-hover transform hover:-translate-y-1"
      >
        <div class="flex items-start justify-between">
          <div>
            <p class="text-gray-500 text-sm mb-1">活跃插件</p>
            <h3 class="text-2xl font-bold">8</h3>
            <p class="text-green-500 text-xs mt-2 flex items-center">
              <i class="fa fa-arrow-up mr-1"></i> 较昨日 +2
            </p>
          </div>
          <div class="w-12 h-12 rounded-lg bg-primary/30 flex items-center justify-center">
            <i class="fa fa-puzzle-piece text-secondary text-xl"></i>
          </div>
        </div>
      </div>

      <div
        class="bg-white rounded-xl shadow-soft p-6 transition-all duration-300 hover:shadow-hover transform hover:-translate-y-1"
      >
        <div class="flex items-start justify-between">
          <div>
            <p class="text-gray-500 text-sm mb-1">今日任务</p>
            <h3 class="text-2xl font-bold">12</h3>
            <p class="text-yellow-500 text-xs mt-2 flex items-center">
              <i class="fa fa-clock-o mr-1"></i> 5 个待完成
            </p>
          </div>
          <div class="w-12 h-12 rounded-lg bg-accent/30 flex items-center justify-center">
            <i class="fa fa-calendar-check-o text-purple-400 text-xl"></i>
          </div>
        </div>
      </div>

      <div
        class="bg-white rounded-xl shadow-soft p-6 transition-all duration-300 hover:shadow-hover transform hover:-translate-y-1"
      >
        <div class="flex items-start justify-between">
          <div>
            <p class="text-gray-500 text-sm mb-1">系统状态</p>
            <h3 class="text-2xl font-bold">正常</h3>
            <p class="text-green-500 text-xs mt-2 flex items-center">
              <i class="fa fa-check-circle mr-1"></i> 所有服务运行中
            </p>
          </div>
          <div class="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
            <i class="fa fa-heartbeat text-green-500 text-xl"></i>
          </div>
        </div>
      </div>

      <div
        class="bg-white rounded-xl shadow-soft p-6 transition-all duration-300 hover:shadow-hover transform hover:-translate-y-1"
      >
        <div class="flex items-start justify-between">
          <div>
            <p class="text-gray-500 text-sm mb-1">资源占用</p>
            <h3 class="text-2xl font-bold">32%</h3>
            <p class="text-blue-500 text-xs mt-2 flex items-center">
              <i class="fa fa-microchip mr-1"></i> 内存使用正常
            </p>
          </div>
          <div class="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
            <i class="fa fa-microchip text-blue-500 text-xl"></i>
          </div>
        </div>
      </div>
    </div>

    <!-- 图表和快速操作 -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
      <!-- 统计表格 -->
      <div class="lg:col-span-2 bg-white rounded-xl shadow-soft p-6">
        <h3 class="font-semibold text-lg mb-6">时间统计</h3>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div
            v-for="(stat, index) in statisticsData"
            :key="index"
            class="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow flex flex-col"
          >
            <div class="text-gray-500 text-sm mb-2">{{ stat.label }}</div>
            <div class="flex items-end justify-between flex-1">
              <div class="flex items-baseline">
                <span class="text-xl font-bold text-gray-800">{{ stat.value }}</span>
                <span class="text-gray-500 text-sm ml-1">{{ stat.unit }}</span>
              </div>
              <div
                v-if="stat.change"
                :class="[
                  'text-xs flex items-center',
                  stat.change.startsWith('+') ? 'text-red-500' : 'text-green-500',
                ]"
              >
                <i
                  :class="[
                    'mr-1',
                    stat.change.startsWith('+') ? 'fa fa-arrow-up' : 'fa fa-arrow-down',
                  ]"
                ></i>
                {{ stat.change }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 快速操作 -->
      <div class="bg-white rounded-xl shadow-soft p-6">
        <h3 class="font-semibold text-lg mb-6">快速操作</h3>
        <div class="grid grid-cols-2 gap-4">
          <button
            class="flex flex-col items-center justify-center p-4 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors"
          >
            <i class="fa fa-plus-circle text-secondary text-xl mb-2"></i>
            <span class="text-sm">添加插件</span>
          </button>
          <button
            class="flex flex-col items-center justify-center p-4 rounded-lg bg-accent/10 hover:bg-accent/20 transition-colors"
          >
            <i class="fa fa-calendar-plus-o text-purple-400 text-xl mb-2"></i>
            <span class="text-sm">新建任务</span>
          </button>
          <button
            class="flex flex-col items-center justify-center p-4 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors"
          >
            <i class="fa fa-refresh text-blue-400 text-xl mb-2"></i>
            <span class="text-sm">重启助手</span>
          </button>
          <button
            class="flex flex-col items-center justify-center p-4 rounded-lg bg-green-50 hover:bg-green-100 transition-colors"
          >
            <i class="fa fa-cloud-download text-green-500 text-xl mb-2"></i>
            <span class="text-sm">检查更新</span>
          </button>
          <button
            class="flex flex-col items-center justify-center p-4 rounded-lg bg-yellow-50 hover:bg-yellow-100 transition-colors"
          >
            <i class="fa fa-bell-o text-yellow-500 text-xl mb-2"></i>
            <span class="text-sm">通知设置</span>
          </button>
          <button
            class="flex flex-col items-center justify-center p-4 rounded-lg bg-red-50 hover:bg-red-100 transition-colors"
          >
            <i class="fa fa-exclamation-triangle text-red-400 text-xl mb-2"></i>
            <span class="text-sm">系统诊断</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 插件和任务列表 -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- 最近活动插件 -->
      <div class="bg-white rounded-xl shadow-soft p-6">
        <div class="flex items-center justify-between mb-6">
          <h3 class="font-semibold text-lg">活跃插件</h3>
          <a href="#plugins" class="text-secondary text-sm hover:underline transition-colors"
            >查看全部</a
          >
        </div>
        <div class="space-y-4">
          <div class="flex items-center p-3 rounded-lg hover:bg-gray-50 transition-colors">
            <div class="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center mr-4">
              <i class="fa fa-envelope text-blue-500"></i>
            </div>
            <div class="flex-1">
              <h4 class="font-medium">邮件助手</h4>
              <p class="text-xs text-gray-500">30分钟前活跃</p>
            </div>
            <div class="flex items-center">
              <span class="text-xs px-2 py-1 rounded-full bg-green-100 text-green-600 mr-3"
                >运行中</span
              >
              <button class="text-gray-400 hover:text-gray-600 transition-colors">
                <i class="fa fa-ellipsis-v"></i>
              </button>
            </div>
          </div>

          <div class="flex items-center p-3 rounded-lg hover:bg-gray-50 transition-colors">
            <div class="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center mr-4">
              <i class="fa fa-calendar text-purple-500"></i>
            </div>
            <div class="flex-1">
              <h4 class="font-medium">日程管理</h4>
              <p class="text-xs text-gray-500">2小时前活跃</p>
            </div>
            <div class="flex items-center">
              <span class="text-xs px-2 py-1 rounded-full bg-green-100 text-green-600 mr-3"
                >运行中</span
              >
              <button class="text-gray-400 hover:text-gray-600 transition-colors">
                <i class="fa fa-ellipsis-v"></i>
              </button>
            </div>
          </div>

          <div class="flex items-center p-3 rounded-lg hover:bg-gray-50 transition-colors">
            <div class="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center mr-4">
              <i class="fa fa-file-text text-green-500"></i>
            </div>
            <div class="flex-1">
              <h4 class="font-medium">文档处理</h4>
              <p class="text-xs text-gray-500">昨天活跃</p>
            </div>
            <div class="flex items-center">
              <span class="text-xs px-2 py-1 rounded-full bg-green-100 text-green-600 mr-3"
                >运行中</span
              >
              <button class="text-gray-400 hover:text-gray-600 transition-colors">
                <i class="fa fa-ellipsis-v"></i>
              </button>
            </div>
          </div>

          <div class="flex items-center p-3 rounded-lg hover:bg-gray-50 transition-colors">
            <div class="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center mr-4">
              <i class="fa fa-music text-yellow-500"></i>
            </div>
            <div class="flex-1">
              <h4 class="font-medium">音乐控制</h4>
              <p class="text-xs text-gray-500">3天前活跃</p>
            </div>
            <div class="flex items-center">
              <span class="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600 mr-3"
                >已停止</span
              >
              <button class="text-gray-400 hover:text-gray-600 transition-colors">
                <i class="fa fa-ellipsis-v"></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 即将进行的任务 -->
      <div class="bg-white rounded-xl shadow-soft p-6">
        <div class="flex items-center justify-between mb-6">
          <h3 class="font-semibold text-lg">即将进行的任务</h3>
          <a href="#tasks" class="text-secondary text-sm hover:underline transition-colors"
            >查看全部</a
          >
        </div>
        <div class="space-y-4">
          <div class="flex items-center p-3 rounded-lg hover:bg-gray-50 transition-colors">
            <div class="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center mr-4">
              <i class="fa fa-backup text-secondary"></i>
            </div>
            <div class="flex-1">
              <h4 class="font-medium">系统备份</h4>
              <p class="text-xs text-gray-500">今天 18:00 执行</p>
            </div>
            <div class="flex items-center">
              <span class="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-600 mr-3"
                >定时</span
              >
              <button class="text-gray-400 hover:text-gray-600 transition-colors">
                <i class="fa fa-pencil"></i>
              </button>
            </div>
          </div>

          <div class="flex items-center p-3 rounded-lg hover:bg-gray-50 transition-colors">
            <div class="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center mr-4">
              <i class="fa fa-download text-purple-400"></i>
            </div>
            <div class="flex-1">
              <h4 class="font-medium">更新检查</h4>
              <p class="text-xs text-gray-500">明天 09:30 执行</p>
            </div>
            <div class="flex items-center">
              <span class="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-600 mr-3"
                >定时</span
              >
              <button class="text-gray-400 hover:text-gray-600 transition-colors">
                <i class="fa fa-pencil"></i>
              </button>
            </div>
          </div>

          <div class="flex items-center p-3 rounded-lg hover:bg-gray-50 transition-colors">
            <div class="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center mr-4">
              <i class="fa fa-file-pdf-o text-green-500"></i>
            </div>
            <div class="flex-1">
              <h4 class="font-medium">报表生成</h4>
              <p class="text-xs text-gray-500">周六 12:00 执行</p>
            </div>
            <div class="flex items-center">
              <span class="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-600 mr-3"
                >定时</span
              >
              <button class="text-gray-400 hover:text-gray-600 transition-colors">
                <i class="fa fa-pencil"></i>
              </button>
            </div>
          </div>

          <div class="flex items-center p-3 rounded-lg hover:bg-gray-50 transition-colors">
            <div class="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center mr-4">
              <i class="fa fa-bell text-red-400"></i>
            </div>
            <div class="flex-1">
              <h4 class="font-medium">会议提醒</h4>
              <p class="text-xs text-gray-500">下周一 14:00 执行</p>
            </div>
            <div class="flex items-center">
              <span class="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-600 mr-3"
                >定时</span
              >
              <button class="text-gray-400 hover:text-gray-600 transition-colors">
                <i class="fa fa-pencil"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Chart from 'chart.js/auto'

const statisticsData = [
  { label: '平均首字', value: '4.38', unit: 's', change: '+0.2s' },
  { label: '平均总时间', value: '4.38', unit: 's', change: '-0.1s' },
  { label: '平均输出速度', value: '4.38', unit: 's', change: '+0.5s' },
  { label: '最长首字延迟', value: '4.38', unit: 's', change: '+1.2s' },
  { label: '最长时间', value: '4.38', unit: 's', change: '-0.8s' },
  { label: '最高每秒令牌数', value: '4.38', unit: 's', change: '+2.1s' },
  { label: '最短首字延迟', value: '4.38', unit: 's', change: '-0.3s' },
  { label: '最短总时间', value: '4.38', unit: 's', change: '-0.5s' },
  { label: '最短每秒令牌数', value: '4.38', unit: 's', change: '+1.0s' },
]

const currentDate = ref('')

onMounted(() => {
  currentDate.value = new Date().toLocaleDateString('zh-CN')
})

// window.addEventListener('DOMContentLoaded', () => {
//   const dateOptions = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }
//   const currentDate = new Date().toLocaleDateString('zh-CN', dateOptions)
//   document.getElementById('current-date').textContent = currentDate

//   // 初始化活动图表
//   const activityCtx = (document.getElementById('activityChart') as HTMLCanvasElement).getContext(
//     '2d',
//   )
//   const activityChart = new Chart(activityCtx, {
//     type: 'line',
//     data: {
//       labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '现在'],
//       datasets: [
//         {
//           label: '插件活动',
//           data: [5, 2, 8, 15, 10, 12, 8],
//           borderColor: '#F7B8B8',
//           backgroundColor: 'rgba(247, 184, 184, 0.1)',
//           tension: 0.4,
//           fill: true,
//         },
//         {
//           label: '系统资源',
//           data: [10, 5, 15, 25, 20, 18, 15],
//           borderColor: '#C7CEEA',
//           backgroundColor: 'rgba(199, 206, 234, 0.1)',
//           tension: 0.4,
//           fill: true,
//         },
//       ],
//     },
//     options: {
//       responsive: true,
//       maintainAspectRatio: false,
//       plugins: {
//         legend: {
//           position: 'top',
//         },
//       },
//       scales: {
//         y: {
//           beginAtZero: true,
//         },
//       },
//     },
//   })

//   // 初始化资源使用图表
//   const resourceCtx = (document.getElementById('resourceChart') as HTMLCanvasElement).getContext(
//     '2d',
//   )
//   const resourceChart = new Chart(resourceCtx, {
//     type: 'line',
//     data: {
//       labels: ['1小时前', '45分钟前', '30分钟前', '15分钟前', '现在'],
//       datasets: [
//         {
//           label: 'CPU 使用率',
//           data: [18, 22, 25, 20, 24],
//           borderColor: '#FFCAD4',
//           backgroundColor: 'transparent',
//           tension: 0.4,
//           borderWidth: 2,
//           yAxisID: 'y',
//         },
//         {
//           label: '内存使用率',
//           data: [28, 30, 35, 33, 32],
//           borderColor: '#F7B8B8',
//           backgroundColor: 'transparent',
//           tension: 0.4,
//           borderWidth: 2,
//           yAxisID: 'y',
//         },
//         {
//           label: '网络流量 (KB/s)',
//           data: [320, 450, 280, 410, 456],
//           borderColor: '#C7CEEA',
//           backgroundColor: 'transparent',
//           tension: 0.4,
//           borderWidth: 2,
//           yAxisID: 'y1',
//         },
//       ],
//     },
//     options: {
//       responsive: true,
//       maintainAspectRatio: false,
//       plugins: {
//         legend: {
//           position: 'top',
//         },
//       },
//       scales: {
//         y: {
//           type: 'linear',
//           display: true,
//           position: 'left',
//           title: {
//             display: true,
//             text: '使用率 (%)',
//           },
//           min: 0,
//           max: 100,
//         },
//         y1: {
//           type: 'linear',
//           display: true,
//           position: 'right',
//           title: {
//             display: true,
//             text: '流量 (KB/s)',
//           },
//           min: 0,
//           grid: {
//             drawOnChartArea: false,
//           },
//         },
//       },
//     },
//   })
// })
</script>
