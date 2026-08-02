/**
 * 内核类型（共享）
 */

export interface KernelUpdateState {
  // 内核版本
  currentVersion: string | null
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
  key: 'uv' | 'venv' | 'disk' | 'kernel'
}

export interface EnvironmentCheckResult {
  // 检查项列表
  items: EnvironmentCheckItem[]
  // 是否全部通过
  allPassed: boolean
  // 是否需要进行环境安装
  needsSetup: boolean
}
