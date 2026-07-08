/**
 * 时钟小组件 · 声明式 LLM 工具清单
 *
 * ┌──────────────────────────────┬────────────────────────────┬──────────────────┐
 * │ 工具名称                     │ 描述                        │ 动作名            │
 * ├──────────────────────────────┼────────────────────────────┼──────────────────┤
 * │ set_clock_format             │ 切换12/24小时制显示         │ set_format       │
 * └──────────────────────────────┴────────────────────────────┴──────────────────┘
 */

import type { WidgetToolManifest } from './types'

/** 时钟小组件的完整工具清单。 */
export const clockToolManifest: WidgetToolManifest = {
  widget_type: 'clock',
  version: '1.0.0',
  tools: [
    {
      name: 'set_clock_format',
      description: '切换时钟的 12 小时制 / 24 小时制显示。true 为 24 小时制，false 为 12 小时制。',
      parameters: {
        type: 'object',
        properties: {
          is_24h: {
            type: 'boolean',
            description: '是否使用 24 小时制，true=24H，false=12H'
          }
        },
        required: ['is_24h']
      },
      action: 'set_format',
      mapParams: (args) => ({ is_24h: args.is_24h }),
      mapResult: (data) => ({
        is_24h: data.is_24h,
        current_format: data.is_24h ? '24小时制' : '12小时制'
      })
    }
  ]
}
