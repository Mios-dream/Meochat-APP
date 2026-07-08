/**
 * 小组件工具清单 · 自动注册引擎
 *
 * 将声明式的 WidgetToolManifest 自动转换为 ToolSystem 注册项。
 *
 * 核心流程：
 *   WidgetToolManifest
 *     → 遍历 manifest.tools
 *       → 对每条 WidgetToolDef 生成一个 ToolHandler
 *         → 参数校验 → mapParams → control.execAction → mapResult → 返回给 LLM
 */

import type { ToolSystem } from '@renderer/composables/useToolSystem'
import { WidgetControlSystem } from '@renderer/composables/useWidgetControl'
import type { ComponentToolDefinition } from '@shared/types/widget'
import type { WidgetToolManifest, WidgetToolDef } from './types'

/**
 * 将声明式工具清单注册到 ToolSystem。
 *
 * 遍历 manifest.tools 中的每一条 WidgetToolDef，
 * 为每条生成一个完整参数校验 + 动作派发 + 结果转换的处理函数。
 *
 * @param manifest - 小组件工具清单（widget_type + tools[]）
 * @param toolSystem - ToolSystem 实例（工具注册表）
 * @param control - WidgetControlSystem 实例（可选，默认单例）
 */
export function registerWidgetToolManifest(
  manifest: WidgetToolManifest,
  toolSystem: ToolSystem,
  control: WidgetControlSystem = WidgetControlSystem.getInstance()
): void {
  for (const toolDef of manifest.tools) {
    const handler = createToolHandler(manifest.widget_type, toolDef, control)
    toolSystem.register(toolDef.name, handler)
  }
}

/**
 * 根据单条 WidgetToolDef 创建一个完整的 ToolHandler 闭包。
 *
 * 生成的 handler 包含：
 *   1. 必填参数校验（根据 parameters.required）
 *   2. 参数映射（mapParams）
 *   3. 小组件动作派发（WidgetControlSystem.execAction）
 *   4. 结果转换（mapResult，可选）
 *   5. 统一错误处理
 */
function createToolHandler(
  widgetType: string,
  toolDef: WidgetToolDef,
  control: WidgetControlSystem
) {
  const { name, description: _desc, parameters, action, mapParams, mapResult } = toolDef

  return async (args: Record<string, unknown>): Promise<Record<string, unknown>> => {
    // Step 1: 必填参数校验
    if (parameters.required) {
      for (const key of parameters.required) {
        const value = args[key]
        if (
          value === undefined ||
          value === null ||
          (typeof value === 'string' && value.trim() === '')
        ) {
          throw new Error(`工具 ${name} 缺少必填参数: ${key}。${_desc}`)
        }
      }
    }

    // Step 2: 参数映射
    const params = mapParams(args)

    // Step 3: 向小组件窗口派发动作
    const result = await control.execAction(widgetType, action, params)

    if (!result.success) {
      throw new Error(result.error ?? `小组件动作 ${action} 执行失败`)
    }

    // Step 4: 结果转换（如果提供了 mapResult）
    if (mapResult && result.data) {
      return mapResult(result.data)
    }

    return result.data ?? {}
  }
}

/**
 * 将 WidgetToolManifest 序列化为 OpenAI Function Calling 兼容的 JSON Schema 列表。
 *
 * 可用于发送给后端，让 LLM 了解客户端可用的所有工具。
 *
 * @param manifest - 小组件工具清单
 * @returns Function Calling 格式的工具定义数组
 */
export function manifestToFunctionDefinitions(
  manifest: WidgetToolManifest
): Array<{ name: string; description: string; parameters: WidgetToolDef['parameters'] }> {
  return manifest.tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters
  }))
}

/**
 * 将多个 WidgetToolManifest 合并序列化为 Function Calling 格式。
 *
 * 适用于一次性导出所有小组件的工具定义，发送给后端。
 *
 * @param manifests - 多个小组件工具清单
 * @returns Function Calling 格式的工具定义数组
 */
export function manifestsToFunctionDefinitions(
  manifests: WidgetToolManifest[]
): Array<{ name: string; description: string; parameters: WidgetToolDef['parameters'] }> {
  return manifests.flatMap((m) => manifestToFunctionDefinitions(m))
}

/**
 * 将 WidgetToolManifest 数组序列化为 tool:definitions 所需的 ComponentToolDefinition[]。
 *
 * 这是 WS 协商协议中客户端回复 tool:query 时使用的格式。
 * 每个 manifest → 一个 ComponentToolDefinition，包含组件名、版本、工具清单。
 *
 * @param manifests - 所有小组件工具清单
 * @returns 可序列化为 tool:definitions 消息的组件定义数组
 */
export function manifestsToComponentDefinitions(
  manifests: WidgetToolManifest[]
): ComponentToolDefinition[] {
  return manifests.map((manifest) => ({
    component: manifest.widget_type,
    version: manifest.version,
    tools: manifest.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }))
  }))
}
