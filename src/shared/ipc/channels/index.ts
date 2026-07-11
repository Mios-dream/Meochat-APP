/**
 * IPC 通道名常量定义 — 入口
 *
 * 所有 IPC 通道名在此集中定义，消除主进程与渲染进程之间的字符串拼写差异。
 * 使用方式：
 *   import { CHANNELS } from '@shared/ipc/channels'
 *   ipcMain.handle(CHANNELS.KERNEL_GET_STATE, handler)
 *   ipcRenderer.invoke(CHANNELS.KERNEL_GET_STATE)
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

export const CHANNELS = {
  ...appChannels,
  ...assistantChannels,
  ...chatBoxChannels,
  ...kernelChannels,
  ...widgetChannels,
  ...utilityChannels,
  ...eventChannels,
  ...dispatchChannels,
  ...tipsChannels
} as const

/** 从 CHANNELS 提取通道名字符串联合类型 */
export type ChannelName = (typeof CHANNELS)[keyof typeof CHANNELS]
