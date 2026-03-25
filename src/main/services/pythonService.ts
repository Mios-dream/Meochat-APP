import { ChildProcessWithoutNullStreams, execSync, spawn } from 'child_process'
import { app, BrowserWindow } from 'electron'
import path from 'path'
import pidusage from 'pidusage'
import { PythonTask, PythonServiceStatus } from '../../renderer/src/types/PythonService'
import { getConfig, setConfig } from '../config/configManager'
import log from '../utils/logger'
import iconv from 'iconv-lite'

// 任务优先级定义
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low'

class PythonService {
  id: number
  name: string
  description: string
  scriptPath: string
  venvPython: string
  workDir: string
  child: ChildProcessWithoutNullStreams | null
  running: boolean
  autoStart: boolean // 是否开机启动
  priority: TaskPriority = 'medium' // 默认中等优先级
  logs: string[]
  private maxLogCount: number = 100 // 限制日志数量为100条
  private params: Record<string, string> = {}

  constructor(pythonTask: PythonTask) {
    this.id = pythonTask.id
    this.name = pythonTask.name
    this.description = pythonTask.description
    this.scriptPath = pythonTask.scriptPath
    this.venvPython = pythonTask.venvPython
    this.workDir = pythonTask.workDir
    this.autoStart = pythonTask.autoStart
    this.child = null
    this.running = false
    this.priority = pythonTask.priority
    this.logs = []
  }

  private decodeBuffer(buffer: Buffer): string {
    // Windows 平台尝试多种编码
    if (process.platform === 'win32') {
      // 首先尝试 UTF-8 解码
      const utf8Text = buffer.toString('utf8')
      // 检查是否有乱码字符（替换字符 U+FFFD）
      if (!utf8Text.includes('�')) {
        return utf8Text
      }

      // UTF-8 失败后尝试 GBK/CP936
      try {
        return iconv.decode(buffer, 'gbk')
      } catch {
        return buffer.toString('utf8') // 降级到 UTF-8
      }
    }

    return buffer.toString('utf8')
  }

  // 添加日志的私有方法，用于控制日志数量
  private addLog(message: string): void {
    this.logs.push(message)
    // 如果日志数量超过了限制，移除最旧的日志
    if (this.logs.length > this.maxLogCount) {
      this.logs.shift()
    }
    BrowserWindow.getAllWindows().forEach(async (win) => {
      win.webContents.send('pythonService:StateUpdate', {
        id: this.id,
        status: await this.getStatus()
      })
    })
  }

  // 添加设置最大日志数的方法
  setMaxLogCount(count: number): void {
    this.maxLogCount = count
    // 如果当前日志数量超过新的限制，截取最新的日志
    if (this.logs.length > this.maxLogCount) {
      this.logs = this.logs.slice(-this.maxLogCount)
    }
  }

  // 获取当前日志数量限制
  getMaxLogCount(): number {
    return this.maxLogCount
  }

  getLogs(): string[] {
    return this.logs
  }

  start(param?: Record<string, string>): void {
    if (this.running) return
    if (param) {
      this.params = param
    }
    const pythonPath = this.venvPython
    const script = path.resolve(this.workDir, this.scriptPath)

    log.info(`[${this.name}] 启动服务(${this.id}): ${pythonPath} ${script}`)

    this.running = true

    this.addLog(`[${this.name}] 服务启动中...`)

    try {
      this.child = spawn(pythonPath, ['-u', script], {
        cwd: this.workDir,
        stdio: 'pipe',
        shell: process.platform === 'win32', // Windows 需要 shell
        env: {
          PYTHONIOENCODING: 'utf-8',
          PYTHONLEGACYWINDOWSSTDIO: 'utf-8', // Python 3.6+
          PYTHONUTF8: '1', // 强制 Python 使用 UTF-8 模式 (Python 3.7+)
          ...this.params
        }
      })
    } catch (error) {
      this.running = false
      this.addLog(`[${this.name}] 启动服务失败: ${error}, 请检查配置是否正确`)
      return
    }

    this.child.stdout.on('data', (data) => {
      // this.addLog(data.toString().trim())
      this.addLog(this.decodeBuffer(data).trim())
    })

    this.child.stderr.on('data', (data) => {
      // this.addLog(data.toString().trim())
      this.addLog(this.decodeBuffer(data).trim())
    })

    this.child.on('error', (error) => {
      this.running = false
      this.child = null
      this.addLog(`[${this.name}] 启动服务失败: ${error}, 请检查配置是否正确`)
    })

    this.child.on('close', (code, signal) => {
      this.child = null
      this.running = false
      this.addLog(`[${this.name}] 停止服务,退出码: ${code}, 信号: ${signal}`)
    })
  }

