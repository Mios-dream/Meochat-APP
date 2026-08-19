/**
 * 小组件注册表（内置小组件单一数据源）
 *
 * 背景：
 * 内置小组件清单原先在 WidgetView.vue（子窗口渲染解析）与 PluginManagerView.vue
 * （管理界面展示 / 实例创建）中各自硬编码一份，描述信息不一致、新增小组件需要改两处。
 *
 * 本模块收敛为单一数据源：
 * - 模块加载时一次性注册全部内置小组件清单（含组件引用）；
 * - 子窗口（WidgetView）按 widgetId 解析组件；
 * - 管理界面（PluginManagerView）读取全部清单用于展示与创建实例。
 *
 * 可拓展性：
 * 新增内置小组件只需向 BUILTIN_WIDGET_MANIFESTS 追加一条清单；
 * 第三方小组件（未来能力）可在此基础上通过 register() 动态追加，
 * 不破坏现有「widgetId → 组件」的解析链路。
 */

import { markRaw } from 'vue'
import type { WidgetManifest } from '@shared/types/widget'

// 内置小组件组件
import ClockWidget from '../components/widgets/builtin/ClockWidget.vue'
import DailyQuoteWidget from '../components/widgets/builtin/DailyQuoteWidget.vue'
import WeatherWidget from '../components/widgets/builtin/WeatherWidget.vue'
import TodoWidget from '../components/widgets/builtin/TodoWidget.vue'
import NoteWidget from '../components/widgets/builtin/NoteWidget.vue'

/**
 * 内置小组件清单（不可变，模块加载时注册）。
 * 描述信息与各组件默认尺寸以展示侧为准。
 */
const BUILTIN_WIDGET_MANIFESTS: WidgetManifest[] = [
  {
    id: 'clock',
    name: '时钟/日历',
    icon: 'fa-solid fa-clock',
    description: '显示当前时间和日期，支持12/24小时制切换',
    version: '1.0.0',
    component: markRaw(ClockWidget),
    defaultSize: { width: 300, height: 200 }
  },
  {
    id: 'daily-quote',
    name: '每日一句',
    icon: 'fa-solid fa-quote-left',
    description: '每日名言诗句，激励每一天',
    version: '1.0.0',
    component: markRaw(DailyQuoteWidget),
    defaultSize: { width: 300, height: 250 }
  },
  {
    id: 'weather',
    name: '天气',
    icon: 'fa-solid fa-cloud-sun',
    description: '显示当前天气和温度信息',
    version: '1.0.0',
    component: markRaw(WeatherWidget),
    defaultSize: { width: 300, height: 100 }
  },
  {
    id: 'todo',
    name: '澪的任务板',
    icon: 'fa-solid fa-list-check',
    description: '澪为你精心设计的任务清单',
    version: '1.0.0',
    component: markRaw(TodoWidget),
    defaultSize: { width: 300, height: 400 }
  },
  {
    id: 'note',
    name: '便签',
    icon: 'fa-solid fa-sticky-note',
    description: '快速记录文字便签',
    version: '1.0.0',
    component: markRaw(NoteWidget),
    defaultSize: { width: 300, height: 350 }
  }
]

/**
 * 小组件注册表单例。
 *
 * 内置清单在构造时一次性装载；外部（如第三方小组件加载器）可通过
 * register / unregister 动态增删，扩展点保持开放。
 */
class WidgetRegistry {
  private static instance: WidgetRegistry | null = null

  /** 已注册清单：widgetId → 清单 */
  private readonly manifests = new Map<string, WidgetManifest>()

  private constructor() {
    for (const manifest of BUILTIN_WIDGET_MANIFESTS) {
      this.manifests.set(manifest.id, manifest)
    }
  }

  /** 获取单例实例 */
  static getInstance(): WidgetRegistry {
    if (!WidgetRegistry.instance) {
      WidgetRegistry.instance = new WidgetRegistry()
    }
    return WidgetRegistry.instance
  }

  /**
   * 按小组件 ID 获取清单。
   *
   * @param widgetId 小组件类型 ID
   * @returns 清单，未注册时返回 undefined
   */
  get(widgetId: string): WidgetManifest | undefined {
    return this.manifests.get(widgetId)
  }

  /**
   * 获取全部已注册清单。
   *
   * @returns 清单数组
   */
  getAll(): WidgetManifest[] {
    return Array.from(this.manifests.values())
  }

  /**
   * 注册（或覆盖）一个小组件清单。
   *
   * @param manifest 小组件清单
   */
  register(manifest: WidgetManifest): void {
    this.manifests.set(manifest.id, manifest)
  }

  /**
   * 注销一个小组件清单。
   *
   * @param widgetId 小组件类型 ID
   * @returns 是否注销成功
   */
  unregister(widgetId: string): boolean {
    return this.manifests.delete(widgetId)
  }
}

/** 小组件注册表单例导出 */
export const widgetRegistry = WidgetRegistry.getInstance()
