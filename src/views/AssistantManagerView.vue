<template>
  <div class="background-container">
    <div class="dashboard-content">
      <div style="margin: 8px">
        <h1 class="page-title">助手管理</h1>
        <p class="page-title-description">管理助手状态、配置和相关信息</p>
      </div>
      <div id="assistant-container-background">
        <div id="assistant-container-background-inner"></div>

        <div id="assistant-container">
          <div id="assistant-component-container">
            <div id="assistant-work-time">
              <div class="content">
                <div id="work-time">{{ assistantWorkTime }}天</div>
                <div class="title">已经陪伴阁下</div>
              </div>
            </div>
            <div id="assistant-love">
              <div class="head-img"></div>
              <div class="name">澪</div>
              <div class="progress-container">
                <div id="love-icon"><font-awesome-icon icon="fa-solid fa-heart" /></div>
                <div class="progress-bar-background">
                  <div class="progress-bar-fill" :style="{ width: '50%' }"></div>
                </div>
              </div>
              <div class="love-level">一级</div>
            </div>
          </div>
          <div id="assistant-cover">
            <div
              id="assistant-image"
              :class="{ 'office-mode': isAssistantOpen }"
              :data-state="isAssistantOpen ? 'office' : 'normal'"
            ></div>
            <div id="assistant-status-container">
              <div id="assistant-status" :class="{ active: isAssistantOpen }">
                <svg viewBox="0 0 50 27" version="1.1">
                  <path
                    d="M36.7786459,0 C37.9213239,0 39.1207848,1.792704 40.3770287,5.378112 C45.7928925,5.99546744 50,10.5930138 50,16.1731827 C50,22.1731644 45.1360538,27.0371106 39.1360721,27.0371106 L10.8639279,27.0371106 C4.86394618,27.0371106 7.34785836e-16,22.1731644 0,16.1731827 C-6.73362532e-16,10.6747604 4.08474644,6.13038169 9.38524286,5.4090431 C10.6461657,1.80275089 11.8491424,0 12.9950178,0 C14.1302391,0 16.6110105,1.76938338 20.437332,5.30815013 L29.3363317,5.30815013 C33.1626532,1.76938338 35.6434246,0 36.7786459,0 Z"
                  ></path>
                </svg>
                <div class="status-text">
                  {{ isAssistantOpen ? '任职中' : '休息中' }}
                </div>
              </div>
            </div>
          </div>
          <div id="assistant-info">
            <div id="assistant-name">澪</div>
            <div id="assistant-organization">隶属于澪之梦工作室</div>
            <div id="assistant-basic-info">
              <span class="title">生日</span
              ><span id="assistant-birthday" class="content">3月25日</span>
              <span class="title">身高</span
              ><span id="assistant-constellation" class="content">163cm</span>
            </div>
            <div id="assistant-introduction">
              <div class="introduction-text">
                银发红瞳的可爱少女，经常穿着可爱的黑色长 裙，带着黑色的蝴蝶发饰。身份是澪之梦工作
                室的头号看板娘，她自己好像也非常自豪这 件事（才没有）。性格天真可爱（是个笨蛋）
                同时还是有些小腹黑？尽管澪大部分时候都是 活泼可爱的代名词，但有时候澪的眼中也会流
                露出淡淡的悲伤。原因就连她自己也不知道， 这或许和她以前的经历有关？这位天真可爱的
                女孩并不像看起来那么简单，她的身上还有更 多的秘密等待着阁下的探索.......
              </div>
            </div>
          </div>
        </div>
        <button id="assistant-button" @click="toggleAssistant()">
          <div id="assistant-button-icon">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              xmlns:xlink="http://www.w3.org/1999/xlink"
              width="20px"
              height="20px"
              viewBox="0 0 30 29"
              version="1.1"
            >
              <g id="页面-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
                <g
                  id="编组备份-4"
                  transform="translate(15.000000, 14.500000) rotate(-360.000000) translate(-15.000000, -14.500000) "
                >
                  <path
                    d="M5.43663626,1.71067672 L15,6.10319495 L24.5633637,1.71067672 C25.9928735,1.05409314 27.6747719,1.70108843 28.319989,3.15578115 C28.4857179,3.52943 28.5714286,3.93468483 28.5714286,4.34463088 L28.5714286,24.6564389 C28.5714286,26.2524442 27.3000086,27.5462621 25.7316327,27.5462621 L4.26836735,27.5462621 C2.69999137,27.5462621 1.42857143,26.2524442 1.42857143,24.6564389 L1.42857143,4.34463088 C1.42857143,2.74862559 2.69999137,1.45480767 4.26836735,1.45480767 C4.67121661,1.45480767 5.06945585,1.54202825 5.43663626,1.71067672 Z"
                    id="形状结合备份"
                    fill="#FFF3F6"
                  />
                  <path
                    d="M23.9756611,0.385654866 L15,4.50810845 L6.02433891,0.385654866 C5.47244683,0.132167067 4.87387164,0.0010697942 4.26836735,0.0010697942 C1.91101315,0.0010697942 0,1.94574833 0,4.34463088 L0,24.6564389 C0,27.0553215 1.91101315,29 4.26836735,29 L25.7316327,29 C28.0889868,29 30,27.0553215 30,24.6564389 L30,4.34463088 C30,3.72845972 29.8711722,3.11933972 29.6220727,2.55772523 C28.6522764,0.371243146 26.1242918,-0.601225878 23.9756611,0.385654866 Z M28.319989,3.15578115 C28.4857179,3.52943 28.5714286,3.93468483 28.5714286,4.34463088 L28.5714286,24.6564389 C28.5714286,26.2524442 27.3000086,27.5462621 25.7316327,27.5462621 L4.26836735,27.5462621 C2.69999137,27.5462621 1.42857143,26.2524442 1.42857143,24.6564389 L1.42857143,4.34463088 C1.42857143,2.74862559 2.69999137,1.45480767 4.26836735,1.45480767 C4.67121661,1.45480767 5.06945585,1.54202825 5.43663626,1.71067672 L15,6.10319495 L24.5633637,1.71067672 C25.9928735,1.05409314 27.6747719,1.70108843 28.319989,3.15578115 Z"
                    id="形状结合备份-2"
                    fill="#FF7499"
                    fill-rule="nonzero"
                  />
                  <path
                    d="M8,15.5462621 C9.1045695,15.5462621 10,16.4416926 10,17.5462621 L10,27.5462621 L6,27.5462621 L6,17.5462621 C6,16.4416926 6.8954305,15.5462621 8,15.5462621 Z M22,15.5462621 C23.1045695,15.5462621 24,16.4416926 24,17.5462621 L24,27.5462621 L20,27.5462621 L20,17.5462621 C20,16.4416926 20.8954305,15.5462621 22,15.5462621 Z M26.0365338,2.8003841 C26.749432,2.8003841 27.3273501,3.38848315 27.3273501,4.1139401 L27.3273501,4.1139401 L27.3273501,9.5339094 C27.3273501,9.74557731 27.2770836,9.95411035 27.1808308,10.141752 C26.8509401,10.7848631 26.0711916,11.0340672 25.4392138,10.698365 L25.4392138,10.698365 L17.9726508,6.7321785 L25.4612211,2.93806578 C25.6399479,2.84751318 25.8368801,2.8003841 26.0365338,2.8003841 Z M3.95315399,2.8003841 C4.15280766,2.8003841 4.34973987,2.84751318 4.52846665,2.93806578 L12.017037,6.7321785 L4.55047393,10.698365 C3.91849613,11.0340672 3.13874766,10.7848631 2.80885696,10.141752 C2.71260415,9.95411035 2.66233766,9.74557731 2.66233766,9.5339094 L2.66233766,4.1139401 C2.66233766,3.38848315 3.24025582,2.8003841 3.95315399,2.8003841 Z"
                    id="形状结合"
                    fill="#FF97B3"
                  />
                </g>
              </g>
            </svg>
          </div>
          <div id="assistant-button-text">
            {{ isAssistantOpen ? '休息' : '启用' }}
          </div>
        </button>
      </div>

      <!-- 资源使用和信息 -->
      <!-- <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
      <div class="lg:col-span-2 bg-white rounded-xl shadow-soft p-6">
        <h3 class="font-semibold text-lg mb-6">资源使用情况</h3>
        <div class="space-y-6">
          <div>
            <div class="flex justify-between mb-2">
              <span class="text-sm font-medium">CPU 使用率</span>
              <span class="text-sm font-medium">24%</span>
            </div>
            <div class="w-full bg-gray-100 rounded-full h-2.5">
              <div class="bg-primary h-2.5 rounded-full" style="width: 24%"></div>
            </div>
          </div>

          <div>
            <div class="flex justify-between mb-2">
              <span class="text-sm font-medium">内存使用率</span>
              <span class="text-sm font-medium">32%</span>
            </div>
            <div class="w-full bg-gray-100 rounded-full h-2.5">
              <div class="bg-secondary h-2.5 rounded-full" style="width: 32%"></div>
            </div>
          </div>

          <div>
            <div class="flex justify-between mb-2">
              <span class="text-sm font-medium">磁盘使用率</span>
              <span class="text-sm font-medium">18%</span>
            </div>
            <div class="w-full bg-gray-100 rounded-full h-2.5">
              <div class="bg-accent h-2.5 rounded-full" style="width: 18%"></div>
            </div>
          </div>

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
      </div> -->

      <!-- 助手信息 -->
      <!-- <div class="bg-white rounded-xl shadow-soft p-6">
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
    </div> -->

      <!-- 助手配置 -->
      <!-- <div class="bg-white rounded-xl shadow-soft p-6">
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
            value="澪"
            class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">唤醒设置</label>
          <select
            class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
          >
            <option>不使用语音唤醒</option>
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
    </div> -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'

