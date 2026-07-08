/**
 * 小组件工具注册模块 · 聚合入口
 *
 * 将所有小组件类型的声明式工具清单汇总为一个数组，
 * 通过 registerWidgetToolManifest() 统一注册到 ToolSystem。
 *
 * 新增小组件类型时只需三步：
 *   1. 新建 <WidgetName>Tools.ts，导出 manifest（遵循 WidgetToolManifest 类型）
 *   2. 在本文件 imports 中添加导入
 *   3. 在 MANIFESTS 数组中添加一项
 */

import type { ToolSystem } from '@renderer/composables/useToolSystem'
import { WidgetControlSystem } from '@renderer/composables/useWidgetControl'
import {
  registerWidgetToolManifest,
  manifestsToFunctionDefinitions,
  manifestsToComponentDefinitions
} from './register'
import type { WidgetToolManifest, WidgetToolDef } from './types'
import type { ComponentToolDefinition as SharedComponentToolDef } from '@shared/types/widget'

// ── 各小组件的声明式工具清单 ──

import { weatherToolManifest } from './weatherTools'
import { todoToolManifest } from './todoTools'
import { noteToolManifest } from './noteTools'
import { clockToolManifest } from './clockTools'
import { dailyQuoteToolManifest } from './dailyQuoteTools'

/** 所有已注册的小组件工具清单（数组）。 */
export const ALL_WIDGET_TOOL_MANIFESTS: WidgetToolManifest[] = [
  weatherToolManifest,
  todoToolManifest,
  noteToolManifest,
  clockToolManifest,
  dailyQuoteToolManifest
]

/** 所有工具定义（扁平化），用于序列化发送给后端。 */
export const ALL_WIDGET_TOOL_DEFS: Array<{
  name: string
  description: string
  parameters: WidgetToolDef['parameters']
}> = manifestsToFunctionDefinitions(ALL_WIDGET_TOOL_MANIFESTS)

/**
 * 所有组件工具定义（组件级），可直接用于 tool:definitions 消息上报给服务端。
 *
 * 每条包含 component / version / tools，由 manifestsToComponentDefinitions 生成。
 */
export const ALL_WIDGET_COMPONENT_DEFINITIONS: SharedComponentToolDef[] =
  manifestsToComponentDefinitions(ALL_WIDGET_TOOL_MANIFESTS)

/**
 * 注册所有小组件工具（声明式聚合入口）。
 *
 * 遍历 ALL_WIDGET_TOOL_MANIFESTS，将每个清单中的 tools
 * 自动注册到 ToolSystem，生成完整的处理函数。
 *
 * @param toolSystem - ToolSystem 实例（工具注册表）
 * @param control - WidgetControlSystem 实例（可选）
 */
export function registerAllWidgetTools(
  toolSystem: ToolSystem,
  control: WidgetControlSystem = WidgetControlSystem.getInstance()
): void {
  for (const manifest of ALL_WIDGET_TOOL_MANIFESTS) {
    registerWidgetToolManifest(manifest, toolSystem, control)
  }
}

export {
  registerWidgetToolManifest,
  manifestsToFunctionDefinitions,
  manifestsToComponentDefinitions
} from './register'
export type {
  WidgetToolManifest,
  WidgetToolDef,
  WidgetToolParamDef,
  WidgetToolParamsDef,
  ComponentToolDefinition
} from './types'
