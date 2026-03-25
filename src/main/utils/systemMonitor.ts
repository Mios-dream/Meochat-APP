import { exec } from 'child_process'
import { promisify } from 'util'
import * as os from 'os'

const execAsync = promisify(exec)

class NvidiaSMI {
  /**
   * 查询NVIDIA GPU信息
   * @returns 包含GPU使用率、占用显存和总显存的对象
   */
  static async query(): Promise<{
    gpu: number
    vramUsedGB: number
    vramTotalGB: number
  }> {
    try {
      const { stdout } = await execAsync(
        `nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total --format=csv,noheader,nounits`
      )

      const [gpu, used, total] = stdout
        .trim()
        .split(',')
        .map((v) => Number(v.trim()))

      return {
        gpu,
        vramUsedGB: used / 1024,
        vramTotalGB: total / 1024
      }
    } catch {
      return {
        gpu: 0,
        vramUsedGB: 0,
        vramTotalGB: 0
      }
    }
  }
}

export interface SystemResources {
  // 内存使用率,单位%
  memoryUsage: number
  // 内存空闲量,单位gb
  memoryFreeGB: number
  // GPU使用率,单位%
  gpuUsage: number
  // GPU占用显存,单位gb
  gpuVramFreeGB: number
  // 是否正在运行游戏
  isGameRunning: boolean
}

export class SystemMonitor {
  private static instance: SystemMonitor

  public static getInstance(): SystemMonitor {
    if (!SystemMonitor.instance) {
      SystemMonitor.instance = new SystemMonitor()
    }
    return SystemMonitor.instance
  }

  /**
   * 获取内存使用率
   * @returns 包含内存使用率和空闲内存的对象
   */
  private async getMemoryUsage(): Promise<{
    memoryUsage: number
    memoryFreeGB: number
  }> {
    const totalMem = os.totalmem()
    const freeMem = os.freemem()
    const usedMem = totalMem - freeMem
    return {
      memoryUsage: Math.min(100, (usedMem / totalMem) * 100),
      memoryFreeGB: freeMem / 1024 ** 3
    }
  }

  /**
   * 获取GPU使用率 (Windows系统)
   * @returns 包含GPU使用率和空闲显存的对象
   */
  private async getGpuUsage(): Promise<{ gpuUsage: number; gpuVramFreeGB: number }> {
    try {
      const { gpu, vramUsedGB, vramTotalGB } = await NvidiaSMI.query()
      return {
        gpuUsage: gpu,
        gpuVramFreeGB: vramTotalGB - vramUsedGB
      }
    } catch (error) {
      console.error('获取GPU使用率失败:', error)
      return { gpuUsage: 0, gpuVramFreeGB: 0 }
    }
  }

  /**
   * 检测是否有游戏运行 (通过进程名检测)
   */
  private async checkGameRunning(): Promise<boolean> {
    try {
      if (process.platform === 'win32') {
        // 检测常见的游戏进程
        const gameProcesses = [
          'steam.exe',
          'game.exe',
          'launcher.exe',
          'battle.net.exe',
          'epicgameslauncher.exe',
          'origin.exe',
          'ubisoftconnect.exe',
          'valorant.exe',
          'league of legends.exe',
          'csgo.exe',
          'dota2.exe',
          'overwatch.exe',
          'minecraft.exe',
          'genshinimpact.exe',
          'honkai impact 3rd.exe'
        ]

        const { stdout } = await execAsync('tasklist /fo csv /nh')
        const processes = stdout.split('\n')

        for (const processLine of processes) {
          const match = processLine.match(/"([^"]+)"/)
          if (match) {
            const processName = match[1].toLowerCase()
            if (gameProcesses.some((game) => processName.includes(game))) {
              return true
            }
          }
        }
      }
      return false
    } catch (error) {
      console.error('检测游戏运行状态失败:', error)
      return false
    }
  }

  /**
   * 获取完整的系统资源状态
   * @returns 包含CPU、内存、GPU使用率和游戏运行状态的对象
   */
  public async getSystemResources(): Promise<SystemResources> {
    try {
      const [memoryUsage, gpuUsage, isGameRunning] = await Promise.all([
        this.getMemoryUsage(),
        this.getGpuUsage(),
        this.checkGameRunning()
      ])

      return {
        memoryUsage: Math.round(memoryUsage.memoryUsage * 10) / 10,
        memoryFreeGB: Math.round(memoryUsage.memoryFreeGB * 10) / 10,
        gpuUsage: Math.round(gpuUsage.gpuUsage * 10) / 10,
        gpuVramFreeGB: Math.round(gpuUsage.gpuVramFreeGB * 10) / 10,
        isGameRunning
      }
    } catch (error) {
      console.error('获取系统资源失败:', error)
      return {
        memoryUsage: 0,
        memoryFreeGB: 0,
        gpuUsage: 0,
        gpuVramFreeGB: 0,
        isGameRunning: false
      }
    }
  }
}
