export interface PythonTask {
  id: number
  name: string
  scriptPath?: string
  enabled: boolean
  autoStart?: boolean
  args?: string[]
  description?: string
}

export interface PythonServiceStatus {
  id: number
  running: boolean
  pid?: number
  lastError?: string
  startedAt?: number
}
