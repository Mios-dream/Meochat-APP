/**
 * IPC 通道名常量定义 — 入口
 *
 * 所有 IPC 通道名在此集中定义，消除主进程与渲染进程之间的字符串拼写差异。
 * 每个通道同时声明「方向」，作为 IPC 契约的一部分：
 *   invoke — renderer invoke → main handle（请求-响应）
 *   send   — renderer send  → main on（单向通知）
 *   event  — main send      → renderer on（事件推送）
 *
 * 使用方式：
 *   import { CHANNELS, type InvokeChannelName } from '@shared/ipc/channels'
 *   ipcMain.handle(CHANNELS.KERNEL_GET_STATE, handler)      // CHANNELS 是扁平字符串映射
 *   ipcRenderer.invoke(CHANNELS.KERNEL_GET_STATE)
 *
 * CHANNELS 保持「常量名 → 通道字符串」的扁平结构以兼容既有调用，
 * 方向信息通过 CHANNEL_DEFS 承载，并由 registerHandle / registerOn 在编译期约束。
 *
 * 按分类查看：
 *   app.ts         — 窗口控制
 *   assistant.ts   — 助手窗口控制 + 助手数据 + 助手设置窗口
 *   chatBox.ts     — 聊天框控制
 *   kernel.ts      — 内核管理
 *   widget.ts      — 小组件
 *   utility.ts     — 工具类 / 日志 / 应用更新 / 配置 / 新手引导 / 位置 / 天气 / WebSocket
 *   events.ts      — 系统事件 / 窗口实例数据
 *   dispatch.ts    — 统一调度中心
 *   tips.ts        — Tips 窗口
 */

import { appChannels } from './app'
import { assistantChannels } from './assistant'
import { chatBoxChannels } from './chatBox'
import { kernelChannels } from './kernel'
import { widgetChannels } from './widget'
import { utilityChannels } from './utility'
import { eventChannels } from './events'
import { dispatchChannels } from './dispatch'
import { tipsChannels } from './tips'
import { chatChannels } from './chat'

/** 完整通道定义（含方向元数据） */
export const CHANNEL_DEFS = {
  ...appChannels,
  ...assistantChannels,
  ...chatBoxChannels,
  ...kernelChannels,
  ...widgetChannels,
  ...utilityChannels,
  ...eventChannels,
  ...dispatchChannels,
  ...tipsChannels,
  ...chatChannels
} as const

/** 扁平化的「常量名 → 通道字符串」映射（与既有调用兼容） */
export const CHANNELS = Object.fromEntries(
  Object.entries(CHANNEL_DEFS).map(([key, def]) => [key, def.channel])
) as { [K in keyof typeof CHANNEL_DEFS]: (typeof CHANNEL_DEFS)[K]['channel'] }

/** 从 CHANNELS 提取通道名字符串联合类型 */
export type ChannelName = (typeof CHANNELS)[keyof typeof CHANNELS]

/** 请求-响应通道（renderer invoke → main handle）联合类型 */
export type InvokeChannelName = {
  [K in keyof typeof CHANNEL_DEFS]: (typeof CHANNEL_DEFS)[K] extends { direction: 'invoke' }
    ? (typeof CHANNEL_DEFS)[K]['channel']
    : never
}[keyof typeof CHANNEL_DEFS]

/** 单向通知通道（renderer send → main on）联合类型 */
export type SendChannelName = {
  [K in keyof typeof CHANNEL_DEFS]: (typeof CHANNEL_DEFS)[K] extends { direction: 'send' }
    ? (typeof CHANNEL_DEFS)[K]['channel']
    : never
}[keyof typeof CHANNEL_DEFS]

/** 事件推送通道（main send → renderer on）联合类型 */
export type EventChannelName = {
  [K in keyof typeof CHANNEL_DEFS]: (typeof CHANNEL_DEFS)[K] extends { direction: 'event' }
    ? (typeof CHANNEL_DEFS)[K]['channel']
    : never
}[keyof typeof CHANNEL_DEFS]
