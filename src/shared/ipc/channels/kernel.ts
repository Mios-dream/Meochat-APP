/**
 * 内核管理 IPC 通道定义
 */

export const kernelChannels = {
  /** 获取内核状态 */
  KERNEL_GET_STATE: 'kernel:get-state',
  /** 获取内核版本 */
  KERNEL_GET_CURRENT_VERSION: 'kernel:get-current-version',
  /** 获取内核路径 */
  KERNEL_GET_ACTIVE_PATH: 'kernel:get-active-path',
  /** 获取 Python 配置 */
  KERNEL_GET_PYTHON_CONFIG: 'kernel:get-python-config',
  /** 检查内核更新 */
  KERNEL_CHECK_UPDATE: 'kernel:check-update',
  /** 更新内核 */
  KERNEL_UPDATE_TO_LATEST: 'kernel:update-to-latest',
  /** 检查环境 */
  KERNEL_CHECK_ENVIRONMENT: 'kernel:check-environment',
  /** 设置环境 */
  KERNEL_SETUP_ENVIRONMENT: 'kernel:setup-environment',
  /** 下载模型 */
  KERNEL_DOWNLOAD_MODELS: 'kernel:download-models',
  /** 获取操作日志 */
  KERNEL_GET_OPERATION_LOGS: 'kernel:get-operation-logs',
  /** 注册状态监听 */
  KERNEL_LISTEN_STATE: 'kernel:listen-state',
  /** 注册日志监听 */
  KERNEL_LISTEN_LOGS: 'kernel:listen-logs',
  /** 启动后端 */
  KERNEL_START_BACKEND: 'kernel:start-backend',
  /** 停止后端 */
  KERNEL_STOP_BACKEND: 'kernel:stop-backend',
  /** 重启后端 */
  KERNEL_RESTART_BACKEND: 'kernel:restart-backend',
  /** 获取后端状态 */
  KERNEL_GET_BACKEND_STATUS: 'kernel:get-backend-status',
  /** 获取后端日志 */
  KERNEL_GET_BACKEND_LOGS: 'kernel:get-backend-logs',
  /** 重置内核状态 */
  KERNEL_RESET_STATE: 'kernel:reset-state',
  /** 检查后端健康 */
  KERNEL_CHECK_BACKEND_HEALTH: 'kernel:check-backend-health',
  /** 打开日志目录 */
  KERNEL_OPEN_LOG_DIR: 'kernel:open-log-dir',
  /** 检查 API 健康 */
  KERNEL_CHECK_API_HEALTH: 'kernel:check-api-health',
  /** 内核状态更新事件 */
  KERNEL_STATE_UPDATE_EVENT: 'kernel:state-update',
  /** 服务状态事件 */
  KERNEL_SERVICE_STATE_EVENT: 'kernel:service-state',
  /** 服务数据流事件 */
  KERNEL_SERVICE_STREAM_EVENT: 'kernel:service-stream'
} as const