  stop(): void {
    if (!this.running || !this.child) {
      this.addLog(`[${this.name}] 服务未运行,无需停止`)
      return
    }

    try {
      execSync(`taskkill /PID ${this.child.pid} /T /F`, { stdio: 'ignore' })
    } catch (error) {
      if (error instanceof Error && error.message.includes('No process found')) {
        this.child = null
        this.running = false
        this.addLog(`[${this.name}] 进程已不存在,无需强制终止`)
      } else {
        this.addLog(`[${this.name}] 强制终止进程失败,请手动终止进程`)
      }
    }
    // this.child.kill('SIGKILL')
  }

  restart(): void {
    this.stop()
    setTimeout(() => this.start(this.params), 1000)
  }

  // 添加获取服务状态的方法
  async getStatus(): Promise<PythonServiceStatus> {
    return {
      running: this.running,
      pid: this.child?.pid || -1,
      memory: (await this.getMemoryUsage()) || 0,
      logs: this.logs
    }
  }

  // 添加获取内存使用的方法
  async getMemoryUsage(): Promise<number> {
    if (!this.running || !this.child?.pid) return 0

    try {
      const stats = await pidusage(this.child.pid)
      return Math.round(stats.memory / 1024 / 1024) // 转换为 MB
    } catch (error) {
      log.error(`[${this.name}] 获取内存使用失败:`, error)
      return 0
    }
  }

  destroy(): void {
    this.stop()
    this.logs = []
  }
}

// Python服务管理器类
class PythonServiceManager {
  private static instance: PythonServiceManager
  private services: Map<number, PythonService> = new Map()

  private constructor() {
    // 从配置文件加载所有任务状态
    const pythonTasks = getConfig('pythonTasks') as PythonTask[]
    pythonTasks.forEach((pythonTask) => {
      const serviceId = this.createService(pythonTask)
      // 如果任务配置为开机启动，启动服务
      if (pythonTask.autoStart) {
        this.startService(serviceId)
      }
    })

    // 监听应用退出事件，自动销毁所有任务
    app.on('before-quit', () => {
      this.destroyAllServices()
    })
  }

  public static getInstance(): PythonServiceManager {
    if (!PythonServiceManager.instance) {
      PythonServiceManager.instance = new PythonServiceManager()
    }
    return PythonServiceManager.instance
  }

