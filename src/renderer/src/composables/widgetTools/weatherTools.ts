/**
 * 天气小组件 · 声明式 LLM 工具清单
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │ 工具名称                  │ 描述                 │ 动作名        │
 * ├─────────────────────────────────────────────────────────────┤
 * │ set_weather_location      │ 设置天气查询城市      │ set_location │
 * │ get_weather               │ 获取当前天气数据      │ get_weather  │
 * └─────────────────────────────────────────────────────────────┘
 */

import type { WidgetToolManifest } from './types'

/** 天气小组件的完整工具清单。 */
export const weatherToolManifest: WidgetToolManifest = {
  widget_type: 'weather',
  version: '1.0.0',
  tools: [
    {
      name: 'set_weather_location',
      description: '设置天气查询的目标城市，修改后小组件会自动刷新显示该城市的实时天气。',
      parameters: {
        type: 'object',
        properties: {
          city: {
            type: 'string',
            description: '中文城市名称，例如：重庆、北京、上海、东京'
          }
        },
        required: ['city']
      },
      action: 'set_location',
      mapParams: (args) => ({ city: args.city })
    },
    {
      name: 'get_weather',
      description: '获取小组件当前显示的天气数据，包括位置、天气状况和温度。',
      parameters: {
        type: 'object',
        properties: {}
      },
      action: 'get_weather',
      mapParams: () => ({})
    }
  ]
}
