export interface PythonTask {
  id: number
  name: string
  description: string
  scriptPath: string
  venvPython: string
  workDir: string
  autoStart: boolean
  // 任务优先级定义
  priority: TaskPriority
}

export interface PythonServiceStatus {
  running: boolean
  pid?: number
  memory?: number
  logs: string[]
}
