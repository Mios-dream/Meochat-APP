/**
 * 助手窗口控制 + 助手数据 + 助手设置窗口 IPC 通道定义
 *
 * 方向说明：
 *   invoke — 助手数据的请求-响应（load-data / get-all / switch 等）
 *   send   — 窗口控制命令（create / close / hide 等，renderer → main）
 *   event  — 主进程主动推送（switched / data-updated / 下载进度 / 鼠标位置等）
 */

import { defineInvoke, defineSend, defineEvent } from './helpers'

export const assistantChannels = {
  /** 打开助手窗口 */
  ASSISTANT_CREATE: defineSend('assistant:create'),
  /** 关闭助手窗口 */
  ASSISTANT_CLOSE: defineSend('assistant:close'),
  /** 隐藏助手窗口 */
  ASSISTANT_HIDE: defineSend('assistant:hide'),
  /** 显示助手窗口 */
  ASSISTANT_SHOW: defineSend('assistant:show'),
  /** 开始拖拽助手窗口 */
  ASSISTANT_START_DRAG: defineSend('assistant:start-drag'),
  /** 设置助手窗口穿透鼠标 */
  ASSISTANT_SET_IGNORE_MOUSE: defineSend('assistant:set-ignore-mouse'),
  /** 调整助手窗口尺寸 */
  ASSISTANT_RESIZE: defineSend('assistant:resize'),
  /** 获取屏幕尺寸 */
  ASSISTANT_GET_SCREEN_SIZE: defineInvoke('assistant:get-screen-size'),
  /** 获取助手开关状态 */
  ASSISTANT_GET_STATUS: defineInvoke('assistant:get-status'),
  /** 检查助手窗口可见性 */
  ASSISTANT_CHECK_VISIBLE: defineInvoke('assistant:check-visible'),
  /** 开始鼠标轨迹监控 */
  ASSISTANT_START_MOUSE_TRACKING: defineSend('assistant:start-mouse-tracking'),
  /** 停止鼠标轨迹监控 */
  ASSISTANT_STOP_MOUSE_TRACKING: defineSend('assistant:stop-mouse-tracking'),

  /** 加载助手数据 */
  ASSISTANT_LOAD_DATA: defineInvoke('assistant:load-data'),
  /** 获取所有助手列表 */
  ASSISTANT_GET_ALL: defineInvoke('assistant:get-all'),
  /** 获取当前助手 */
  ASSISTANT_GET_CURRENT: defineInvoke('assistant:get-current'),
  /** 切换当前助手 */
  ASSISTANT_SWITCH: defineInvoke('assistant:switch'),
  /** 添加助手 */
  ASSISTANT_ADD: defineInvoke('assistant:add-assistant'),
  /** 更新助手 */
  ASSISTANT_UPDATE: defineInvoke('assistant:update-assistant'),
  /** 删除助手 */
  ASSISTANT_DELETE: defineInvoke('assistant:delete-assistant'),
  /** 注册聊天框快捷键 */
  ASSISTANT_REGISTER_CHAT_SHORTCUT: defineInvoke('assistant:register-chat-shortcut'),
  /** 保存助手资源文件 */
  ASSISTANT_SAVE_RESOURCE_FILE: defineInvoke('assistant:save-resource-file'),
  /** 获取助手资产 */
  ASSISTANT_GET_ASSETS: defineInvoke('assistant:get-assets'),
  /** 保存助手资产配置 */
  ASSISTANT_SAVE_ASSETS: defineInvoke('assistant:save-assets'),
  /** 上传并解压 Live2D */
  ASSISTANT_SAVE_EXTRACT_LIVE2D: defineInvoke('assistant:save-extract-live2d'),
  /** 从角色卡导入 */
  ASSISTANT_IMPORT_FROM_CARD: defineInvoke('assistant:import-from-card'),
  /** 从 ZIP 导入 */
  ASSISTANT_IMPORT_FROM_ZIP: defineInvoke('assistant:import-from-zip'),
  /** 扫描 Live2D 表情 */
  ASSISTANT_SCAN_LIVE2D_EXPRESSIONS: defineInvoke('assistant:scan-live2d-expressions'),
  /** 获取前台应用 */
  ASSISTANT_GET_FOREGROUND_APP_USAGE: defineInvoke('assistant:get-foreground-app-usage'),
  /** 助手切换事件 */
  ASSISTANT_SWITCHED_EVENT: defineEvent('assistant:switched'),
  /** 助手列表数据更新事件 */
  ASSISTANT_DATA_UPDATED_EVENT: defineEvent('assistant:data-updated'),
  /** 下载进度事件 */
  ASSISTANT_DOWNLOAD_PROGRESS_EVENT: defineEvent('assistant:download-progress'),
  /** 上传进度事件 */
  ASSISTANT_UPLOAD_PROGRESS_EVENT: defineEvent('assistant:upload-progress'),
  /** 鼠标位置事件 */
  ASSISTANT_MOUSE_POSITION_EVENT: defineEvent('assistant:mouse-position'),

  /** 打开设置窗口 */
  ASSISTANT_SETTINGS_OPEN: defineSend('assistantSettings:open'),
  /** 关闭设置窗口 */
  ASSISTANT_SETTINGS_CLOSE: defineSend('assistantSettings:close')
} as const