  // 新增：保存任务列表到配置文件
  private saveAndUpdateTasks(): void {
    BrowserWindow.getAllWindows().forEach((win) => {
      // 发送更新事件到渲染进程
      win.webContents.send('pythonService:TaskListUpdate', {
        tasks: this.getAllServices().map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          scriptPath: s.scriptPath,
          venvPython: s.venvPython,
          workDir: s.workDir,
          autoStart: s.autoStart,
          priority: s.priority
        }))
      })
    })
    const tasks = this.getAllServices().map((service) => ({
      id: service.id,
      name: service.name,
      description: service.description,
      scriptPath: service.scriptPath,
      venvPython: service.venvPython,
      workDir: service.workDir,
      autoStart: service.autoStart,
      priority: service.priority
    }))
    setConfig('pythonTasks', tasks)
  }

  updateService(id: number, serviceData: Partial<PythonTask>): boolean {
    const service = this.services.get(id)
    if (!service) return false
    Object.assign(service, serviceData)
    // 新增：保存任务列表
    this.saveAndUpdateTasks()
    return true
  }

  /**
   * 创建新的Python服务
   * @param pythonTask Python任务配置
   * @returns PythonService实例的ID
   */
  createService(pythonTask: Omit<PythonTask, 'id'>): number {
    // 检查是否已存在同名服务
    const newPythonTask = { ...pythonTask, id: this.services.size + 1 }

    const service = new PythonService(newPythonTask)
    this.services.set(newPythonTask.id, service)

    // 新增：保存任务列表
    this.saveAndUpdateTasks()

    return newPythonTask.id
  }

  /**
   * 获取指定名称的Python服务
   * @param name 服务名称
   * @returns PythonService实例或undefined
   */
  getService(id: number): PythonService | undefined {
    return this.services.get(id)
  }

  /**
   * 获取所有Python服务
   * @returns PythonService实例数组
   */
  getAllServices(): PythonService[] {
    return Array.from(this.services.values())
  }

  getAllServicesInfo(): PythonTask[] {
    return this.getAllServices().map((service) => ({
      id: service.id,
      name: service.name,
      description: service.description,
      scriptPath: service.scriptPath,
      venvPython: service.venvPython,
      workDir: service.workDir,
      autoStart: service.autoStart,
      priority: service.priority
    }))
  }

  /**
   * 删除指定的Python服务
   * @param id 服务ID
   * @returns 是否删除成功
   */
  removeService(id: number): boolean {
    const service = this.services.get(id)
    if (service) {
      service.destroy()
      const success = this.services.delete(id)
      // 新增：保存任务列表
      if (success) {
        this.saveAndUpdateTasks()
      }
      return success
    }
    return false
  }

  /**
   * 启动指定的Python服务
   * @param name 服务名称
   */
  startService(id: number, param?: Record<string, string>): void {
    const service = this.services.get(id)
    if (service) {
      service.start(param)
    } else {
      throw new Error(`服务 "${id}" 不存在`)
    }
  }

  /**
   * 停止指定的Python服务
   * @param name 服务名称
   */
  stopService(id: number): void {
    const service = this.services.get(id)
    if (service) {
      service.stop()
    } else {
      throw new Error(`服务 "${id}" 不存在`)
    }
  }

  /**
   * 重启指定的Python服务
   * @param name 服务名称
   */
  restartService(id: number): void {
    const service = this.services.get(id)
    if (service) {
      service.restart()
    } else {
      throw new Error(`服务 "${id}" 不存在`)
    }
  }

  /**
   * 停止所有Python服务
   */
  stopAllServices(): void {
    this.services.forEach((service) => {
      service.stop()
    })
  }

  /**
   * 启动所有Python服务
   */
  startAllServices(): void {
    this.services.forEach((service) => {
      service.start()
    })
  }

  /**
   * 销毁所有Python服务
   */
  destroyAllServices(): void {
    this.services.forEach((service) => {
      service.destroy()
    })
    this.services.clear()
  }

  /**
   * 获取服务状态
   * @param name 服务名称
   * @returns 服务状态
   */
  async getServiceStatus(id: number): Promise<PythonServiceStatus> {
    const service = this.services.get(id)
    if (service) {
      return await service.getStatus()
    } else {
      throw new Error(`服务 "${id}" 不存在`)
    }
  }

  /**
   * 获取服务数量
   */
  getServiceCount(): number {
    return this.services.size
  }

  // 新增：更新任务的开机启动设置
  updateAutoStart(id: number, autoStart: boolean): boolean {
    const service = this.services.get(id)
    if (service) {
      service.autoStart = autoStart
      // 保存任务列表
      this.saveAndUpdateTasks()
      return true
    }
    return false
  }
}

export default PythonService
export { PythonServiceManager, type PythonTask }
