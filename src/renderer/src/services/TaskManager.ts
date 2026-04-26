import { ref, Ref, computed, ComputedRef, reactive } from 'vue'
import { PythonTask, PythonServiceStatus } from '../types/PythonService'

type StartupTaskPhase = 'idle' | 'starting' | 'syncing' | 'running' | 'failed'

interface LocalStartupResult {
  success: boolean
  error?: string
}

class TaskManager {
  private static instance: TaskManager
  private readonly taskLogCursor: Map<number, number> = new Map()
  private lastAppendedLogKey = ''

  // 响应式状态
  // 任务列表
  public readonly tasks: Ref<PythonTask[]> = ref([])
  // 任务状态列表
  public readonly tasksStatus = reactive(new Map<number, PythonServiceStatus>())
  // 选中的任务ID
  public readonly selectedTaskId: Ref<number | null> = ref(null)
  // 本地模式启动流程状态
  public readonly localStartupRunning: Ref<boolean> = ref(false)
  public readonly localStartupError: Ref<string> = ref('')
  public readonly localStartupLogs: Ref<string[]> = ref([])
  public readonly startupTaskPhase = reactive(new Map<number, StartupTaskPhase>())

  // 计算属性
  public readonly selectedTask: ComputedRef<PythonTask | null> = computed(() => {
    if (this.selectedTaskId.value === null) return null
    return this.tasks.value.find((task) => task.id === this.selectedTaskId.value) || null
  })
  // 选中任务的日志
  public readonly selectedTaskStatus: ComputedRef<PythonServiceStatus | null> = computed(() => {
    if (this.selectedTaskId.value === null) return null
    return this.tasksStatus.get(this.selectedTaskId.value) || null
  })

  constructor() {
    this.initService()
    this.initListeners()
  }

  /**
   * 获取所有任务
   */
  public async initService(): Promise<void> {
    this.tasks.value = await window.api.getAllPythonServices()
  }

  public static getInstance(): TaskManager {
    if (!TaskManager.instance) {
      TaskManager.instance = new TaskManager()
    }
    return TaskManager.instance
  }

  public initListeners(): void {
    window.api.ipcRenderer.on(
      'pythonService:TaskListUpdate',
      (_event, data: { tasks: PythonTask[] }) => {
        this.tasks.value = data.tasks
      }
    )

    window.api.ipcRenderer.on(
      'pythonService:StateUpdate',
      (_event, data: { id: number; status: PythonServiceStatus }) => {
        const { id, status } = data
        this.mergeTaskStatus(id, status)
      }
    )
  }

  private mergeTaskStatus(taskId: number, status: PythonServiceStatus): void {
    this.tasksStatus.set(taskId, status)
    this.consumeTaskLogs(taskId, status.logs || [])

    if (status.running && status.updatingDependencies) {
      this.startupTaskPhase.set(taskId, 'syncing')
      return
    }

    if (status.running) {
      this.startupTaskPhase.set(taskId, 'running')
      return
    }

    if (this.startupTaskPhase.get(taskId) !== 'failed') {
      this.startupTaskPhase.set(taskId, 'idle')
    }
  }

  private consumeTaskLogs(taskId: number, logs: string[]): void {
    let cursor = this.taskLogCursor.get(taskId) ?? 0
    if (logs.length < cursor) {
      cursor = 0
    }

    if (logs.length <= cursor) {
      this.taskLogCursor.set(taskId, logs.length)
      return
    }

    const newLogs = logs.slice(cursor)
    this.taskLogCursor.set(taskId, logs.length)

    newLogs.forEach((line) => {
      const text = String(line || '').trim()
      if (!text) {
        return
      }

      const logKey = `${taskId}:${text}`
      if (logKey === this.lastAppendedLogKey) {
        return
      }

      this.lastAppendedLogKey = logKey
      this.appendLocalLog(`[任务 ${taskId}] ${text}`)
    })
  }

  private appendLocalLog(line: string): void {
    this.localStartupLogs.value.push(line)
    if (this.localStartupLogs.value.length > 240) {
      this.localStartupLogs.value = this.localStartupLogs.value.slice(-240)
    }
  }

  public appendLocalSystemLog(message: string): void {
    if (!message) {
      return
    }
    this.appendLocalLog(`[系统] ${message}`)
  }

