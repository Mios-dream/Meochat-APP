/**
 * 内核类型（共享）
 */
export type KernelStatus = 'installed' | 'downloading' | 'installing' | 'active' | 'error'

export interface KernelRemoteVersion {
  // 版本号
  version: string
  // 发布时间
  publishedAt: string
  // 更新日志
  releaseNotes: string
  // 下载地址
  downloadUrl: string
  // 文件大小（字节）
  size: number
}

export interface KernelUpdateState {
  // 内核版本
  currentVersion: string | null
  // 最新版本信息
  latestVersion: KernelRemoteVersion | null
  // 是否有可用更新
  updateAvailable: boolean
  // 内核状态
  operationStatus:
    | 'idle'
    | 'checking'
    | 'downloading'
    | 'installing'
    | 'settingUpEnv'
    | 'restarting'
    | 'done'
    | 'error'
  // 进度
  progress: number
  // 状态文本
  statusText: string
  // 错误信息
  error: string | null
}

export interface EnvironmentCheckItem {
  // 检查项名称
  name: string
  // 是否通过
  passed: boolean
  // 错误信息
  message: string
  key: 'uv' | 'venv' | 'disk' | 'kernel' | 'data'
}

export interface EnvironmentCheckResult {
  // 检查项列表
  items: EnvironmentCheckItem[]
  // 是否全部通过
  allPassed: boolean
  // 是否需要进行环境安装
  needsSetup: boolean
}

/** 数据资源包完整性检查结果 */
export interface DataResourceCheckResult {
  // 数据资源是否完整
  ready: boolean
  // 各检查项详情
  items: { name: string; key: string; exists: boolean }[]
}
