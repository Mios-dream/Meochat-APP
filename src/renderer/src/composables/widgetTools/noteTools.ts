/**
 * 便签小组件 · 声明式 LLM 工具清单
 *
 * ┌──────────────────────────────┬────────────────────────────┬──────────────────┐
 * │ 工具名称                     │ 描述                        │ 动作名            │
 * ├──────────────────────────────┼────────────────────────────┼──────────────────┤
 * │ set_note                     │ 设置便签标题和内容          │ set_content      │
 * │ get_note                     │ 获取当前便签全部内容        │ get_content      │
 * │ clear_note                   │ 清空便签全部内容            │ clear            │
 * └──────────────────────────────┴────────────────────────────┴──────────────────┘
 */

import type { WidgetToolManifest } from './types'

/** 便签小组件的完整工具清单。 */
export const noteToolManifest: WidgetToolManifest = {
  widget_type: 'note',
  version: '1.0.0',
  tools: [
    {
      name: 'set_note',
      description: '设置便签的标题和/或正文内容。可以只更新标题、只更新内容，或两者都更新。',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: '便签标题（可选），不传则保持原标题不变'
          },
          content: {
            type: 'string',
            description: '便签正文内容，不传则保持原内容不变'
          }
        }
      },
      action: 'set_content',
      mapParams: (args) => ({ title: args.title ?? '', content: args.content ?? '' })
    },
    {
      name: 'get_note',
      description: '获取当前便签的完整内容，包括标题和正文。',
      parameters: {
        type: 'object',
        properties: {}
      },
      action: 'get_content',
      mapParams: () => ({})
    },
    {
      name: 'clear_note',
      description: '清空便签的所有内容（标题和正文）。',
      parameters: {
        type: 'object',
        properties: {}
      },
      action: 'clear',
      mapParams: () => ({})
    }
  ]
}