  public resetLocalStartupState(taskIds: number[] = []): void {
    this.localStartupError.value = ''
    this.localStartupLogs.value = []
    this.lastAppendedLogKey = ''
    this.taskLogCursor.clear()

    if (taskIds.length > 0) {
      taskIds.forEach((id) => {
        this.startupTaskPhase.set(id, 'idle')
      })
      return
    }

    this.startupTaskPhase.clear()
  }

  public getStartupTaskStateClass(taskId: number): string {
    const phase = this.startupTaskPhase.get(taskId)
    const status = this.tasksStatus.get(taskId)

    if (phase === 'failed') {
      return 'idle'
    }

    if (status?.running && status.updatingDependencies) {
      return 'warming'
    }

    if (phase === 'starting' || phase === 'syncing') {
      return 'warming'
    }

    if (status?.running || phase === 'running') {
      return 'running'
    }

    return 'idle'
  }

  public getStartupTaskStateText(taskId: number): string {
    const phase = this.startupTaskPhase.get(taskId)
    const status = this.tasksStatus.get(taskId)

    if (phase === 'failed') {
      return '启动失败'
    }

    if (status?.running && status.updatingDependencies) {
      return status.dependencyStatus || '同步依赖中'
    }

    if (phase === 'starting') {
      return '启动中'
    }

    if (phase === 'syncing') {
      return '同步依赖中'
    }

    if (status?.running || phase === 'running') {
      return '运行中'
    }

    return '未启动'
  }

  private isFatalLogLine(line: string): boolean {
    const normalized = line.toLowerCase()
    const fatalKeywords = [
      'traceback',
      'fatal',
      'exception',
      'module not found',
      'modulenotfounderror',
      'address already in use',
      'eaddrinuse',
      'permission denied',
      '启动服务失败',
      '强制终止进程失败'
    ]

    return fatalKeywords.some((keyword) => normalized.includes(keyword))
  }

  private hasFatalLog(logs: string[]): boolean {
    return logs.some((line) => this.isFatalLogLine(line))
  }

