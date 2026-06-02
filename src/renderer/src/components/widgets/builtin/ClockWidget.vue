<template>
  <div class="clock-widget">
    <div class="clock-aura" />
    <div class="clock-topline">
      <span class="clock-label">Moe Clock</span>
      <span class="clock-spark">✦</span>
    </div>

    <div class="clock-stage">
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
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  height: 100%;
  min-width: 220px;
  min-height: 170px;
  padding: 18px;
  overflow: hidden;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.78)),
    url('../../../assets/images/background_circle.png');
  background-size: auto, 56px 38px;
  border: 2px solid rgba(255, 255, 255, 0.78);
  border-radius: 26px;
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.72),
    0 18px 36px rgba(139, 30, 63, 0.2);
  backdrop-filter: blur(14px);
}

.clock-widget::before {
  content: '';
  position: absolute;
  right: -24px;
  bottom: -34px;
  width: 126px;
  height: 126px;
  background: url('../../../assets/images/assistant_avatar_medium.png') center / contain no-repeat;
  opacity: 0.24;
  pointer-events: none;
}

.clock-widget::after {
  content: '';
  position: absolute;
  left: -28px;
  top: -32px;
  width: 120px;
  height: 120px;
  background: url('../../../assets/images/sakura.webp') center / contain no-repeat;
  opacity: 0.18;
  transform: rotate(-18deg);
  pointer-events: none;
}

.clock-aura {
  position: absolute;
  inset: 14px;
  border-radius: 22px;
  background: radial-gradient(circle at 50% 10%, rgba(255, 247, 250, 0.84), transparent 58%);
  pointer-events: none;
}

.clock-topline {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #8b1e3f;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.clock-label {
  padding: 4px 12px;
  background: #fff5f9;
  border: 1px solid rgba(251, 114, 153, 0.22);
  border-radius: 999px;
}

.clock-spark {
  color: var(--theme-color, #fb7299);
  filter: drop-shadow(0 0 8px rgba(251, 114, 153, 0.55));
}

.clock-stage {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.time-display {
  display: flex;
  align-items: baseline;
  gap: 2px;
  font-size: clamp(34px, 16vw, 58px);
  font-weight: 900;
  color: #8b1e3f;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  text-shadow:
    0 3px 0 #fff,
    0 10px 22px rgba(139, 30, 63, 0.2);
}

.time-hours,
.time-minutes,
.time-seconds {
  display: inline-block;
  min-width: 1.1em;
  text-align: center;
}

.time-separator {
  color: #ff8bb5;
  font-weight: 800;
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
  padding: 2px 7px;
  border-radius: 999px;
  background: #fff7fa;
  font-size: 14px;
  font-weight: 800;
  color: var(--theme-color, #fb7299);
  margin-left: 8px;
}

.date-display {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.date-main {
  display: flex;
  gap: 8px;
  padding: 7px 12px;
  background: #fff7fa;
  border: 1px solid rgba(251, 114, 153, 0.14);
  border-radius: 999px;
  font-size: 14px;
  color: #7a3950;
}

.date-year,
.date-month,
.date-day {
  font-weight: 500;
}

.date-weekday {
  padding: 7px 12px;
  border-radius: 999px;
  background: #ffe8f1;
  color: var(--theme-color, #fb7299);
  font-size: 13px;
  font-weight: 800;
}

.lunar-display {
  padding: 6px 14px;
  background: linear-gradient(135deg, #ff9ec3, var(--theme-color, #fb7299));
  border: 2px solid rgba(255, 255, 255, 0.76);
  border-radius: 999px;
  color: white;
  font-size: 13px;
  font-weight: 800;
  box-shadow: 0 8px 18px rgba(251, 114, 153, 0.28);
}

.clock-controls {
  position: relative;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}

.control-btn {
  padding: 6px 12px;
  border: 1px solid rgba(251, 114, 153, 0.18);
  border-radius: 999px;
  background: #fff7fa;
  color: #8b1e3f;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.2s ease;
}

.control-btn:hover {
  transform: translateY(-1px);
  background: #fff;
  color: var(--theme-color, #fb7299);
}

.control-btn.active {
  background: linear-gradient(135deg, #ff9ec3, var(--theme-color, #fb7299));
  color: white;
  box-shadow: 0 8px 18px rgba(251, 114, 153, 0.26);
}

.control-btn.active:hover {
  background: var(--theme-color-dark, #e05a8a);
}
</style>
