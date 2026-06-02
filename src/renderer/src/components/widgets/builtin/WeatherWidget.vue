<template>
  <div class="weather-widget">
    <div class="weather-title">Sky Report</div>
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
  北京: {
    name: '北京',
    weather: {
      temp: 22,
      feelsLike: 20,
      condition: '晴',
      humidity: 45,
      wind: 12,
      icon: 'sunny',
      emoji: '☀️'
    },
    forecast: [
      { day: '今天', high: 22, low: 14, icon: 'sunny', emoji: '☀️' },
      { day: '明天', high: 25, low: 16, icon: 'cloudy', emoji: '⛅' },
      { day: '后天', high: 20, low: 12, icon: 'rainy', emoji: '🌧️' }
    ]
  },
  上海: {
    name: '上海',
    weather: {
      temp: 26,
      feelsLike: 28,
      condition: '多云',
      humidity: 65,
      wind: 8,
      icon: 'cloudy',
      emoji: '⛅'
    },
    forecast: [
      { day: '今天', high: 26, low: 20, icon: 'cloudy', emoji: '⛅' },
      { day: '明天', high: 28, low: 22, icon: 'sunny', emoji: '☀️' },
      { day: '后天', high: 24, low: 19, icon: 'rainy', emoji: '🌧️' }
    ]
  },
  广州: {
    name: '广州',
    weather: {
      temp: 30,
      feelsLike: 32,
      condition: '炎热',
      humidity: 75,
      wind: 5,
      icon: 'hot',
      emoji: '🌡️'
    },
    forecast: [
      { day: '今天', high: 30, low: 25, icon: 'sunny', emoji: '☀️' },
      { day: '明天', high: 31, low: 26, icon: 'stormy', emoji: '⛈️' },
      { day: '后天', high: 29, low: 24, icon: 'rainy', emoji: '🌧️' }
    ]
  },
  成都: {
    name: '成都',
    weather: {
      temp: 18,
      feelsLike: 17,
      condition: '阴',
      humidity: 70,
      wind: 6,
      icon: 'cloudy',
      emoji: '☁️'
    },
    forecast: [
      { day: '今天', high: 18, low: 13, icon: 'cloudy', emoji: '☁️' },
      { day: '明天', high: 20, low: 14, icon: 'sunny', emoji: '☀️' },
      { day: '后天', high: 17, low: 12, icon: 'rainy', emoji: '🌧️' }
    ]
  },
  杭州: {
    name: '杭州',
    weather: {
      temp: 24,
      feelsLike: 25,
      condition: '晴转多云',
      humidity: 55,
      wind: 10,
      icon: 'partly-cloudy',
      emoji: '🌤️'
    },
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
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
  height: 100%;
  min-width: 270px;
  min-height: 250px;
  padding: 18px;
  overflow: hidden;
  background:
    linear-gradient(150deg, rgba(255, 255, 255, 0.92), rgba(255, 255, 255, 0.78)),
    url('../../../assets/images/char_background.png');
  background-size: auto, 24px 24px;
  border: 2px solid rgba(255, 255, 255, 0.84);
  border-radius: 26px;
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.72),
    0 18px 34px rgba(73, 115, 150, 0.18);
  backdrop-filter: blur(14px);
}

.weather-widget::after {
  content: '';
  position: absolute;
  right: -34px;
  top: -38px;
  width: 150px;
  height: 150px;
  background: url('../../../assets/images/background_circle.png') center / 58px 40px repeat;
  opacity: 0.34;
  pointer-events: none;
}

.weather-title {
  position: relative;
  z-index: 1;
  align-self: flex-start;
  padding: 5px 12px;
  border: 1px solid rgba(251, 114, 153, 0.2);
  border-radius: 999px;
  background: #fff5f9;
  color: #8b1e3f;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.08em;
}

.weather-main {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 12px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.74);
  border: 1px solid rgba(251, 114, 153, 0.12);
}

.weather-icon-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.weather-icon {
  width: 70px;
  height: 70px;
  border-radius: 50%;
  background: #fff7fa;
  box-shadow: inset 0 0 0 1px rgba(251, 114, 153, 0.14);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48px;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
}

.weather-temp {
  font-size: 36px;
  font-weight: 700;
  color: #8b1e3f;
}

.weather-info {
  flex: 1;
}

.weather-condition {
  font-size: 20px;
  font-weight: 600;
  color: #6f2b43;
  margin-bottom: 8px;
}

.weather-detail {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 13px;
  color: #8f6071;
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
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.76);
  border: 1px solid rgba(251, 114, 153, 0.14);
  border-radius: 999px;
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
  color: #6f2b43;
  cursor: pointer;
  outline: none;
}

.city-select option {
  background: white;
  color: #333;
}

.weather-forecast {
  position: relative;
  z-index: 1;
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
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(251, 114, 153, 0.12);
  border-radius: 18px;
  transition: all 0.2s ease;
}

.forecast-item.today {
  background: linear-gradient(
    135deg,
    var(--theme-color-light, #ffd1e8),
    var(--theme-color, #fb7299)
  );
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
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 11px;
  color: #9a6275;
}

.weather-update svg {
  font-size: 10px;
}
</style>