  private hasExitLog(logs: string[]): boolean {
    return logs.some((line) => line.includes('停止服务,退出码'))
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms)
    })
  }

  private async fetchTaskStatus(taskId: number): Promise<PythonServiceStatus | null> {
    try {
      const status = await window.api.getPythonServiceStatus(taskId)
      if (!status || typeof status !== 'object' || !('logs' in status)) {
        return null
      }

      this.mergeTaskStatus(taskId, status)
      return status
    } catch {
      return null
    }
  }

  private async waitTaskReady(task: PythonTask, timeoutMs = 90000): Promise<LocalStartupResult> {
    const startAt = Date.now()
    const deadline = startAt + timeoutMs
    const startupResult = await window.api.startPythonService(task.id)

    if (!startupResult.success) {
      this.startupTaskPhase.set(task.id, 'failed')
      return {
        success: false,
        error: `任务 ${task.name} 启动失败：${startupResult.error || '未知错误'}`
      }
    }

    this.startupTaskPhase.set(task.id, 'starting')

    while (Date.now() < deadline) {
      const status = await this.fetchTaskStatus(task.id)

      if (status) {
        if (status.running && status.updatingDependencies) {
          this.startupTaskPhase.set(task.id, 'syncing')
        }

        if (status.running && !status.updatingDependencies) {
          this.startupTaskPhase.set(task.id, 'running')
          return { success: true }
        }

        if (!status.running) {
          if (this.hasFatalLog(status.logs || []) || this.hasExitLog(status.logs || [])) {
            this.startupTaskPhase.set(task.id, 'failed')
            return {
              success: false,
              error: `任务 ${task.name} 启动失败：进程提前退出，请检查日志。`
            }
          }

          if (Date.now() - startAt > 12000 && !status.updatingDependencies) {
            this.startupTaskPhase.set(task.id, 'failed')
            return {
              success: false,
              error: `任务 ${task.name} 启动失败：进程未进入运行状态。`
            }
          }
        }
      }

      await this.wait(800)
    }

    this.startupTaskPhase.set(task.id, 'failed')
    return {
      success: false,
      error: `任务 ${task.name} 启动超时，请稍后重试。`
    }
  }

  public async startLocalTasks(tasks: PythonTask[]): Promise<LocalStartupResult> {
    this.localStartupRunning.value = true
    this.resetLocalStartupState(tasks.map((task) => task.id))
    this.appendLocalSystemLog('已进入本地任务连接流程')

    try {
      for (const task of tasks) {
        this.startupTaskPhase.set(task.id, 'starting')
        this.appendLocalSystemLog(`正在启动任务 ${task.name}`)

        const result = await this.waitTaskReady(task)
        if (!result.success) {
          this.localStartupError.value = result.error || '本地任务启动失败'
          this.appendLocalSystemLog(this.localStartupError.value)
          return { success: false, error: this.localStartupError.value }
        }

        this.appendLocalSystemLog(`任务 ${task.name} 已稳定运行`)
      }

      return { success: true }
    } finally {
      this.localStartupRunning.value = false
    }
  }

  public async areTasksRunning(taskIds: number[]): Promise<boolean> {
    for (const taskId of taskIds) {
      const status = await this.fetchTaskStatus(taskId)
      if (!status?.running) {
        return false
      }
    }

    return true
  }

  /**
   * 添加新任务
   * @param task 任务对象
   */
  public async addTask(task: Omit<PythonTask, 'id'>): Promise<void> {
    const result = await window.api.createPythonService(task)

    if (result.success) {
      console.info(task.name, 'Python服务创建成功')
    } else {
      console.error(`Python服务创建失败: ${result.error}`)
    }
  }

  /**
   * 删除任务
   * @param taskId 任务ID
   */
  public async removeTask(taskId: number): Promise<boolean> {
    const result = await window.api.removePythonService(taskId)
    if (result.success) {
      console.info(`任务ID ${taskId} 删除成功`)
      // 如果删除的是当前选中的任务，则清除选中状态
      if (this.selectedTaskId.value === taskId) {
        this.selectedTaskId.value = null
      }
      return true
    } else {
      console.error(`任务ID ${taskId} 删除失败: ${result.error}`)
      return false
    }
  }

  /**
   * 选择任务
   * @param taskId 任务ID
   */
  public selectTask(taskId: number): void {
    // 检查任务是否存在
    if (this.tasks.value.some((task) => task.id === taskId)) {
      this.selectedTaskId.value = taskId
    }
  }

  /**
   * 停止任务
   * @param taskId 任务ID
   */
  public async stopTask(taskId: number): Promise<void> {
    const result = await window.api.stopPythonService(taskId)
    if (result.success) {
      console.info(`任务ID ${taskId} 停止成功`)
    } else {
      console.error(`任务ID ${taskId} 停止失败: ${result.error}`)
    }
  }

  /**
   * 重启任务
   * @param taskId 任务ID
   */
  public async restartTask(taskId: number): Promise<void> {
    const result = await window.api.restartPythonService(taskId)
    if (result.success) {
      console.info(`任务ID ${taskId} 重启成功`)
    } else {
      console.error(`任务ID ${taskId} 重启失败: ${result.error}`)
    }
  }

  /**
   * 获取任务状态
   * @param taskId 任务ID
   * @returns 任务是否处于活跃状态
   */
  public async isTaskActive(taskId: number): Promise<boolean> {
    const result = await window.api.getPythonServiceStatus(taskId)
    if (result && result.running) {
      return true
    }
    return false
  }

  /**
   * 获取所有任务
   * @returns 任务列表
   */
  public getAllTasks(): PythonTask[] {
    return [...this.tasks.value]
  }

  // 更新 startTask 方法
  public async startTask(taskId: number): Promise<void> {
    const result = await window.api.startPythonService(taskId)
    if (result.success) {
      console.info(`任务ID ${taskId} 启动成功`)
    } else {
      console.error(`任务ID ${taskId} 启动失败: ${result.error}`)
    }
  }

  /**
   * 更新任务
   * @param taskId 任务ID
   * @param taskData 更新的任务数据
   */
  public async updateTask(
    taskId: number,
    taskData: Partial<Omit<PythonTask, 'id'>>
  ): Promise<boolean> {
    const result = await window.api.updatePythonService(taskId, taskData)
    if (result.success) {
      console.info(`任务ID ${taskId} 更新成功`)
      return true
    } else {
      console.error(`任务ID ${taskId} 更新失败: ${result.error}`)
      return false
    }
  }

  /**
   * 更新任务的开机启动设置
   * @param taskId 任务ID
   * @param autoStart 是否开机启动
   */
  public async updateAutoStart(taskId: number, autoStart: boolean): Promise<void> {
    const result = await window.api.updatePythonServiceAutoStart(taskId, autoStart)
    if (result.success) {
      console.info('任务开机启动设置更新成功，当前状态：', autoStart)
    } else {
      console.error(`任务开机启动设置更新失败: ${result.error}`)
    }
  }
}

export default TaskManager
