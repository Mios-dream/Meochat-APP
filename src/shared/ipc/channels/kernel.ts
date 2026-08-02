/**
 * 内核管理 IPC 通道定义
 *
 * 方向说明：
 *   invoke — 内核/后端管理的请求-响应
 *   event  — 主进程推送的内核状态 / 服务状态 / 数据流事件
 */

import { defineInvoke, defineEvent } from './helpers'

export const kernelChannels = {
  /** 获取内核状态 */
  KERNEL_GET_STATE: defineInvoke('kernel:get-state'),
  /** 检查环境 */
  KERNEL_CHECK_ENVIRONMENT: defineInvoke('kernel:check-environment'),
  /** 自举初始化（装配内置资源 + uv sync） */
  KERNEL_BOOTSTRAP: defineInvoke('kernel:bootstrap'),
  /** 设置环境 */
  KERNEL_SETUP_ENVIRONMENT: defineInvoke('kernel:setup-environment'),
  /** 获取操作日志 */
  KERNEL_GET_OPERATION_LOGS: defineInvoke('kernel:get-operation-logs'),
  /** 启动后端 */
  KERNEL_START_BACKEND: defineInvoke('kernel:start-backend'),
  /** 停止后端 */
  KERNEL_STOP_BACKEND: defineInvoke('kernel:stop-backend'),
  /** 重启后端 */
  KERNEL_RESTART_BACKEND: defineInvoke('kernel:restart-backend'),
  /** 获取后端状态 */
  KERNEL_GET_BACKEND_STATUS: defineInvoke('kernel:get-backend-status'),
  /** 获取后端日志 */
  KERNEL_GET_BACKEND_LOGS: defineInvoke('kernel:get-backend-logs'),
  /** 检查后端健康 */
  KERNEL_CHECK_BACKEND_HEALTH: defineInvoke('kernel:check-backend-health'),
  /** 打开日志目录 */
  KERNEL_OPEN_LOG_DIR: defineInvoke('kernel:open-log-dir'),
  /** 检查 API 健康 */
  KERNEL_CHECK_API_HEALTH: defineInvoke('kernel:check-api-health'),
  /** 内核状态更新事件 */
  KERNEL_STATE_UPDATE_EVENT: defineEvent('kernel:state-update'),
  /** 服务状态事件 */
  KERNEL_SERVICE_STATE_EVENT: defineEvent('kernel:service-state'),
  /** 服务数据流事件 */
  KERNEL_SERVICE_STREAM_EVENT: defineEvent('kernel:service-stream')
} as const