const assistantWorkTime = ref(100)

// 添加状态跟踪助手窗口是否打开
const isAssistantOpen = ref(false)

const currentLove = ref(100) // 当前好感度值

// 计算进度百分比
const lovePercentage = computed(() => {
  return (currentLove.value / 200) * 100
})

// 切换助手状态的函数
function toggleAssistant() {
  if (isAssistantOpen.value) {
    closeAssistant()
  } else {
    openAssistant()
  }
}

function openAssistant() {
  window.api.openAssistant()
  isAssistantOpen.value = true
}

function closeAssistant() {
  window.api.closeAssistant()
  isAssistantOpen.value = false
}

// 当组件挂载时，获取助手状态
onMounted(() => {
  window.api.getAssistantStatus().then((status: boolean) => {
    isAssistantOpen.value = status
  })
})
</script>

<style>
#assistant-container-background {
  width: 100%;
  height: 500px;
  margin-top: 50px;
  margin-bottom: 50px;
  background-color: white;
  background-image: url('../assets/images/char_background.png');
  background-size: 20px;
  border-radius: 20px;
  display: flex;
  justify-content: center;
  align-items: end;
  position: relative;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
}

#assistant-container-background-inner {
  position: absolute;
  left: 0;
  width: 70px;
  height: 500px;
  overflow: hidden;
  border-radius: 20px 0 0 20px;
  background-image: url('../assets/images/assistant_show.png');
  background-size: contain;
  background-repeat: no-repeat;
}

