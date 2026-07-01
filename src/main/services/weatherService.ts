/**
 * 天气服务 - 基于 wttr.in 公共天气API获取真实天气数据
 *
 * wttr.in 是一个面向开发者的免费天气API，数据源为 weatherapi.com，
 * 支持中文城市名，返回JSON格式数据，无需API Key。
 *
 * 工作流：
 * 1. 通过城市名直接查询天气数据
 * 2. 解析JSON响应，提取温度、天气状况、城市名
 * 3. 转换为前端WeatherWidget所需的统一格式
 */

import axios from 'axios'
import log from '../utils/logger'

// ==================== 类型定义 ====================

/**
 * 前端WeatherWidget所需的标准化天气数据
 */
export interface WeatherData {
  /** 城市名称 */
  location: string
  /** 天气状况描述（中文，如"晴"、"多云"） */
  condition: string
  /** 当前温度（摄氏度） */
  temperature: number
}

/**
 * fetchWeatherByCity 的返回值类型
 */
export interface WeatherFetchResult {
  /** 是否成功 */
  success: boolean
  /** 天气数据（成功时存在） */
  data?: WeatherData
  /** 错误信息（失败时存在） */
  error?: string
}

// ==================== 常量配置 ====================

/** wttr.in API基础URL */
const WTTR_BASE = 'https://wttr.in'

/** 请求超时时间（毫秒） */
const REQUEST_TIMEOUT = 10000

/**
 * wttr.in 返回的天气代码到中文描述的映射表
 * wttr.in API返回的 weatherCode 是 WWO (World Weather Online) 代码
 */
const WEATHER_CODE_MAP: Record<string, string> = {
  '113': '晴',
  '116': '多云',
  '119': '多云',
  '122': '阴',
  '143': '雾',
  '149': '烟霾',
  '176': '小雨',
  '179': '小雪',
  '182': '雨夹雪',

  '185': '冻雨',
  '200': '雷',
  '227': '雪',
  '230': '大雪',
  '248': '雾',
  '260': '雾',
  '263': '小雨',
  '266': '小雨',
  '281': '冻雨',
  '284': '冻雨',
  '293': '小雨',
  '296': '小雨',
  '299': '中雨',
  '302': '中雨',
  '305': '大雨',
  '308': '暴雨',
  '311': '冻雨',
  '314': '冻雨',
  '317': '雨夹雪',
  '320': '雨夹雪',
  '323': '小雪',
  '326': '小雪',
  '329': '大雪',
  '332': '大雪',
  '335': '大雪',
  '338': '大雪',
  '350': '冰雹',
  '353': '小雨',
  '356': '中雨',
  '359': '暴雨',
  '362': '雨夹雪',
  '365': '雨夹雪',
  '368': '小雪',
  '371': '大雪',
  '374': '冰雹',
  '377': '冰雹',
  '386': '雷雨',
  '389': '雷雨',
  '392': '雷雪',
  '395': '大雪'
}

// ==================== 天气服务类 ====================

/**
 * 天气服务单例类
 * 负责通过 wttr.in API 获取全球城市天气数据
 */
export class WeatherService {
  /** 单例实例 */
  private static instance: WeatherService | null = null

  /** 天气数据缓存，key为城市名，value为{data, timestamp} */
  private weatherCache: Map<string, { data: WeatherData; timestamp: number }> = new Map()

  /** 天气缓存有效期（5分钟） */
  private readonly CACHE_TTL = 5 * 60 * 1000

  private constructor() {
    // 私有构造函数，单例模式
  }

  /**
   * 获取单例实例
   */
  static getInstance(): WeatherService {
    if (!WeatherService.instance) {
      WeatherService.instance = new WeatherService()
    }
    return WeatherService.instance
  }

  // ==================== 公开API ====================

