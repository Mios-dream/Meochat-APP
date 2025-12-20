import { ref, Ref, computed, ComputedRef, reactive } from 'vue'
import { PythonTask, PythonServiceStatus } from '../types/PythonService'

class TaskManager {
  private static instance: TaskManager

  // 响应式状态
  // 任务列表
  public readonly tasks: Ref<PythonTask[]> = ref([])
  // 任务状态列表
  public readonly tasksStatus = reactive(new Map<number, PythonServiceStatus>())
  // 选中的任务ID
  public readonly selectedTaskId: Ref<number | null> = ref(null)

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
        this.tasksStatus.set(id, status)
      }
    )
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