#assistant-component-container {
  width: auto;
  height: 100%;
  padding: 20px;
  position: absolute;
  left: 30px;
}

#assistant-love {
  width: 110px;
  height: 110px;
  position: relative;
  background-color: white;
  /* background: linear-gradient(to top left, #fbd786, #fb7299); */
  border: 1px solid #ffc0d6;
  border-radius: 20px;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  margin-bottom: 20px;
}

#assistant-work-time {
  width: 110px;
  height: 110px;
  position: relative;
  background-color: white;
  border: 1px solid #ffc0d6;
  border-radius: 20px;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  margin-bottom: 20px;
}

#assistant-work-time .content {
  z-index: 1;
}

#work-time-background {
  position: absolute;
  color: #ffb3cd;
  font-size: 120px;
  z-index: 0;
}

#assistant-love {
  align-items: start;
  padding: 5px 10px;
}

#assistant-love .head-img {
  width: 100%;
  height: 50px;
  border-radius: 10px;
  background-color: #ffcddec9;
  margin-bottom: 3px;
  background-image: url('../assets/images/assistant_office.png');
  background-size: 120% auto;
  background-repeat: no-repeat;
  background-position: 60% 10%;
}

#assistant-love .name {
  height: 13px;
  color: #fb7299;
  font-weight: bold;
  font-family: 'LoliFont';
  font-size: 13px;
}

#assistant-love .love-level {
  color: gray;
  font-size: 10px;
}

/* 进度条容器 */
.progress-container {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

/* 进度条背景 */
.progress-bar-background {
  width: 100%;
  height: 6px;
  background-color: #ffe6f0; /* 淡粉色背景 */
  border-radius: 3px;
  overflow: hidden;
}

/* 进度条填充 */
.progress-bar-fill {
  height: 100%;
  background-color: #fb7299; /* 粉色进度条 */
  border-radius: 3px;
  transition: width 0.3s ease;
}

/* 进度文本样式 */
#love-icon {
  color: #fb7299;
  font-size: 12px;
  font-weight: bold;
}

