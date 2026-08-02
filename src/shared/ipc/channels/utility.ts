/**
 * 通用工具类 IPC 通道定义
 *
 * 包含：工具类、日志、应用更新、配置管理、新手引导、位置、天气、WebSocket
 */

export const utilityChannels = {
  /** 打开外部链接 */
  TOOL_OPEN_EXTERNAL: 'tool:open-external',
  /** 发送系统通知 */
  TOOL_NOTIFY: 'tool:notify',
  /** 选择文件 */
  TOOL_SELECT_FILE: 'tool:select-file',
  /** 选择文件夹 */
  TOOL_SELECT_FOLDER: 'tool:select-folder',
  /** 检查路径是否存在 */
  TOOL_PATH_EXISTS: 'tool:path-exists',
  /** 读取文件并返回 Base64 编码内容 */
  TOOL_READ_FILE_BASE64: 'tool:read-file-base64',

  /** 发送日志 */
  LOGGER_LOG: 'logger:log',
  /** 打开日志目录 */
  LOGGER_OPEN_LOG_DIR: 'logger:open-log-dir',

  /** 获取当前版本 */
  UPDATER_GET_CURRENT_VERSION: 'updater:get-current-version',
  /** 检查更新 */
  UPDATER_CHECK_FOR_UPDATE: 'updater:check-for-update',
  /** 确认更新 */
  UPDATER_CONFIRM_UPDATE: 'updater:confirm-update',
  /** 检查云端版本 */
  UPDATER_CHECK_CLOUD_VERSION: 'updater:check-cloud-version',
  /** 更新状态事件 */
  UPDATER_UPDATE_STATUS_EVENT: 'updater:update-status',
  /** 更新进度事件 */
  UPDATER_UPDATE_PROGRESS_EVENT: 'updater:update-progress',

  /** 获取配置 */
  CONFIG_GET: 'config:get',
  /** 设置配置 */
  CONFIG_SET: 'config:set',
  /** 配置变更事件 */
  CONFIG_CHANGED_EVENT: 'config:changed',
  /** 设置开机自启 */
  CONFIG_AUTO_START: 'config:auto-start',

  /** 获取引导状态 */
  ONBOARDING_GET_STATE: 'onboarding:get-state',
  /** 保存个人资料 */
  ONBOARDING_SAVE_PROFILE: 'onboarding:save-profile',
  /** 标记引导完成 */
  ONBOARDING_MARK_COMPLETED: 'onboarding:mark-completed',
  /** 重置引导 */
  ONBOARDING_RESET: 'onboarding:reset',

  /** 获取 IP 位置 */
  LOCATION_GET: 'location:get',

  /** 获取天气 */
  WEATHER_FETCH: 'weather:fetch',
  /** 清除天气缓存 */
  WEATHER_CLEAR_CACHE: 'weather:clear-cache',

  /** 发送 WS 消息 */
  WS_SEND: 'ws:send',
  /** 建立 WS 连接 */
  WS_CONNECT: 'ws:connect',
  /** 断开 WS 连接 */
  WS_DISCONNECT: 'ws:disconnect',
  /** 查询 WS 状态 */
  WS_STATUS: 'ws:status',
  /** WS 消息推送 */
  WS_MESSAGE_EVENT: 'ws:message',
  /** WS 状态变更 */
  WS_STATUS_CHANGE_EVENT: 'ws:status-change'
} as const
