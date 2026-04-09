export type TaskPriority = 'critical' | 'high' | 'medium' | 'low'

export interface PythonTask {
  id: number
  name: string
  description: string
  scriptPath: string
  venvPython: string
  workDir: string
  autoStart: boolean
  // 启动前是否自动使用 uv 同步依赖
  autoSyncDependencies: boolean
  // 任务优先级定义
  priority: TaskPriority
}

export interface PythonServiceStatus {
  running: boolean
  // 是否处于依赖同步阶段
  updatingDependencies: boolean
  pid?: number
  memory?: number
  // 依赖同步阶段的状态文案
  dependencyStatus?: string
  logs: string[]
}
