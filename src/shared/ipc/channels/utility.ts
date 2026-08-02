/**
 * 通用工具类 IPC 通道定义
 *
 * 包含：工具类、日志、应用更新、配置管理、新手引导、位置、天气、WebSocket
 *
 * 方向说明：
 *   invoke — 工具/更新/配置/引导/天气等请求-响应
 *   send   — 日志上报等单向命令（renderer → main）
 *   event  — 主进程推送的更新状态 / 配置变更 / WS 消息
 */

import { defineInvoke, defineSend, defineEvent } from './helpers'

export const utilityChannels = {
  /** 打开外部链接 */
  TOOL_OPEN_EXTERNAL: defineSend('tool:open-external'),
  /** 发送系统通知 */
  TOOL_NOTIFY: defineSend('tool:notify'),
  /** 选择文件 */
  TOOL_SELECT_FILE: defineInvoke('tool:select-file'),
  /** 选择文件夹 */
  TOOL_SELECT_FOLDER: defineInvoke('tool:select-folder'),
  /** 检查路径是否存在 */
  TOOL_PATH_EXISTS: defineInvoke('tool:path-exists'),
  /** 读取文件并返回 Base64 编码内容 */
  TOOL_READ_FILE_BASE64: defineInvoke('tool:read-file-base64'),

  /** 发送日志 */
  LOGGER_LOG: defineSend('logger:log'),

  /** 获取当前版本 */
  UPDATER_GET_CURRENT_VERSION: defineInvoke('updater:get-current-version'),
  /** 检查更新 */
  UPDATER_CHECK_FOR_UPDATE: defineInvoke('updater:check-for-update'),
  /** 确认更新 */
  UPDATER_CONFIRM_UPDATE: defineInvoke('updater:confirm-update'),
  /** 检查云端版本 */
  UPDATER_CHECK_CLOUD_VERSION: defineInvoke('updater:check-cloud-version'),
  /** 更新状态事件 */
  UPDATER_UPDATE_STATUS_EVENT: defineEvent('updater:update-status'),
  /** 更新进度事件 */
  UPDATER_UPDATE_PROGRESS_EVENT: defineEvent('updater:update-progress'),

  /** 获取配置 */
  CONFIG_GET: defineInvoke('config:get'),
  /** 设置配置 */
  CONFIG_SET: defineInvoke('config:set'),
  /** 配置变更事件 */
  CONFIG_CHANGED_EVENT: defineEvent('config:changed'),
  /** 设置开机自启 */
  CONFIG_AUTO_START: defineInvoke('config:auto-start'),

  /** 获取引导状态 */
  ONBOARDING_GET_STATE: defineInvoke('onboarding:get-state'),
  /** 保存个人资料 */
  ONBOARDING_SAVE_PROFILE: defineInvoke('onboarding:save-profile'),
  /** 标记引导完成 */
  ONBOARDING_MARK_COMPLETED: defineInvoke('onboarding:mark-completed'),
  /** 重置引导 */
  ONBOARDING_RESET: defineInvoke('onboarding:reset'),

  /** 获取 IP 位置 */
  LOCATION_GET: defineInvoke('location:get'),

  /** 获取天气 */
  WEATHER_FETCH: defineInvoke('weather:fetch'),
  /** 清除天气缓存 */
  WEATHER_CLEAR_CACHE: defineInvoke('weather:clear-cache'),

  /** 发送 WS 消息 */
  WS_SEND: defineInvoke('ws:send'),
  /** 建立 WS 连接 */
  WS_CONNECT: defineInvoke('ws:connect'),
  /** 断开 WS 连接 */
  WS_DISCONNECT: defineInvoke('ws:disconnect'),
  /** 查询 WS 状态 */
  WS_STATUS: defineInvoke('ws:status'),
  /** WS 消息推送 */
  WS_MESSAGE_EVENT: defineEvent('ws:message'),
  /** WS 状态变更 */
  WS_STATUS_CHANGE_EVENT: defineEvent('ws:status-change')
} as const
