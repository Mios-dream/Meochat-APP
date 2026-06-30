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
  </div>
  <!-- 右下角悬浮宠物爪子图标 -->
  <div class="weather-paw">
    <font-awesome-icon icon="fa-solid fa-paw" />
  </div>
</template>

<script setup lang="ts">
import { reactive, computed } from 'vue'

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
  风: 'fa-solid fa-wind',
  霾: 'fa-solid fa-smog',
  雾: 'fa-solid fa-smog',
  霜: 'fa-solid fa-snowflake',
  冰雹: 'fa-solid fa-cloud-meatball'
}

/** 天气响应式数据 */
const weatherData = reactive<WeatherData>({
  location: '东京',
  condition: '晴',
  temperature: 26
})

/** 根据天气状况返回对应的FontAwesome图标 */
const conditionIcon = computed<string>(() => {
  return CONDITION_ICON_MAP[weatherData.condition] || 'fa-solid fa-cloud-sun'
})

/** 更新天气数据 */
function updateWeather(data: Partial<WeatherData>): void {
  if (data.location !== undefined) {
    weatherData.location = data.location
  }
  if (data.condition !== undefined) {
    weatherData.condition = data.condition
  }
  if (data.temperature !== undefined) {
    weatherData.temperature = data.temperature
  }
}

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
  overflow: hidden;
  background: #ffffff;
  border-radius: 14dvh;
  margin-bottom: 10px;
}

.weather-aura {
  position: absolute;
  inset: 8px;
  border-radius: 22px;
  background: radial-gradient(circle at 30% 60%, rgba(255, 182, 193, 0.18), transparent 65%);
  pointer-events: none;
}

/* ── 左侧信息区 ── */
.weather-left {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 10px 20px;
}

.weather-info {
  display: flex;
  flex-direction: row;
  gap: 15px;
}

.weather-location {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #4a3142;
  font-size: 14px;
  font-weight: 700;
}

.location-icon {
  color: var(--theme-color, #fb7299);
  font-size: 18px;
  filter: drop-shadow(-1px -1px 0 white) drop-shadow(1px -1px 0 white) drop-shadow(-1px 1px 0 white)
    drop-shadow(1px 1px 0 white);
}

.location-text {
  letter-spacing: 0.04em;
}

.weather-condition {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #6f2b43;
  font-size: 15px;
  font-weight: 800;
}

.condition-icon {
  color: var(--theme-color, #fb7299);
  font-size: 18px;
  filter: drop-shadow(-1px -1px 0 white) drop-shadow(1px -1px 0 white) drop-shadow(-1px 1px 0 white)
    drop-shadow(1px 1px 0 white);
}

.condition-text {
  letter-spacing: 0.04em;
}

/* ── 温度区域 ── */
.weather-temp {
  margin-left: 25px;
  display: flex;
  align-items: flex-start;
}

.temp-value {
  font-size: 52px;
  font-weight: 900;
  line-height: 1;
  color: var(--theme-color, #fb7299);
  letter-spacing: -0.02em;
  text-shadow: 0 2px 12px rgba(251, 114, 153, 0.2);
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
  flex: 1;
  flex-shrink: 0;
  width: auto;
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
  right: -8px;
  bottom: -7px;
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
