import { SystemMonitor, SystemResources } from '../utils/systemMonitor'
import { PythonServiceManager, PythonTask } from './pythonService'
import log from '../utils/logger'
import { getConfig, setConfig } from '../config/configManager'

// 性能模式定义
export type PerformanceMode = 'high' | 'balanced' | 'low'

// 任务配置
export interface TaskConfig {
  id: number
  name: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  memoryThreshold: number // 启动所需最小空闲内存(GB)
  vramThreshold: number // 启动所需最小空闲显存(GB)
  cooldownTime: number // 冷却时间(ms)，避免频繁启停
  extraParams: Record<string, string> // 启动添加的额外参数
}

// 性能策略配置
interface PerformanceStrategy {
  // 资源阈值
  maxMemoryUsage: number // 最大内存使用率(%)
  maxGpuUsage: number // 最大GPU使用率(%)
  minMemoryFreeGB: number // 最小空闲内存(GB)
  minVramFreeGB: number // 最小空闲显存(GB)

  // 游戏检测
  pauseOnGame: boolean // 检测到游戏时是否暂停服务

  // 动态调整
  enableDynamicControl: boolean // 是否启用动态控制
  checkInterval: number // 检查间隔(ms)
}

// 预设策略
const PERFORMANCE_STRATEGIES: Record<PerformanceMode, PerformanceStrategy> = {
  high: {
    maxMemoryUsage: 95,
    maxGpuUsage: 95,
    minMemoryFreeGB: 0.5,
    minVramFreeGB: 0.5,
    pauseOnGame: false,
    enableDynamicControl: false,
    checkInterval: 10000
  },
  balanced: {
    maxMemoryUsage: 90,
    maxGpuUsage: 70,
    minMemoryFreeGB: 1,
    minVramFreeGB: 1,
    pauseOnGame: true,
    enableDynamicControl: true,
    checkInterval: 10000
  },
  low: {
    maxMemoryUsage: 50,
    maxGpuUsage: 50,
    minMemoryFreeGB: 6,
    minVramFreeGB: 4,
    pauseOnGame: true,
    enableDynamicControl: true,
    checkInterval: 10000
  }
}

// 任务状态跟踪
interface TaskState {
  id: number
  isRunning: boolean
  lastStartTime: number
  lastStopTime: number
  consecutiveFailures: number
}

// GPU使用率历史记录
interface GpuUsageHistory {
  timestamps: number[]
  usages: number[]
  maxHistorySize: number
}

export class PerformanceManager {
  private static instance: PerformanceManager
  private mode: PerformanceMode = 'balanced'
  private strategy: PerformanceStrategy
  private systemMonitor: SystemMonitor
  private serviceManager: PythonServiceManager
  private taskConfigs: Map<number, TaskConfig> = new Map()
  private taskStates: Map<number, TaskState> = new Map()
  private monitorInterval: NodeJS.Timeout | null = null
  private isMonitoring: boolean = false
  private gpuHistory: GpuUsageHistory = {
    timestamps: [],
    usages: [],
    maxHistorySize: 6 // 记录最近6次检查（均衡模式下30秒，低负载模式下18秒）
  }

  private constructor() {
    this.systemMonitor = SystemMonitor.getInstance()
    this.serviceManager = PythonServiceManager.getInstance()

    // 从配置加载性能模式
    this.mode = (getConfig('performanceMode') as PerformanceMode) || 'balanced'
    this.strategy = PERFORMANCE_STRATEGIES[this.mode]

    // 初始化任务配置
    this.initializeTaskConfigs()
    this.startMonitoring()
  }

  public static getInstance(): PerformanceManager {
    if (!PerformanceManager.instance) {
      PerformanceManager.instance = new PerformanceManager()
    }
    return PerformanceManager.instance
  }

