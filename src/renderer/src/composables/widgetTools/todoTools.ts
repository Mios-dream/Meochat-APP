/**
 * 澪的任务板（待办事项）· 声明式 LLM 工具清单
 *
 * ┌──────────────────────────────┬────────────────────────────┬──────────────────┐
 * │ 工具名称                     │ 描述                        │ 动作名            │
 * ├──────────────────────────────┼────────────────────────────┼──────────────────┤
 * │ add_todo                     │ 添加一条新的待办事项         │ add_item         │
 * │ get_todos                    │ 获取所有待办事项列表         │ get_items        │
 * │ toggle_todo                  │ 切换某条待办的完成状态       │ toggle_item      │
 * │ delete_todo                  │ 删除指定ID的待办事项         │ delete_item      │
 * │ clear_completed_todos        │ 清除所有已完成的待办         │ clear_completed  │
 * └──────────────────────────────┴────────────────────────────┴──────────────────┘
 */

import type { WidgetToolManifest } from './types'

/** 待办事项小组件的完整工具清单。 */
export const todoToolManifest: WidgetToolManifest = {
  widget_type: 'todo',
  version: '1.0.0',
  tools: [
    {
      name: 'add_todo',
      description: '在澪的任务板中添加一条新的待办事项，例如"记得喝水"、"完成周报"。',
      parameters: {
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description: '待办事项的文本内容，简洁明了即可'
          }
        },
        required: ['text']
      },
      action: 'add_item',
      mapParams: (args) => ({ text: args.text })
    },
    {
      name: 'get_todos',
      description: '获取澪的任务板中所有待办事项列表，包含每条任务的ID、文本和完成状态。',
      parameters: {
        type: 'object',
        properties: {}
      },
      action: 'get_items',
      mapParams: () => ({})
    },
    {
      name: 'toggle_todo',
      description: '切换某条待办事项的完成状态（已完成 ↔ 未完成）。需要传入任务ID。',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: '待办事项的唯一标识ID，可通过 get_todos 获取'
          }
        },
        required: ['id']
      },
      action: 'toggle_item',
      mapParams: (args) => ({ id: args.id })
    },
    {
      name: 'delete_todo',
      description: '删除指定ID的待办事项。需要传入任务ID。',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: '待办事项的唯一标识ID，可通过 get_todos 获取'
          }
        },
        required: ['id']
      },
      action: 'delete_item',
      mapParams: (args) => ({ id: args.id })
    },
    {
      name: 'clear_completed_todos',
      description: '一键清除所有已完成的待办事项，清扫任务板。',
      parameters: {
        type: 'object',
        properties: {}
      },
      action: 'clear_completed',
      mapParams: () => ({})
    }
  ]
}