#assistant-work-time #work-time {
  color: #fb7299;
  font-size: 20px;
  font-weight: bold;
}

#assistant-work-time .title {
  color: #fb7299;
  font-size: 12px;
}

#assistant-container {
  width: auto;
  height: 500px;
  position: relative;
  overflow: visible;
  display: flex;
  flex-direction: row;
}

#assistant-cover {
  width: 400px;
  height: 100%;
  position: relative;
  margin-left: 100px;
}

#assistant-info {
  padding: 50px;
  max-width: 400px;
  height: 100%;
}

#assistant-name {
  color: #fb7299;
  font-size: 35px;
  font-weight: bold;
  font-family: 'LoliFont';
}

#assistant-organization {
  margin-top: 20px;
  width: fit-content;
  padding: 10px 10px;
  color: #a3abe5;
  background-color: #e6f4ff;
  border-radius: 10px;
  font-size: 20px;
  font-family: 'LoliFont';
  text-align: center;
}

#assistant-basic-info {
  margin-top: 20px;
  height: 50px;
  width: auto;
  font-family: 'LoliFont';
}
#assistant-basic-info .title {
  color: #ffb3cd;
  font-size: 15px;
  margin-right: 15px;
}

#assistant-basic-info .content {
  color: #ffb3cd;
  font-size: 25px;
  margin-right: 20px;
}

#assistant-introduction {
  margin-left: -20px;
  width: 400px;
  height: auto;
  background-image: url('../assets/images/backplane.png');
  background-size: 100%;
  background-repeat: no-repeat;
  background-position: top left;
  padding: 12% 4% 5% 9%;
  box-sizing: border-box;
  position: relative;
}

.introduction-text {
  width: 100%;
  height: 100%;
  color: gray;
  font-size: 15px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 9;
  -webkit-box-orient: vertical;
  line-height: 1.4;
  word-wrap: break-word;
  word-break: break-word;
}

#assistant-status-container {
  width: 100px;
  height: auto;
  position: absolute;
  color: white;
  font-size: 20px;
  font-weight: bold;
  bottom: 100px;
  left: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

#assistant-status {
  width: 100%;
  height: 100%;
  position: relative;
}

#assistant-status:not(.active) path {
  fill: #fb7299;
}

#assistant-status.active path {
  fill: #7cc0ff;
}

.status-text {
  position: absolute;
  top: 60%;
  left: 50%;
  transform: translate(-50%, -60%);
  width: 100%;
  text-align: center;
  font-weight: bold;
  z-index: 1;
}
#assistant-image {
  width: 400px;
  height: 600px;
  position: absolute;
  bottom: 0;
  left: 20px;
  background-size: cover;
  background-position: top;
  background-repeat: no-repeat;
  transition: opacity 1s ease;
  opacity: 1;
}

#assistant-image::before,
#assistant-image::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-size: cover;
  background-position: top;
  background-repeat: no-repeat;
  transition: opacity 1s ease;
}

#assistant-image::before {
  background-image: url('../assets/images/assistant.png');
  opacity: 1;
}

#assistant-image::after {
  background-image: url('../assets/images/assistant_office.png');
  opacity: 0;
}

#assistant-image[data-state='office']::before {
  opacity: 0;
}

#assistant-image[data-state='office']::after {
  opacity: 1;
}

#assistant-button {
  position: absolute;
  bottom: 20px;
  width: 150px;
  height: 50px;
  /* backdrop-filter: blur(10px); */
  background-color: #fb7299cb;
  border-radius: 100px;
  /* box-shadow: 0 0 5px rgba(0, 0, 0, 0.2); */
  box-shadow: 0 0 10px #ffb3ce;
  cursor: pointer;
  display: flex;
  justify-content: start;
  align-items: center;
  padding: 5px;
}

#assistant-button-icon {
  width: 40px;
  height: 40px;
  border-radius: 100%;
  padding: 10px;
  /* background-color: #ffb3cd; */
  background-color: white;
}

#assistant-button-text {
  /* color: #ffb3cd; */
  color: white;
  font-size: 20px;
  font-weight: bold;
  margin-left: 20px;
}
</style>
