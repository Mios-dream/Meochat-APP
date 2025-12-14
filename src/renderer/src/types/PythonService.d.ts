export interface PythonTask {
  id: number
  name: string
  description: string
  scriptPath: string
  venvPython: string
  workDir: string
  autoStart: boolean
}

export interface PythonServiceStatus {
  running: boolean
  pid?: number
  memory?: number
  logs: string[]
}
