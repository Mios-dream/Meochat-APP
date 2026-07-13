/**
 * 系统事件 + 窗口实例数据 IPC 通道定义
 */

export const eventChannels = {
  /** 接通电源事件 */
  ASSISTANT_EVENT_ON_AC: 'assistantEvent:on-ac',
  /** 电池供电事件 */
  ASSISTANT_EVENT_ON_BATTERY: 'assistantEvent:on-battery',
  /** 电池电量事件 */
  ASSISTANT_EVENT_BATTERY_LEVEL: 'assistantEvent:battery-level',
  /** 鼠标活动事件 */
  ASSISTANT_EVENT_MOUSE_ACTIVITY: 'assistantEvent:mouse-activity',
  /** 鼠标恢复事件 */
  ASSISTANT_EVENT_MOUSE_RESUMED: 'assistantEvent:mouse-resumed',

  /** 窗口实例数据 */
  WINDOW_INSTANCE_DATA_EVENT: 'window:instance-data',
  /** 聊天框状态更新 */
  CHATBOX_STATUS_UPDATED_EVENT: 'chat-box:status-updated',
  /** 工具状态更新 */
  CHATBOX_TOOL_STATUS_UPDATED_EVENT: 'chat-box:tool-status-updated',
  /** 消息推送 */
  CHATBOX_SEND_MESSAGE_EVENT: 'chat-box:send-message',
  /** 取消消息推送 */
  CHATBOX_CANCEL_MESSAGE_EVENT: 'chat-box:cancel-message',
  /** 唤醒词事件 */
  CHATBOX_WAKEWORD_DETECTED_EVENT: 'chat-box:wakeword-detected',
  /** 聊天历史变更通知 */
  CHATBOX_HISTORY_CHANGED_EVENT: 'chat-box:history-changed'
} as const
