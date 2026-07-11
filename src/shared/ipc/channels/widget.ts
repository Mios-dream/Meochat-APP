/**
 * 小组件 IPC 通道定义
 */

export const widgetChannels = {
  /** 获取所有小组件配置 */
  WIDGET_CONFIG_GET_ALL: 'widget:config:get-all',
  /** 保存小组件配置 */
  WIDGET_CONFIG_SAVE: 'widget:config:save',
  /** 添加实例 */
  WIDGET_INSTANCE_ADD: 'widget:instance:add',
  /** 更新实例 */
  WIDGET_INSTANCE_UPDATE: 'widget:instance:update',
  /** 删除实例 */
  WIDGET_INSTANCE_DELETE: 'widget:instance:delete',
  /** 获取实例 */
  WIDGET_INSTANCE_GET: 'widget:instance:get',
  /** 获取所有实例 */
  WIDGET_INSTANCE_GET_ALL: 'widget:instance:get-all',
  /** 获取当前实例数据 */
  WIDGET_INSTANCE_GET_CURRENT: 'widget:instance:get-current',
  /** 创建小组件窗口 */
  WIDGET_WINDOW_CREATE: 'widget:window:create',
  /** 关闭小组件窗口 */
  WIDGET_WINDOW_CLOSE: 'widget:window:close',
  /** 切换置顶 */
  WIDGET_WINDOW_TOGGLE_PIN: 'widget:window:toggle-pin',
  /** 发送数据到小组件 */
  WIDGET_DATA_SEND: 'widget:data:send',
  /** 广播数据 */
  WIDGET_DATA_BROADCAST: 'widget:data:broadcast',
  /** 更新全局设置 */
  WIDGET_SETTINGS_UPDATE: 'widget:settings:update',
  /** 获取全局设置 */
  WIDGET_SETTINGS_GET: 'widget:settings:get',
  /** 执行小组件动作 */
  WIDGET_ACTION_EXEC: 'widget:action:exec',
  /** 小组件动作指令 */
  WIDGET_ACTION_RECEIVED_EVENT: 'widget:action:received',
  /** 小组件动作结果回传 */
  WIDGET_ACTION_RESULT: 'widget:action:result',
  /** 小组件数据接收 */
  WIDGET_DATA_RECEIVED_EVENT: 'widget:data:received',
  /** 实例数据更新 */
  WIDGET_INSTANCE_DATA_EVENT: 'widget:instance:data',
  /** 配置变更 */
  WIDGET_CONFIG_CHANGED_EVENT: 'widget:config:changed'
} as const
