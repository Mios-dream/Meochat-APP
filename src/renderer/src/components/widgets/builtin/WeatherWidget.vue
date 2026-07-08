<template>
  <div class="weather-widget">
    <div class="weather-aura" />

    <!-- 左侧信息区 -->
    <div class="weather-left">
      <div class="weather-info">
        <div class="weather-location">
          <font-awesome-icon icon="fa-solid fa-location-dot" class="location-icon" />
          <span class="location-text">{{ weatherData.location }}</span>
        </div>
        <div class="weather-condition">
          <font-awesome-icon :icon="conditionIcon" class="condition-icon" />
          <span class="condition-text">{{ weatherData.condition }}</span>
        </div>
      </div>
      <div class="weather-temp">
        <span class="temp-value">{{ weatherData.temperature }}</span>
        <span class="temp-unit">°C</span>
      </div>
    </div>

    <!-- 右侧Q版助手图像 -->
    <div class="weather-mascot">
      <img src="../../../assets/images/助手Q版.png" alt="Q版助手" />
    </div>
    <!-- 右下角悬浮宠物爪子图标 -->
    <div class="weather-paw">
      <font-awesome-icon icon="fa-solid fa-paw" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, computed, ref, onMounted, onUnmounted } from 'vue'

/**
 * 天气数据接口
 */
interface WeatherData {
  location: string
  condition: string
  temperature: number
}

/** 天气图标映射表 */
const CONDITION_ICON_MAP: Record<string, string> = {
  晴: 'fa-solid fa-sun',
  多云: 'fa-solid fa-cloud-sun',
  阴: 'fa-solid fa-cloud',
  小雨: 'fa-solid fa-cloud-rain',
  中雨: 'fa-solid fa-cloud-showers-heavy',
  大雨: 'fa-solid fa-cloud-showers-heavy',
  暴雨: 'fa-solid fa-cloud-showers-heavy',
  雨: 'fa-solid fa-cloud-rain',
  雪: 'fa-solid fa-snowflake',
  小雪: 'fa-solid fa-snowflake',
  大雪: 'fa-solid fa-snowflake',
  雷: 'fa-solid fa-bolt',
  雷雨: 'fa-solid fa-cloud-bolt',
  雷雪: 'fa-solid fa-cloud-bolt',
  风: 'fa-solid fa-wind',
  霾: 'fa-solid fa-smog',
  烟霾: 'fa-solid fa-smog',
  雾: 'fa-solid fa-smog',
  霜: 'fa-solid fa-snowflake',
  冻雨: 'fa-solid fa-cloud-rain',
  雨夹雪: 'fa-solid fa-cloud-snow-rain',
  冰雹: 'fa-solid fa-cloud-meatball'
}

/** 天气响应式数据 */
const weatherData = reactive<WeatherData>({
  location: '雾都',
  condition: '晴',
  temperature: 26
})

/** 天气查询目标（城市名或经纬度路径） */
const weatherQuery = ref<string>('重庆')

/** 加载状态 */
const isLoading = ref<boolean>(false)

/** 错误信息 */
const error = ref<string>('')

/** 定时刷新定时器ID */
let refreshTimer: ReturnType<typeof setInterval> | null = null

/** 刷新间隔（15分钟） */
const REFRESH_INTERVAL = 15 * 60 * 1000

/** 根据天气状况返回对应的FontAwesome图标 */
const conditionIcon = computed<string>(() => {
  return CONDITION_ICON_MAP[weatherData.condition] || 'fa-solid fa-cloud-sun'
})

/**
 * 从widgetApi获取真实天气数据
 * 通过IPC调用主进程天气API
 */
async function fetchRealWeather(): Promise<void> {
  if (isLoading.value) return

  isLoading.value = true
  error.value = ''

  try {
    const result = await window.widgetApi.fetchWeather(weatherQuery.value)
    if (result.success && result.data) {
      weatherData.location = result.data.location
      weatherData.condition = result.data.condition
      weatherData.temperature = result.data.temperature
    } else {
      error.value = result.error || '获取天气数据失败'
      console.warn('[WeatherWidget] 获取天气失败:', error.value)
    }
  } catch (err) {
    error.value = (err as Error).message || '网络请求失败'
    console.error('[WeatherWidget] 天气请求异常:', err)
  } finally {
    isLoading.value = false
  }
}

/** 更新天气数据（外部调用接口，保持向后兼容） */
function updateWeather(data: Partial<WeatherData>): void {
  if (data.location !== undefined) {
    weatherData.location = data.location
    weatherQuery.value = data.location
  }
  if (data.condition !== undefined) {
    weatherData.condition = data.condition
  }
  if (data.temperature !== undefined) {
    weatherData.temperature = data.temperature
  }
  // 城市变更后重新获取真实天气
  fetchRealWeather()
}

/**
 * 启动定时刷新
 * 每15分钟自动获取最新天气数据
 */
function startAutoRefresh(): void {
  stopAutoRefresh()
  refreshTimer = setInterval(() => {
    fetchRealWeather()
  }, REFRESH_INTERVAL)
}