  /**
   * 初始化任务配置
   */
  private initializeTaskConfigs(): void {
    // 从服务管理器获取所有服务
    const services = this.serviceManager.getAllServicesInfo()

    if (services.length === 0) {
      log.warn('当前没有任何服务，性能管理器将处于空闲状态')
      return
    }

    // 为每个服务创建配置
    services.forEach((service) => {
      // 根据服务名称或描述智能推断配置
      const config = this.createTaskConfigForService(service)
      this.taskConfigs.set(service.id, config)

      // 初始化任务状态
      this.taskStates.set(service.id, {
        id: service.id,
        isRunning: false,
        lastStartTime: 0,
        lastStopTime: 0,
        consecutiveFailures: 0
      })

      log.info(`初始化任务配置: ${service.name} (ID: ${service.id}, 优先级: ${config.priority})`)
    })
  }

  /**
   * 为服务创建任务配置
   * 根据服务名称和优先级智能推断资源需求
   */
  private createTaskConfigForService(service: PythonTask): TaskConfig {
    const name = service.name.toLowerCase()
    const description = (service.description || '').toLowerCase()

    // 优先使用服务自带的优先级，如果没有则智能推断
    let priority: TaskConfig['priority'] = service.priority || 'medium'
    let memoryThreshold = 2.5
    let vramThreshold = 2
    let cooldownTime = 20000

    // 根据服务名称和描述智能推断配置
    // 后端主程序判断
    if (
      name.includes('backend') ||
      name.includes('main') ||
      name.includes('server') ||
      name.includes('core') ||
      name.includes('moe') ||
      description.includes('主程序') ||
      description.includes('核心服务') ||
      description.includes('moe')
    ) {
      priority = 'critical'
      memoryThreshold = 1.5
      vramThreshold = 0.5
      cooldownTime = 30000
    }
    // GPT-SoVITS或其他AI服务判断
    else if (
      name.includes('gpt') ||
      name.includes('sovits') ||
      name.includes('voice') ||
      name.includes('tts') ||
      name.includes('speech') ||
      name.includes('audio') ||
      description.includes('语音') ||
      description.includes('合成')
    ) {
      priority = service.priority || 'high'
      memoryThreshold = 2
      vramThreshold = 2
      cooldownTime = 20000
    } else {
      priority = service.priority || 'high'
      memoryThreshold = 1
      vramThreshold = 1
      cooldownTime = 10000
    }

    return {
      id: service.id,
      name: service.name,
      priority,
      memoryThreshold,
      vramThreshold,
      cooldownTime,
      extraParams: {}
    }
  }

  /**
   * 刷新任务配置
   * 当服务列表发生变化时调用
   */
  public refreshTaskConfigs(): void {
    log.info('刷新任务配置列表')

    const services = this.serviceManager.getAllServicesInfo()
    const currentIds = new Set(services.map((s) => s.id))

    // 删除已不存在的服务配置
    const configIds = Array.from(this.taskConfigs.keys())
    configIds.forEach((id) => {
      if (!currentIds.has(id)) {
        log.info(`删除不存在的任务配置: ID ${id}`)
        this.taskConfigs.delete(id)
        this.taskStates.delete(id)
      }
    })

    // 添加或更新服务配置
    services.forEach((service) => {
      const existingConfig = this.taskConfigs.get(service.id)

      if (!existingConfig) {
        // 新服务，创建配置
        const config = this.createTaskConfigForService(service)
        this.taskConfigs.set(service.id, config)

        this.taskStates.set(service.id, {
          id: service.id,
          isRunning: false,
          lastStartTime: 0,
          lastStopTime: 0,
          consecutiveFailures: 0
        })

        log.info(`添加新任务配置: ${service.name} (ID: ${service.id})`)
      } else {
        // 已存在的服务，更新名称和优先级（如果服务配置有变化）
        if (existingConfig.name !== service.name) {
          existingConfig.name = service.name
        }
        if (service.priority && existingConfig.priority !== service.priority) {
          existingConfig.priority = service.priority
          log.info(`更新任务优先级: ${service.name} -> ${service.priority}`)
        }
      }
    })
  }

  /**
   * 设置性能模式
   */
  public setPerformanceMode(mode: PerformanceMode): void {
    if (this.mode === mode) return

    log.info(`切换性能模式: ${this.mode} -> ${mode}`)
    this.mode = mode
    this.strategy = PERFORMANCE_STRATEGIES[mode]

    // 保存配置
    setConfig('performanceMode', mode)

    // 刷新任务配置（可能有新服务添加）
    this.refreshTaskConfigs()

    // 根据新模式调整监控
    this.restartMonitoring()

    // 立即执行一次资源检查
    this.checkAndAdjustServices()
  }

