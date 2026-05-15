/**
 * 内核状态
 */
export type KernelStatus = 'installed' | 'downloading' | 'installing' | 'active' | 'error'

/**
 * 内核版本信息（来自远端）
 */
export interface KernelRemoteVersion {
  /** 版本号，如 "1.2.0" */
  version: string
  /** 发布日期 */
  publishedAt: string
  /** 更新日志 */
  releaseNotes: string
  /** 下载地址 */
  downloadUrl: string
  /** 文件大小 (bytes) */
  size: number
}

/**
 * 内核更新统一状态
 */
export interface KernelUpdateState {
  /** 当前激活的内核版本 */
  currentVersion: string | null
  /** 远端最新版本 */
  latestVersion: KernelRemoteVersion | null
  /** 是否有可用更新 */
  updateAvailable: boolean
  /** 当前操作状态 */
  operationStatus:
    | 'idle'
    | 'checking'
    | 'downloading'
    | 'installing'
    | 'settingUpEnv'
    | 'restarting'
    | 'done'
    | 'error'
  /** 下载/安装进度 0-100 */
  progress: number
  /** 状态描述文本 */
  statusText: string
  /** 错误信息 */
  error: string | null
}

/**
 * 单项环境检查结果
 */
export interface EnvironmentCheckItem {
  /** 检查项名称 */
  name: string
  /** 是否通过 */
  passed: boolean
  /** 描述信息 */
  message: string
  /** 检查项标识 */
  key: 'runtime' | 'uv' | 'venv' | 'disk' | 'kernel'
}

/**
 * 环境检查完整结果
 */
export interface EnvironmentCheckResult {
  /** 所有检查项 */
  items: EnvironmentCheckItem[]
  /** 是否全部通过 */
  allPassed: boolean
  /** 是否需要执行环境安装 */
  needsSetup: boolean
}

/**
 * 内核日志条目
 */
export interface KernelLogEntry {
  /** 时间戳 */
  time: string
  /** 日志级别 */
  level: 'info' | 'warn' | 'error' | 'success'
  /** 日志内容 */
  message: string
}
