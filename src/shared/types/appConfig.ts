/**
 * 助手渲染帧率档位。
 * 使用固定档位而非任意值：显示器刷新率是离散的（60/120/144Hz），
 * 中间值既不匹配任何刷新率也无可感知提升，固定档位语义清晰且便于后续扩展。
 */
export type RenderFps = 30 | 60 | 120

/** 可选的渲染帧率档位列表 */
export const RENDER_FPS_OPTIONS: readonly RenderFps[] = [30, 60, 120]

/**
 * 全局/系统级配置（app 分组）。
 * 面向系统行为与外观：服务连接、系统行为、主题外观。
 * 该分组的持久化职责归属应用本体，与具体某个助手无关。
 */
export interface AppSettings {
  // 基础Url配置
  baseUrl: string
  // 内核启动模式：'local' = 本地模式，'api' = API模式
  kernelMode: 'local' | 'api'
  // 是否开机自启
  autoStartOnBoot: boolean
  // 是否自动更新
  autoUpdate: boolean
  // 是否启用调试模式
  debugMode: boolean
  // 是否启用静默模式（开机静默启动，不弹出主窗口）
  silentMode: boolean
  // 主题色
  themeColor: string
}

/**
 * 助手相关配置（assistant 分组）。
 * 面向桌宠助手的交互行为、语音、窗口表现与渲染档位。
 * 未来若出现「每个助手独立配置」的需求，可将本分组从 AppConfig
 * 中拆出独立持久化，注册表结构保持不变，拆分成本极低。
 *
 * 命名与 assistantTypes.ts 中的 AssistantSettings（助手模型参数）
 * 区分开，二者概念不同：前者是应用级助手行为开关，后者是单个助手
 * 的 AI 记忆/上下文等模型参数。
 */
export interface AssistantConfigSettings {
  // 音量
  volume: number
  // 是否启用助手语音唤醒服务
  autoChat: boolean
  // 是否启用空闲事件
  idleEvent: boolean
  // 是否启用安静模式（助手静音/免打扰）
  quietMode: boolean
  // 是否启用桌面台词板
  desktopSpeechBoard: boolean
  // 是否启用应用内台词板
  appSpeechBoard: boolean
  // 桌宠模式是否开启
  assistantEnabled: boolean
  // 当前助手
  currentAssistant: string
  // 聊天快捷键
  chatShortcut: string
  // 是否处于睡眠模式
  sleepMode: boolean
  // 主动等级
  initiativeLevel: 'low' | 'medium' | 'high'
  // 助手渲染帧率档位
  renderFps: RenderFps
}

/**
 * 应用总配置：由各分组设置按命名空间展开组合而成。
 *
 * 存储保持扁平（electron-store 单一 JSON），分组仅是类型/代码层面的
 * 组织方式：好处是零迁移，通用配置 API（config.get/set）的类型安全不受影响。
 * 新增配置项只需按语义加入对应分组 interface，即可自动获得类型检查与
 * 持久化能力，无需再手工登记分类注册表。
 */
export interface AppConfig extends AppSettings, AssistantConfigSettings {}