  /**
   * 获取当前性能模式
   */
  public getPerformanceMode(): PerformanceMode {
    return this.mode
  }

  /**
   * 启动性能监控
   */
  public startMonitoring(): void {
    if (this.isMonitoring) return

    this.isMonitoring = true
    log.info(`启动性能监控，模式: ${this.mode}, 间隔: ${this.strategy.checkInterval}ms`)

    // 根据模式决定是否启用监控
    if (this.mode === 'high') {
      log.info('高性能模式，不进行动态调整')
      return
    }

    if (this.mode === 'low') {
      log.info('低负载模式，关闭所有服务')
      this.stopAllServices()
      return
    }

    // 立即执行一次检查
    this.checkAndAdjustServices()
    // 均衡模式：启动定时检查
    this.monitorInterval = setInterval(() => {
      this.checkAndAdjustServices()
    }, this.strategy.checkInterval)
  }

  /**
   * 停止性能监控
   */
  public stopMonitoring(): void {
    if (!this.isMonitoring) return

    this.isMonitoring = false

    if (this.monitorInterval) {
      clearInterval(this.monitorInterval)
      this.monitorInterval = null
    }

    log.info('停止性能监控')
  }

  /**
   * 重启监控
   */
  private restartMonitoring(): void {
    this.stopMonitoring()
    // 清空GPU历史记录，避免模式切换时的误判
    this.clearGpuHistory()
    this.startMonitoring()
  }

  /**
   * 检查并调整服务状态
   */
  private async checkAndAdjustServices(): Promise<void> {
    try {
      const resources = await this.systemMonitor.getSystemResources()

      // log.info(
      //   `系统资源: 内存=${resources.memoryUsage.toFixed(1)}%, ` +
      //     `空闲内存=${resources.memoryFreeGB.toFixed(1)}GB, ` +
      //     `GPU=${resources.gpuUsage.toFixed(1)}%, ` +
      //     `空闲显存=${resources.gpuVramFreeGB.toFixed(1)}GB, ` +
      //     `游戏运行=${resources.isGameRunning}`
      // )

      // 更新GPU使用率历史
      this.updateGpuHistory(resources.gpuUsage)

      // 如果检测到游戏且GPU使用率持续高于60%
      if (resources.isGameRunning && this.isGpuUsageSustainedHigh()) {
        log.info('检测到游戏运行且GPU使用率持续高于60%，暂停所有非关键服务')
        this.pauseNonCriticalServices()
        return
      }

      // 检查系统资源是否超限
      const isResourceCritical = this.isResourceCritical(resources)

      if (isResourceCritical) {
        log.warn('系统资源紧张，降低服务负载')
        await this.handleResourcePressure(resources)
      } else {
        // 资源充足，尝试启动优先级高的服务
        await this.tryStartServices(resources)
      }
    } catch (error) {
      log.error('检查系统资源失败:', error)
    }
  }

  /**
   * 更新GPU使用率历史记录
   */
  private updateGpuHistory(gpuUsage: number): void {
    const now = Date.now()

    this.gpuHistory.timestamps.push(now)
    this.gpuHistory.usages.push(gpuUsage)

    // 保持历史记录在限制范围内
    if (this.gpuHistory.timestamps.length > this.gpuHistory.maxHistorySize) {
      this.gpuHistory.timestamps.shift()
      this.gpuHistory.usages.shift()
    }
  }

  /**
   * 判断GPU使用率是否持续高于60%
   * 至少需要3次记录，且所有记录都高于60%
   */
  private isGpuUsageSustainedHigh(): boolean {
    const threshold = 70
    const minRecords = 3

    // 记录不足，不判定为持续高负载
    if (this.gpuHistory.usages.length < minRecords) {
      return false
    }

    // 检查最近的记录是否都高于阈值
    const recentUsages = this.gpuHistory.usages.slice(-minRecords)
    const allHighUsage = recentUsages.every((usage) => usage > threshold)

    if (allHighUsage) {
      const avgUsage = recentUsages.reduce((a, b) => a + b, 0) / recentUsages.length
      log.info(`GPU使用率持续高负载: 平均 ${avgUsage.toFixed(1)}% (最近${minRecords}次检查)`)
    }

    return allHighUsage
  }

