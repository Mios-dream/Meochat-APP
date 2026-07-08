/**
 * 每日一句小组件 · 声明式 LLM 工具清单
 *
 * ┌──────────────────────────────┬────────────────────────────┬──────────────────┐
 * │ 工具名称                     │ 描述                        │ 动作名            │
 * ├──────────────────────────────┼────────────────────────────┼──────────────────┤
 * │ get_quote                    │ 获取当前显示的引言           │ get_current      │
 * │ refresh_quote                │ 刷新（随机换一条）引言       │ refresh          │
 * └──────────────────────────────┴────────────────────────────┴──────────────────┘
 */

import type { WidgetToolManifest } from './types'

/** 每日一句小组件的完整工具清单。 */
export const dailyQuoteToolManifest: WidgetToolManifest = {
  widget_type: 'daily-quote',
  version: '1.0.0',
  tools: [
    {
      name: 'get_quote',
      description: '获取每日一句小组件当前显示的经典名言或警句，包括文本、作者和出处。',
      parameters: {
        type: 'object',
        properties: {}
      },
      action: 'get_current',
      mapParams: () => ({})
    },
    {
      name: 'refresh_quote',
      description: '刷新每日一句，随机切换到另一条名言警句。',
      parameters: {
        type: 'object',
        properties: {}
      },
      action: 'refresh',
      mapParams: () => ({})
    }
  ]
}
