/**
 * 小组件 IPC 通道定义
 *
 * 方向说明：
 *   invoke — 小组件配置/实例/窗口管理请求-响应
 *   send   — 动作结果回传（renderer → main）
 *   event  — 主进程推送的数据 / 配置 / 动作指令
 */

import { defineInvoke, defineSend, defineEvent } from './helpers'

export const widgetChannels = {
  /** 获取所有小组件配置 */
  WIDGET_CONFIG_GET_ALL: defineInvoke('widget:config:get-all'),
  /** 保存小组件配置 */
  WIDGET_CONFIG_SAVE: defineInvoke('widget:config:save'),
  /** 添加实例 */
  WIDGET_INSTANCE_ADD: defineInvoke('widget:instance:add'),
  /** 更新实例 */
  WIDGET_INSTANCE_UPDATE: defineInvoke('widget:instance:update'),
  /** 删除实例 */
  WIDGET_INSTANCE_DELETE: defineInvoke('widget:instance:delete'),
  /** 获取当前实例数据 */
  WIDGET_INSTANCE_GET_CURRENT: defineInvoke('widget:instance:get-current'),
  /** 创建小组件窗口 */
  WIDGET_WINDOW_CREATE: defineInvoke('widget:window:create'),
  /** 关闭小组件窗口 */
  WIDGET_WINDOW_CLOSE: defineInvoke('widget:window:close'),
  /** 切换置顶 */
  WIDGET_WINDOW_TOGGLE_PIN: defineInvoke('widget:window:toggle-pin'),
  /** 发送数据到小组件 */
  WIDGET_DATA_SEND: defineInvoke('widget:data:send'),
  /** 广播数据 */
  WIDGET_DATA_BROADCAST: defineInvoke('widget:data:broadcast'),
  /** 更新全局设置 */
  WIDGET_SETTINGS_UPDATE: defineInvoke('widget:settings:update'),
  /** 执行小组件动作 */
  WIDGET_ACTION_EXEC: defineInvoke('widget:action:exec'),
  /** 小组件动作指令 */
  WIDGET_ACTION_RECEIVED_EVENT: defineEvent('widget:action:received'),
  /** 小组件动作结果回传 */
  WIDGET_ACTION_RESULT: defineSend('widget:action:result'),
  /** 小组件数据接收 */
  WIDGET_DATA_RECEIVED_EVENT: defineEvent('widget:data:received'),
  /** 实例数据更新 */
  WIDGET_INSTANCE_DATA_EVENT: defineEvent('widget:instance:data'),
  /** 配置变更 */
  WIDGET_CONFIG_CHANGED_EVENT: defineEvent('widget:config:changed'),

  /** 宿主开窗请求（main → 宿主 renderer，携带 url / frameName） */
  WIDGET_HOST_OPEN_REQUEST: defineEvent('widget:host:open-request'),
  /** 宿主开窗结果（宿主 renderer → main，回传 window.open 布尔结果） */
  WIDGET_HOST_OPEN_RESULT: defineSend('widget:host:open-result'),
  /** 子窗口关闭通知（main → 宿主 renderer，用于清理网关中的子窗口引用） */
  WIDGET_HOST_CHILD_CLOSED: defineEvent('widget:host:child-closed'),

  /** 开始拖拽小组件窗口（renderer → main，携带 instanceId；子窗口经宿主网关代发） */
  WIDGET_WINDOW_START_DRAG: defineSend('widget:window:start-drag'),
  /** 结束拖拽小组件窗口（renderer → main，Linux 手动拖拽时通知主进程停止轮询） */
  WIDGET_WINDOW_END_DRAG: defineSend('widget:window:end-drag')
} as const