  /**
   * 清空GPU历史记录
   */
  private clearGpuHistory(): void {
    this.gpuHistory.timestamps = []
    this.gpuHistory.usages = []
  }

  /**
   * 判断资源是否紧张
   */
  private isResourceCritical(resources: SystemResources): boolean {
    return (
      resources.memoryUsage > this.strategy.maxMemoryUsage ||
      resources.memoryFreeGB < this.strategy.minMemoryFreeGB ||
      resources.gpuUsage > this.strategy.maxGpuUsage ||
      resources.gpuVramFreeGB < this.strategy.minVramFreeGB
    )
  }

  /**
   * 处理资源压力
   */
  private async handleResourcePressure(resources: SystemResources): Promise<void> {
    // 获取所有运行中的服务，按优先级排序
    const runningServices = Array.from(this.taskConfigs.values())
      .filter((config) => {
        const service = this.serviceManager.getService(config.id)
        return service?.running
      })
      .sort((a, b) => this.comparePriority(a.priority, b.priority))

    // 从低优先级开始停止服务
    for (const config of runningServices) {
      // 关键服务不停止
      if (config.priority === 'critical') continue

      const needsStop = this.shouldStopService(config, resources)

      if (needsStop) {
        log.info(`资源不足，停止服务: ${config.name}`)
        await this.stopService(config.id)

        // 停止一个服务后重新评估
        const newResources = await this.systemMonitor.getSystemResources()
        if (!this.isResourceCritical(newResources)) {
          break
        }
      }
    }
  }

  /**
   * 判断是否应该停止服务
   */
  private shouldStopService(config: TaskConfig, resources: SystemResources): boolean {
    // 内存不足
    if (resources.memoryFreeGB < config.memoryThreshold) {
      return true
    }

    // 显存不足
    if (resources.gpuVramFreeGB < config.vramThreshold) {
      return true
    }

    // 整体资源使用过高
    if (
      resources.memoryUsage > this.strategy.maxMemoryUsage + 10 ||
      resources.gpuUsage > this.strategy.maxGpuUsage + 10
    ) {
      return config.priority !== 'critical'
    }

    return false
  }

  /**
   * 尝试启动服务
   */
  private async tryStartServices(resources: SystemResources): Promise<void> {
    // 刷新任务配置，确保是最新的服务列表
    this.refreshTaskConfigs()

    // 获取所有未运行的服务，按优先级排序
    const stoppedServices = Array.from(this.taskConfigs.values())
      .filter((config) => {
        const service = this.serviceManager.getService(config.id)
        return service && !service.running
      })
      .sort((a, b) => -this.comparePriority(a.priority, b.priority)) // 优先级高的在前

    for (const config of stoppedServices) {
      if (this.canStartService(config, resources)) {
        log.info(`资源充足，启动服务: ${config.name}`)
        await this.startService(config.id, config.extraParams)

        // 启动服务后等待一段时间让资源稳定
        await this.sleep(5000)

        // 重新获取资源状态
        resources = await this.systemMonitor.getSystemResources()
      }
    }
  }

  /**
   * 判断是否可以启动服务
   */
  private canStartService(config: TaskConfig, resources: SystemResources): boolean {
    const state = this.taskStates.get(config.id)
    if (!state) return false

    // 检查冷却时间
    const now = Date.now()
    if (now - state.lastStopTime < config.cooldownTime) {
      return false
    }

    // 检查连续失败次数
    if (state.consecutiveFailures > 3) {
      log.warn(`服务 ${config.name} 连续失败次数过多，暂不启动`)
      return false
    }

    // 检查资源是否充足（需要预留一定余量）
    const memoryMargin = 1.5 // 预留1.5倍资源
    const vramMargin = 1.3

    if (resources.memoryFreeGB < config.memoryThreshold * memoryMargin) {
      return false
    }

    if (resources.gpuVramFreeGB < config.vramThreshold * vramMargin) {
      return false
    }

    // 检查整体资源使用率
    if (
      resources.memoryUsage > this.strategy.maxMemoryUsage - 15 ||
      resources.gpuUsage > this.strategy.maxGpuUsage - 15
    ) {
      return false
    }

    return true
  }

