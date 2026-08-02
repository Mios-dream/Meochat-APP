/**
 * 系统事件 + 窗口实例数据 IPC 通道定义
 *
 * 方向说明：均为 event（main send → renderer on），由主进程广播
 */

import { defineEvent } from './helpers'

export const eventChannels = {
  /** 接通电源事件 */
  ASSISTANT_EVENT_ON_AC: defineEvent('assistantEvent:on-ac'),
  /** 电池供电事件 */
  ASSISTANT_EVENT_ON_BATTERY: defineEvent('assistantEvent:on-battery'),
  /** 电池电量事件 */
  ASSISTANT_EVENT_BATTERY_LEVEL: defineEvent('assistantEvent:battery-level'),
  /** 鼠标活动事件 */
  ASSISTANT_EVENT_MOUSE_ACTIVITY: defineEvent('assistantEvent:mouse-activity'),
  /** 鼠标恢复事件 */
  ASSISTANT_EVENT_MOUSE_RESUMED: defineEvent('assistantEvent:mouse-resumed'),

  /** 取消消息推送 */
  CHATBOX_CANCEL_MESSAGE_EVENT: defineEvent('chat-box:cancel-message'),
  /** 唤醒词事件 */
  CHATBOX_WAKEWORD_DETECTED_EVENT: defineEvent('chat-box:wakeword-detected'),
  /** 聊天历史变更通知 */
  CHAT_HISTORY_CHANGED_EVENT: defineEvent('chat:history-changed'),
  /** 主进程转发聊天调用请求到助理窗口 */
  CHAT_INVOKE_REQUEST_EVENT: defineEvent('chat:invoke-request')
} as const
