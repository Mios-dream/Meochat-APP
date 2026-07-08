/**
 * 小组件工具描述 · 声明式类型定义
 *
 * 每个小组件通过导出 WidgetToolManifest 来声明自己对外暴露的可调用工具。
 * 这些清单会被 registerWidgetToolManifest() 自动转换为 ToolSystem 注册项。
 *
 * 设计目标：
 *   1. 可读 —— 一眼就能看出该小组件支持哪些 LLM 工具调用
 *   2. 可序列化 —— 可直接转为 JSON Schema / OpenAI Function Calling 格式发送给 AI
 *   3. 可拓展 —— 新增工具只需在 manifest.tools 数组中加一项即可
 *   4. 类型安全 —— TypeScript 完整类型推导，避免参数名拼写错误
 *
 * 注：JSON Schema 层的类型（ToolParamSchema / ToolSchemaItem / ComponentToolDefinition）
 *     定义在 @shared/types/widget，供 ws 协议层和本模块共用。
 */

import type { ToolParamSchema, ToolSchemaItem, ComponentToolDefinition } from '@shared/types/widget'

/** 参数项定义。继承自 shared 层的 ToolParamSchema。 */
export type WidgetToolParamDef = ToolParamSchema

/** 参数列表的 JSON Schema 根对象（工具 defineParameters 使用的格式）。 */
export interface WidgetToolParamsDef {
  type: 'object'
  properties: Record<string, WidgetToolParamDef>
  required?: string[]
}

/**
 * 单个工具的完整描述。
 *
 * 定义了一个 LLM 可调用的工具：它的名称、参数约束、
 * 对应的小组件动作，以及参数映射 & 结果转换逻辑。
 */
export interface WidgetToolDef {
  /** 工具名称，也是 ToolSystem.registry 的 key。 */
  name: string
  /** 工具用途的中文描述，会出现在 AI prompt 中。 */
  description: string
  /** 参数 JSON Schema，描述该工具接受的参数和约束。 */
  parameters: WidgetToolParamsDef
  /**
   * 触发的小组件动作名。
   * 通过 WidgetControlSystem.execAction(widgetType, action, params) 发送。
   */
  action: string
  /**
   * 将 LLM 传入的工具参数映射为小组件动作参数。
   *
   * @example
   *   mapParams: (args) => ({ city: args.city })
   */
  mapParams: (args: Record<string, unknown>) => Record<string, unknown>
  /**
   * 可选：将小组件动作执行结果转换为给 LLM 的返回值。
   *
   * 默认行为（不提供时）直接透传 WidgetControlSystem 的 data 字段。
   */
  mapResult?: (data: Record<string, unknown>) => Record<string, unknown>
}

/**
 * 小组件工具清单 —— 一个小组件对外暴露的所有 LLM 可调用工具。
 *
 * 用法：
 *   ```ts
 *   export const weatherToolManifest: WidgetToolManifest = {
 *     widget_type: 'weather',
 *     version: '2.0.0',
 *     tools: [
 *       { name: 'set_weather_location', description: '...', ... },
 *     ]
 *   }
 *   ```
 */
export interface WidgetToolManifest {
  /** 目标小组件类型 ID。 */
  widget_type: string
  /** 语义化版本号，用于服务端协商校验。例如 "2.0.0"。 */
  version: string
  /** 该小组件暴露的所有工具清单。 */
  tools: WidgetToolDef[]
}

/** 将 WidgetToolManifest 序列化为可上报服务端的 ComponentToolDefinition。 */
export type { ToolParamSchema, ToolSchemaItem, ComponentToolDefinition }