  /**
   * 根据位置获取天气数据
   *
   * 直接通过 wttr.in API 查询天气，结果缓存5分钟减少API调用。
   * 支持中英文城市名、拼音以及直接经纬度路径（例如 /-78.46,106.79）。
   *
   * @param location - 城市名称或经纬度路径
   * @returns 包含天气数据或错误信息的Promise
   */
  async fetchWeatherByCity(location: string): Promise<WeatherFetchResult> {
    try {
      if (!location || !location.trim()) {
        return { success: false, error: '位置不能为空' }
      }

      const trimmedLocation = location.trim()
      const cacheKey = trimmedLocation.toLowerCase()

      // 检查缓存
      const cached = this.weatherCache.get(cacheKey)
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        log.debug(`[WeatherService] 使用缓存天气数据: ${trimmedLocation}`)
        return { success: true, data: cached.data }
      }

      // 调用 wttr.in API 获取天气
      const rawData = await this.fetchWttrData(trimmedLocation)
      const result = this.parseWttrResponse(rawData, trimmedLocation)

      // 更新缓存
      this.weatherCache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      })

      log.info(
        `[WeatherService] 成功获取天气: ${result.location} - ${result.condition} ${result.temperature}°C`
      )

      return { success: true, data: result }
    } catch (error) {
      const errorMsg = (error as Error).message || '未知错误'
      log.error(`[WeatherService] 获取天气失败:`, errorMsg)
      return { success: false, error: errorMsg }
    }
  }

  /**
   * 清除所有缓存
   */
  clearCache(): void {
    this.weatherCache.clear()
    log.debug('[WeatherService] 缓存已清除')
  }

  // ==================== 私有方法 ====================

  /**
   * 调用 wttr.in API 获取原始天气数据
   *
   * API格式: https://wttr.in/{city}?format=j1 或 https://wttr.in/{lat,lon}?format=j1
   * 返回JSON，包含 current_condition 和 weather 字段
   *
   * @param location - 城市名称或经纬度路径
   * @returns wttr.in 原始JSON响应
   */
  private async fetchWttrData(location: string): Promise<WttrResponse> {
    const url = location.startsWith('/')
      ? `${WTTR_BASE}${location}`
      : `${WTTR_BASE}/${encodeURIComponent(location)}`
    const response = await axios.get<WttrResponse>(url, {
      params: {
        format: 'j1',
        lang: 'zh-cn'
      },
      timeout: REQUEST_TIMEOUT,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json'
      }
    })

    return response.data
  }

  /**
   * 解析 wttr.in 响应，提取标准化天气数据
   *
   * wttr.in JSON结构 (lang=zh时，多语言字段数组为[英文/拼音, 中文]):
   * {
   *   current_condition: [{ temp_C, weatherCode, weatherDesc: [{value}, {value}], ... }],
   *   nearest_area: [{ areaName: [{value}, {value}], country: [{value}, {value}], ... }],
   *   weather: [...]
   * }
   *
   * @param data - wttr.in原始响应
   * @param fallbackCity - 查询的城市名（作为城市名回退）
   * @returns 标准化天气数据
   */
  private parseWttrResponse(data: WttrResponse, fallbackCity: string): WeatherData {
    if (!data || !data.current_condition || data.current_condition.length === 0) {
      throw new Error('wttr.in 返回数据为空')
    }

    const current = data.current_condition[0]
    const temperature = parseInt(current.temp_C, 10)

    if (isNaN(temperature)) {
      throw new Error('无法解析温度数据')
    }

    // 提取天气描述：优先取 weatherDesc 数组中最后一个元素（lang=zh 时为中文描述）
    let condition = '多云'
    if (current.weatherDesc && current.weatherDesc.length > 0) {
      const lastDesc = current.weatherDesc[current.weatherDesc.length - 1].value
      if (lastDesc && /[\u4e00-\u9fff]/.test(lastDesc)) {
        condition = lastDesc
      }
    }
    // 若 weatherDesc 未返回中文，回退到 weatherCode 映射
    if (condition === '多云' && current.weatherCode) {
      condition = WEATHER_CODE_MAP[current.weatherCode] || '多云'
    }

    // 提取城市名：优先取 areaName 数组中最后一个元素（lang=zh 时为中文名）
    let location = fallbackCity
    if (data.nearest_area && data.nearest_area.length > 0) {
      const area = data.nearest_area[0]
      if (area.areaName && area.areaName.length > 0) {
        const lastName = area.areaName[area.areaName.length - 1].value
        if (lastName && /[\u4e00-\u9fff]/.test(lastName)) {
          location = lastName
        } else {
          // 若最后一个不是中文（如纯拼音），取第一个
          location = area.areaName[0].value
        }
      }
    }

    return {
      location,
      condition,
      temperature
    }
  }
}

// ==================== wttr.in API 响应类型 ====================

/** wttr.in 多语言值 */
interface WttrLangValue {
  value: string
}

/** wttr.in 当前天气条件 */
interface WttrCurrentCondition {
  /** 观测时间 */
  observation_time: string
  /** 当前温度（摄氏度） */
  temp_C: string
  /** 体感温度（摄氏度） */
  FeelsLikeC: string
  /** 天气代码 */
  weatherCode: string
  /** 天气描述（多语言数组，lang=zh时为[英文, 中文]） */
  weatherDesc: WttrLangValue[]
  /** 风向 */
  winddir16Point: string
  /** 风速（公里/小时） */
  windspeedKmph: string
  /** 湿度 */
  humidity: string
  /** 能见度 */
  visibility: string
  /** 气压 */
  pressure: string
  /** 云量 */
  cloudcover: string
  /** 紫外线指数 */
  uvIndex: string
}

/** wttr.in 最近区域信息 */
interface WttrNearestArea {
  areaName: WttrLangValue[]
  country: WttrLangValue[]
  region: WttrLangValue[]
  latitude: string
  longitude: string
}

/** wttr.in format=j1 完整响应结构 */
interface WttrResponse {
  /** 当前天气状况 */
  current_condition: WttrCurrentCondition[]
  /** 最近区域信息 */
  nearest_area: WttrNearestArea[]
  /** 天气预报 */
  weather?: unknown[]
}