  /**
   * 启动服务
   */
  private async startService(id: number, param?: Record<string, string>): Promise<void> {
    try {
      const state = this.taskStates.get(id)
      if (!state) return

      this.serviceManager.startService(id, param)

      state.isRunning = true
      state.lastStartTime = Date.now()
      state.consecutiveFailures = 0
    } catch (error) {
      log.error(`启动服务失败 (ID: ${id}):`, error)
      const state = this.taskStates.get(id)
      if (state) {
        state.consecutiveFailures++
      }
    }
  }

  /**
   * 停止服务
   */
  private async stopService(id: number): Promise<void> {
    try {
      const state = this.taskStates.get(id)
      if (!state) return

      this.serviceManager.stopService(id)

      state.isRunning = false
      state.lastStopTime = Date.now()
    } catch (error) {
      log.error(`停止服务失败 (ID: ${id}):`, error)
    }
  }

  /**
   * 暂停所有非关键服务
   */
  private pauseNonCriticalServices(): void {
    this.taskConfigs.forEach((config) => {
      if (config.priority !== 'critical') {
        const service = this.serviceManager.getService(config.id)
        if (service?.running) {
          log.info(`暂停非关键服务: ${config.name}`)
          this.stopService(config.id)
        }
      }
    })
  }

  /**
   * 停止所有服务
   */
  private stopAllServices(): void {
    this.taskConfigs.forEach((config) => {
      const service = this.serviceManager.getService(config.id)
      if (service?.running) {
        log.info(`停止服务: ${config.name}`)
        this.stopService(config.id)
      }
    })
  }

  /**
   * 比较优先级
   */
  private comparePriority(a: string, b: string): number {
    const priorityMap = { critical: 4, high: 3, medium: 2, low: 1 }
    return priorityMap[a] - priorityMap[b]
  }

  /**
   * 休眠函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * 获取性能统计
   */
  public async getPerformanceStats(): Promise<{
    mode: PerformanceMode
    resources: SystemResources
    services: {
      id: number
      name: string
      running: boolean
      priority: string
    }[]
    taskStates: TaskState[]
    taskConfigs: TaskConfig[]
    gpuHistory: {
      usages: number[]
      isSustainedHigh: boolean
    }
  }> {
    const resources = await this.systemMonitor.getSystemResources()
    const services = this.serviceManager.getAllServices()

    return {
      mode: this.mode,
      resources,
      services: services.map((s) => ({
        id: s.id,
        name: s.name,
        running: s.running,
        priority: s.priority
      })),
      taskStates: Array.from(this.taskStates.values()),
      taskConfigs: Array.from(this.taskConfigs.values()),
      gpuHistory: {
        usages: this.gpuHistory.usages,
        isSustainedHigh: this.isGpuUsageSustainedHigh()
      }
    }
  }

  /**
   * 手动更新任务配置
   */
  public updateTaskConfig(id: number, config: Partial<TaskConfig>): boolean {
    const existingConfig = this.taskConfigs.get(id)
    if (!existingConfig) {
      log.warn(`任务配置不存在: ID ${id}`)
      return false
    }

    Object.assign(existingConfig, config)
    log.info(`更新任务配置: ${existingConfig.name}`, config)
    return true
  }

  /**
   * 获取任务配置
   */
  public getTaskConfig(id: number): TaskConfig | undefined {
    return this.taskConfigs.get(id)
  }

  /**
   * 获取所有任务配置
   */
  public getAllTaskConfigs(): TaskConfig[] {
    return Array.from(this.taskConfigs.values())
  }

  /**
   * 重置任务失败计数
   */
  public resetTaskFailures(id: number): void {
    const state = this.taskStates.get(id)
    if (state) {
      state.consecutiveFailures = 0
      log.info(`重置任务 ${id} 失败计数`)
    }
  }

  /**
   * 销毁管理器
   */
  public destroy(): void {
    this.stopMonitoring()
  }
}
