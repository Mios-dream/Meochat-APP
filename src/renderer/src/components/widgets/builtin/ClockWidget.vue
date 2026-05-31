<template>
  <div class="clock-widget">
    <!-- 时间显示 -->
    <div class="time-display">
      <span class="time-hours">{{ hours }}</span>
      <span class="time-separator" :class="{ blink: showSeconds }">:</span>
      <span class="time-minutes">{{ minutes }}</span>
      <template v-if="showSeconds">
        <span class="time-separator blink">:</span>
        <span class="time-seconds">{{ seconds }}</span>
      </template>
      <span v-if="!is24Hour" class="time-period">{{ period }}</span>
    </div>

    <!-- 日期显示 -->
    <div class="date-display">
      <div class="date-main">
        <span class="date-year">{{ year }}年</span>
        <span class="date-month">{{ month }}月</span>
        <span class="date-day">{{ day }}日</span>
      </div>
      <div class="date-weekday">{{ weekday }}</div>
    </div>

    <!-- 农历显示 -->
    <div v-if="showLunar" class="lunar-display">
      <span class="lunar-date">{{ lunarDate }}</span>
    </div>

    <!-- 控制按钮 -->
    <div class="clock-controls">
      <button
        class="control-btn"
        :class="{ active: !is24Hour }"
        @click="toggleFormat"
        title="切换12/24小时制"
      >
        {{ is24Hour ? '24H' : '12H' }}
      </button>
      <button
        class="control-btn"
        :class="{ active: showSeconds }"
        @click="showSeconds = !showSeconds"
        title="显示/隐藏秒数"
      >
        秒
      </button>
      <button
        class="control-btn"
        :class="{ active: showLunar }"
        @click="showLunar = !showLunar"
        title="显示/隐藏农历"
      >
        农历
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

/** 星期映射 */
const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

/** 农历月份名称 */
const LUNAR_MONTHS = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月']

/** 农历日期名称 */
const LUNAR_DAYS = [
  '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'
]

interface Emits {
  (e: 'update:format', is24Hour: boolean): void
}

const emit = defineEmits<Emits>()

/** 当前时间 */
const now = ref(new Date())

/** 是否24小时制 */
const is24Hour = ref(true)

/** 是否显示秒数 */
const showSeconds = ref(true)

/** 是否显示农历 */
const showLunar = ref(false)

/** 定时器 */
let timer: ReturnType<typeof setInterval> | null = null

/** 小时 */
const hours = computed(() => {
  const h = now.value.getHours()
  if (!is24Hour.value) {
    return String(h % 12 || 12).padStart(2, '0')
  }
  return String(h).padStart(2, '0')
})

/** 分钟 */
const minutes = computed(() => String(now.value.getMinutes()).padStart(2, '0'))

/** 秒数 */
const seconds = computed(() => String(now.value.getSeconds()).padStart(2, '0'))

/** 上午/下午 */
const period = computed(() => now.value.getHours() < 12 ? 'AM' : 'PM')

/** 年份 */
const year = computed(() => now.value.getFullYear())

/** 月份 */
const month = computed(() => String(now.value.getMonth() + 1).padStart(2, '0'))

/** 日期 */
const day = computed(() => String(now.value.getDate()).padStart(2, '0'))

/** 星期 */
const weekday = computed(() => WEEKDAYS[now.value.getDay()])

/** 农历日期（简化版） */
const lunarDate = computed(() => {
  const date = now.value
  const month = date.getMonth()
  const day = date.getDate()

  // 简化的农历计算（仅用于展示，非精确农历）
  const lunarMonth = LUNAR_MONTHS[month % 12]
  const lunarDay = LUNAR_DAYS[(day - 1) % 30]

  return `${lunarMonth}${lunarDay}`
})

/** 切换12/24小时制 */
function toggleFormat(): void {
  is24Hour.value = !is24Hour.value
  emit('update:format', is24Hour.value)
}

/** 更新时间 */
function updateTime(): void {
  now.value = new Date()
}

/** 组件挂载 */
onMounted(() => {
  updateTime()
  timer = setInterval(updateTime, 1000)
})

/** 组件卸载 */
onUnmounted(() => {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
})

/** 暴露方法 */
defineExpose({
  getFormat: () => is24Hour.value,
  setFormat: (value: boolean) => {
    is24Hour.value = value
  }
})
</script>

<style scoped>
.clock-widget {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 16px;
  backdrop-filter: blur(10px);
}

.time-display {
  display: flex;
  align-items: baseline;
  gap: 2px;
  font-size: 48px;
  font-weight: 700;
  color: var(--theme-text-color-dark, #333);
  font-variant-numeric: tabular-nums;
}

.time-hours,
.time-minutes,
.time-seconds {
  display: inline-block;
  min-width: 1.1em;
  text-align: center;
}

.time-separator {
  color: var(--theme-color, #fb7299);
  font-weight: 400;
  opacity: 1;
  transition: opacity 0.3s ease;
}

.time-separator.blink {
  animation: blink 1s step-end infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.time-period {
  font-size: 18px;
  font-weight: 500;
  color: var(--theme-color, #fb7299);
  margin-left: 8px;
}

.date-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.date-main {
  display: flex;
  gap: 8px;
  font-size: 16px;
  color: #666;
}

.date-year,
.date-month,
.date-day {
  font-weight: 500;
}

.date-weekday {
  font-size: 14px;
  color: var(--theme-color, #fb7299);
  font-weight: 600;
}

.lunar-display {
  padding: 4px 12px;
  background: linear-gradient(135deg, var(--theme-color-light, #ffd1e8), var(--theme-color, #fb7299));
  border-radius: 20px;
  color: white;
  font-size: 13px;
  font-weight: 500;
}

.clock-controls {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.control-btn {
  padding: 4px 10px;
  border: none;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.05);
  color: #666;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.control-btn:hover {
  background: rgba(0, 0, 0, 0.08);
  color: var(--theme-text-color-dark, #333);
}

.control-btn.active {
  background: var(--theme-color, #fb7299);
  color: white;
}

.control-btn.active:hover {
  background: var(--theme-color-dark, #e05a8a);
}
</style>
