<template>
  <div class="weather-widget">
    <!-- 天气主体 -->
    <div class="weather-main">
      <!-- 天气图标 -->
      <div class="weather-icon-container">
        <div class="weather-icon" :class="currentWeather.icon">
          <span class="icon-emoji">{{ currentWeather.emoji }}</span>
        </div>
        <div class="weather-temp">{{ currentWeather.temp }}°</div>
      </div>

      <!-- 天气信息 -->
      <div class="weather-info">
        <div class="weather-condition">{{ currentWeather.condition }}</div>
        <div class="weather-detail">
          <span class="detail-item">
            <font-awesome-icon icon="fa-solid fa-temperature-half" />
            体感 {{ currentWeather.feelsLike }}°
          </span>
          <span class="detail-item">
            <font-awesome-icon icon="fa-solid fa-droplet" />
            {{ currentWeather.humidity }}%
          </span>
          <span class="detail-item">
            <font-awesome-icon icon="fa-solid fa-wind" />
            {{ currentWeather.wind }}km/h
          </span>
        </div>
      </div>
    </div>

    <!-- 城市选择 -->
    <div class="weather-city">
      <font-awesome-icon icon="fa-solid fa-location-dot" class="city-icon" />
      <select v-model="selectedCity" class="city-select" @change="updateWeather">
        <option v-for="city in cities" :key="city.name" :value="city.name">
          {{ city.name }}
        </option>
      </select>
    </div>

    <!-- 未来天气 -->
    <div class="weather-forecast">
      <div
        v-for="(day, index) in forecast"
        :key="index"
        class="forecast-item"
        :class="{ today: index === 0 }"
      >
        <div class="forecast-day">{{ day.day }}</div>
        <div class="forecast-icon">{{ day.emoji }}</div>
        <div class="forecast-temp">
          <span class="temp-high">{{ day.high }}°</span>
          <span class="temp-low">{{ day.low }}°</span>
        </div>
      </div>
    </div>

    <!-- 更新时间 -->
    <div class="weather-update">
      <font-awesome-icon icon="fa-solid fa-clock" />
      <span>更新于 {{ updateTime }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

/** 天气数据接口 */
interface WeatherData {
  temp: number
  feelsLike: number
  condition: string
  humidity: number
  wind: number
  icon: string
  emoji: string
}

/** 预报数据接口 */
interface ForecastData {
  day: string
  high: number
  low: number
  icon: string
  emoji: string
}

/** 城市数据接口 */
interface CityData {
  name: string
  weather: WeatherData
  forecast: ForecastData[]
}

/** 模拟天气数据 */
const WEATHER_DATA: Record<string, CityData> = {
  '北京': {
    name: '北京',
    weather: { temp: 22, feelsLike: 20, condition: '晴', humidity: 45, wind: 12, icon: 'sunny', emoji: '☀️' },
    forecast: [
      { day: '今天', high: 22, low: 14, icon: 'sunny', emoji: '☀️' },
      { day: '明天', high: 25, low: 16, icon: 'cloudy', emoji: '⛅' },
      { day: '后天', high: 20, low: 12, icon: 'rainy', emoji: '🌧️' }
    ]
  },
  '上海': {
    name: '上海',
    weather: { temp: 26, feelsLike: 28, condition: '多云', humidity: 65, wind: 8, icon: 'cloudy', emoji: '⛅' },
    forecast: [
      { day: '今天', high: 26, low: 20, icon: 'cloudy', emoji: '⛅' },
      { day: '明天', high: 28, low: 22, icon: 'sunny', emoji: '☀️' },
      { day: '后天', high: 24, low: 19, icon: 'rainy', emoji: '🌧️' }
    ]
  },
  '广州': {
    name: '广州',
    weather: { temp: 30, feelsLike: 32, condition: '炎热', humidity: 75, wind: 5, icon: 'hot', emoji: '🌡️' },
    forecast: [
      { day: '今天', high: 30, low: 25, icon: 'sunny', emoji: '☀️' },
      { day: '明天', high: 31, low: 26, icon: 'stormy', emoji: '⛈️' },
      { day: '后天', high: 29, low: 24, icon: 'rainy', emoji: '🌧️' }
    ]
  },
  '成都': {
    name: '成都',
    weather: { temp: 18, feelsLike: 17, condition: '阴', humidity: 70, wind: 6, icon: 'cloudy', emoji: '☁️' },
    forecast: [
      { day: '今天', high: 18, low: 13, icon: 'cloudy', emoji: '☁️' },
      { day: '明天', high: 20, low: 14, icon: 'sunny', emoji: '☀️' },
      { day: '后天', high: 17, low: 12, icon: 'rainy', emoji: '🌧️' }
    ]
  },
  '杭州': {
    name: '杭州',
    weather: { temp: 24, feelsLike: 25, condition: '晴转多云', humidity: 55, wind: 10, icon: 'partly-cloudy', emoji: '🌤️' },
    forecast: [
      { day: '今天', high: 24, low: 17, icon: 'partly-cloudy', emoji: '🌤️' },
      { day: '明天', high: 26, low: 19, icon: 'sunny', emoji: '☀️' },
      { day: '后天', high: 22, low: 16, icon: 'cloudy', emoji: '⛅' }
    ]
  }
}

interface Emits {
  (e: 'update:city', city: string): void
  (e: 'refresh'): void
}

const emit = defineEmits<Emits>()

/** 城市列表 */
const cities = Object.values(WEATHER_DATA)

/** 选中的城市 */
const selectedCity = ref('北京')

/** 当前天气 */
const currentWeather = computed<WeatherData>(() => {
  return WEATHER_DATA[selectedCity.value]?.weather || WEATHER_DATA['北京'].weather
})

/** 天气预报 */
const forecast = computed<ForecastData[]>(() => {
  return WEATHER_DATA[selectedCity.value]?.forecast || WEATHER_DATA['北京'].forecast
})

/** 更新时间 */
const updateTime = computed(() => {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
})

/** 更新天气 */
function updateWeather(): void {
  emit('update:city', selectedCity.value)
  emit('refresh')
}

/** 组件挂载 */
onMounted(() => {
  // 默认选择北京
  selectedCity.value = '北京'
})

/** 暴露方法 */
defineExpose({
  getCity: () => selectedCity.value,
  setCity: (city: string) => {
    if (WEATHER_DATA[city]) {
      selectedCity.value = city
      updateWeather()
    }
  }
})
</script>

<style scoped>
.weather-widget {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  background: linear-gradient(135deg, #e8f4f8 0%, #f0e6ff 100%);
  border-radius: 16px;
  backdrop-filter: blur(10px);
}

.weather-main {
  display: flex;
  align-items: center;
  gap: 20px;
}

.weather-icon-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.weather-icon {
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48px;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

.weather-temp {
  font-size: 36px;
  font-weight: 700;
  color: var(--theme-text-color-dark, #333);
}

.weather-info {
  flex: 1;
}

.weather-condition {
  font-size: 20px;
  font-weight: 600;
  color: var(--theme-text-color-dark, #333);
  margin-bottom: 8px;
}

.weather-detail {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 13px;
  color: #666;
}

.detail-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.detail-item svg {
  color: var(--theme-color, #fb7299);
  font-size: 12px;
}

.weather-city {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 12px;
}

.city-icon {
  color: var(--theme-color, #fb7299);
  font-size: 16px;
}

.city-select {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 14px;
  font-weight: 500;
  color: var(--theme-text-color-dark, #333);
  cursor: pointer;
  outline: none;
}

.city-select option {
  background: white;
  color: #333;
}

.weather-forecast {
  display: flex;
  gap: 12px;
}

.forecast-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px 8px;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 12px;
  transition: all 0.2s ease;
}

.forecast-item.today {
  background: linear-gradient(135deg, var(--theme-color-light, #ffd1e8), var(--theme-color, #fb7299));
  color: white;
}

.forecast-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.forecast-day {
  font-size: 12px;
  font-weight: 500;
  opacity: 0.8;
}

.forecast-item.today .forecast-day {
  opacity: 1;
}

.forecast-icon {
  font-size: 24px;
}

.forecast-temp {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  font-size: 14px;
}

.temp-high {
  font-weight: 600;
}

.temp-low {
  font-size: 12px;
  opacity: 0.7;
}

.weather-update {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 11px;
  color: #999;
}

.weather-update svg {
  font-size: 10px;
}
</style>