/** 停止定时刷新 */
function stopAutoRefresh(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

onMounted(async () => {
  // 组件挂载时尝试获取位置信息，优先使用系统坐标直接请求天气
  try {
    const locResult = await window.widgetApi.getLocation()
    if (locResult && locResult.success && locResult.data) {
      const { lat, lon } = locResult.data
      if (typeof lat === 'number' && typeof lon === 'number') {
        weatherQuery.value = `/${lat},${lon}`
      }
    }
  } catch (e) {
    console.warn('[WeatherWidget] 获取位置信息失败:', e)
  }

  // 获取真实天气并启动定时刷新
  fetchRealWeather()
  startAutoRefresh()

  // ── 小组件动作协议监听 ──
  // 处理来自 LLM 工具调用的 remote action 指令
  window.widgetApi?.onAction((request) => {
    if (request.widget_type !== 'weather') return

    const { action_id, action, params } = request

    switch (action) {
      case 'set_location': {
        const city = typeof params.city === 'string' ? params.city.trim() : ''
        if (!city) {
          window.widgetApi.sendActionResult({ action_id, success: false, error: 'city 参数为空' })
          return
        }
        weatherQuery.value = city
        weatherData.location = city
        fetchRealWeather()
          .then(() => {
            window.widgetApi.sendActionResult({
              action_id,
              success: true,
              result: { location: city, updated: true }
            })
          })
          .catch((err) => {
            window.widgetApi.sendActionResult({
              action_id,
              success: false,
              error: (err as Error).message
            })
          })
        break
      }
      case 'get_weather': {
        window.widgetApi.sendActionResult({
          action_id,
          success: true,
          result: {
            location: weatherData.location,
            condition: weatherData.condition,
            temperature: weatherData.temperature
          }
        })
        break
      }
      default:
        window.widgetApi.sendActionResult({
          action_id,
          success: false,
          error: `未知动作: ${action}`
        })
    }
  })
})

onUnmounted(() => {
  stopAutoRefresh()
})

defineExpose({
  updateWeather
})
</script>

<style scoped>
.weather-widget {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  height: 90%;
  /* padding: 10px 20px; */
  background: #ffffff;
  border-radius: 14dvh;
  margin-bottom: 10px;
}

.weather-aura {
  position: absolute;
  inset: 8px;
  border-radius: 22px;
  pointer-events: none;
}

/* ── 左侧信息区 ── */
.weather-left {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  flex-direction: column;
  padding-left: 15px;
}

.weather-info {
  display: flex;
  flex-direction: row;
  gap: 15px;
}

.weather-location {
  display: flex;
  align-items: center;
  max-width: 100px;
  gap: 3px;
  color: #4a3142;
  font-size: 14px;
  font-weight: 700;
}

.location-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.location-icon {
  color: var(--theme-color, #fb7299);
  font-size: 18px;
  filter: drop-shadow(-1px -1px 0 white) drop-shadow(1px -1px 0 white) drop-shadow(-1px 1px 0 white)
    drop-shadow(1px 1px 0 white);
}

.weather-condition {
  display: flex;
  align-items: center;
  gap: 3px;
  color: #6f2b43;
  font-size: 14px;
  font-weight: 800;
}

.condition-icon {
  color: var(--theme-color, #fb7299);
  font-size: 18px;
  filter: drop-shadow(-1px -1px 0 white) drop-shadow(1px -1px 0 white) drop-shadow(-1px 1px 0 white)
    drop-shadow(1px 1px 0 white);
}

/* ── 温度区域 ── */
.weather-temp {
  /* margin-left: 25px; */
  margin: auto;
  display: flex;
  align-items: flex-start;
}

.temp-value {
  font-size: 52px;
  font-weight: 900;
  line-height: 1;
  color: var(--theme-color, #fb7299);
  letter-spacing: -0.02em;
  text-shadow: 0 2px 18px rgba(251, 114, 153, 0.5);
}

.temp-unit {
  font-size: 18px;
  font-weight: 800;
  color: var(--theme-color, #fb7299);
  margin-top: 6px;
  margin-left: 2px;
  opacity: 0.8;
}

/* ── 右侧Q版助手图像 ── */
.weather-mascot {
  position: relative;
  z-index: 1;
  flex-shrink: 0;
  width: 100px;
  height: 100%;
  overflow: hidden;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.weather-mascot img {
  width: 120%;
  height: 120%;
  object-fit: contain;
}

/* ── 右下角悬浮宠物爪子图标 ── */
.weather-paw {
  position: absolute;
  z-index: 2;
  right: -10px;
  bottom: -15px;
  width: 50px;
  height: 50px;
  transform: rotate(-30deg);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ff8da1;
  font-size: 25px;
  /* animation: pawFloat 2.6s ease-in-out infinite; */
  cursor: default;
  filter: drop-shadow(-1px -1px 0 white) drop-shadow(1px -1px 0 white) drop-shadow(-1px 1px 0 white)
    drop-shadow(1px 1px 0 white);
  user-select: none;
}
</style>
