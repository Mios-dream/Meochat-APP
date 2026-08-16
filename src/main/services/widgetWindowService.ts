/**
 * 小组件窗口服务
 *
 * 方案：
 * 1. 懒创建一个「隐藏宿主窗口」（widget.html 宿主模式，永不上屏）；
 * 2. 小组件实例通过宿主页面 window.open 打开 → 同源子窗口与宿主共享同一渲染进程，
 *    多个小组件实例只需一份渲染进程内存；
 * 3. 主进程通过 setWindowOpenHandler / did-create-window 为子窗口注入
 *    透明、无边框、置顶等 BrowserWindow 选项，并将其注册进窗口注册表，
 *    保持与旧实现（new BrowserWindow）一致的 IPC 行为；
 * 4. 全部小组件关闭后销毁宿主，释放宿主渲染进程内存。
 *
 * 降级安全：
 * 即使极端场景下进程共享未生效（如跨源加载），子窗口仍是功能完整的独立窗口，
 * 行为与旧实现完全等价，仅内存收益下降，不会产生功能回归。
 *
 * 注意：
 * - 子窗口通过 outlivesOpener: true 与宿主解耦，宿主意外崩溃不会连带关闭小组件；
 * - window.open 要求页面已加载完成，createWidgetWindow 会先确保宿主就绪。
 */

import { BrowserWindow } from 'electron'
import { loadWindowContent, getPreloadPath, resolveWindowOpenUrl } from '../windows/urlResolver'
import { windowRegistry, widgetWindowConfig, widgetHostWindowConfig } from '../windows'
import { getConfig } from '../config/configManager'
import { boundsStore } from './boundsStore'
import { WidgetService } from './widgetService'
import type { WidgetInstance } from '@shared/types/widget'
import log from '../utils/logger'

/** 创建子窗口的超时时间（ms），防止 window.open 异常导致 Promise 悬挂 */
const CREATE_TIMEOUT_MS = 15000

/** 待创建子窗口的回调条目 */
interface PendingOpen {
  resolve: (win: BrowserWindow) => void
  reject: (err: unknown) => void
  timer: NodeJS.Timeout
}

/**
 * 小组件窗口服务单例。
 *
 * 统一管理宿主窗口生命周期与小组件子窗口的创建、注册、定位与回收。
 */
class WidgetWindowService {
  private static instance: WidgetWindowService | null = null

  /** 隐藏宿主窗口（null 表示尚未创建或已销毁） */
  private host: BrowserWindow | null = null
  /** 宿主页面加载完成 Promise（执行 window.open 前必须等待） */
  private hostReady: Promise<void> | null = null
  /** 待创建子窗口队列：instanceId -> 回调，用于 did-create-window 匹配 */
  private readonly pendingOpens = new Map<string, PendingOpen>()

  /** 获取单例实例。 */
  public static getInstance(): WidgetWindowService {
    if (!WidgetWindowService.instance) {
      WidgetWindowService.instance = new WidgetWindowService()
    }
    return WidgetWindowService.instance
  }

  /**
   * 创建（或复用）指定小组件实例的窗口。
   *
   * 若实例窗口已存在则直接显示并聚焦；否则通过宿主 window.open 打开，
   * 新窗口与宿主共享渲染进程，随后由主进程完成注册、定位与显示。
   *
   * @param instance 小组件实例（含 id / widgetId / position / size）
   * @returns 已创建的 BrowserWindow 实例
   */
  public async createWidgetWindow(instance: WidgetInstance): Promise<BrowserWindow> {
    // 幂等：窗口已存在时直接复用，避免同实例重复开窗
    const existing = windowRegistry.getWindow(`widget:${instance.id}`)
    if (existing) {
      existing.show()
      existing.focus()
      return existing
    }

    const host = await this.ensureHost()
    const url = resolveWindowOpenUrl('widget.html', {
      widgetId: instance.widgetId,
      instanceId: instance.id
    })
    const frameName = `widget-${instance.id}`

    return new Promise<BrowserWindow>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingOpens.delete(instance.id)
        reject(new Error(`小组件窗口创建超时: ${instance.widgetId}`))
      }, CREATE_TIMEOUT_MS)
      this.pendingOpens.set(instance.id, { resolve, reject, timer })

      // window.open 返回 Window | null，包装为布尔以规避 executeJavaScript 无法序列化 Window 的问题
      const script = `(window.open(${JSON.stringify(url)}, ${JSON.stringify(frameName)}) !== null)`
      host.webContents
        .executeJavaScript(script)
        .then((opened: unknown) => {
          if (opened === false) {
            this.pendingOpens.delete(instance.id)
            clearTimeout(timer)
            reject(new Error(`window.open 被拒绝: ${instance.widgetId}`))
          }
        })
        .catch((err) => {
          this.pendingOpens.delete(instance.id)
          clearTimeout(timer)
          reject(err)
        })
    })
  }

  /**
   * 确保隐藏宿主窗口存在且已加载完成。
   *
   * 宿主仅在首次需要创建小组件时懒创建，避免无小组件场景下的额外内存开销。
   *
   * @returns 就绪的宿主 BrowserWindow
   */
  private async ensureHost(): Promise<BrowserWindow> {
    if (this.host && !this.host.isDestroyed()) {
      await this.hostReady
      return this.host
    }

    const host = new BrowserWindow({
      show: false,
      transparent: true,
      frame: false,
      skipTaskbar: true,
      resizable: false,
      autoHideMenuBar: true,
      hasShadow: false,
      width: 300,
      height: 300,
      webPreferences: {
        preload: getPreloadPath('unifiedPreload'),
        // 子窗口继承宿主的 additionalArguments，固定为 widget 以暴露小组件 preload API
        additionalArguments: ['--window-type=widget'],
        contextIsolation: true,
        sandbox: false,
        nodeIntegration: false,
        backgroundThrottling: true
      }
    })
    this.host = host

    // 注册到窗口注册表，便于统一生命周期管理与查询
    windowRegistry.register('widgetHost', host, { config: widgetHostWindowConfig })

    // 拦截宿主页面的所有 window.open：仅放行小组件子窗口，其余一律拒绝
    // 注意：window.open 子窗口不会继承父窗口的 preload，必须在此显式指定，
    // 否则子窗口 window.api 未定义，小组件无法工作。
    host.webContents.setWindowOpenHandler(({ url }) => {
      if (!url.includes('/widget.html')) {
        return { action: 'deny' }
      }
      return {
        action: 'allow',
        // 与宿主解耦：宿主意外关闭/崩溃时小组件子窗口不被连带关闭
        outlivesOpener: true,
        overrideBrowserWindowOptions: {
          frame: false,
          transparent: true,
          alwaysOnTop: this.isPinnedInstance(url),
          resizable: false,
          skipTaskbar: true,
          autoHideMenuBar: true,
          hasShadow: false,
          show: false,
          webPreferences: {
            preload: getPreloadPath('unifiedPreload'),
            additionalArguments: ['--window-type=widget'],
            contextIsolation: true,
            sandbox: false,
            nodeIntegration: false
          }
        }
      }
    })

    // 子窗口创建回调：完成注册、定位，并在渲染就绪后显示
    host.webContents.on('did-create-window', (win, details) => {
      this.handleDidCreateWindow(win, details.frameName, details.url)
    })

    // 宿主销毁后清理引用，下次需要时重建
    host.on('closed', () => {
      windowRegistry.unregister('widgetHost')
      this.host = null
      this.hostReady = null
    })

    // 加载内容（await loadURL/loadFile 等价于等待 did-finish-load）
    this.hostReady = loadWindowContent(host, widgetHostWindowConfig).then(() => {
      log.info('小组件宿主窗口已就绪')
    })
    await this.hostReady
    return host
  }

  /**
   * 解析 window.open 子窗口的身份信息并匹配待创建队列，
   * 完成注册、定位、显示与生命周期回收。
   *
   * 优先使用 frameName（window.open 的第二个参数，可靠且唯一），
   * 解析失败时回退到 URL 查询参数。
   *
   * @param win 新创建的子窗口
   * @param frameName 窗口名（widget-<instanceId>）
   * @param rawUrl 子窗口 URL（含 widgetId / instanceId 查询参数）
   */
  private handleDidCreateWindow(win: BrowserWindow, frameName: string, rawUrl: string): void {
    const instanceId =
      this.parseInstanceIdFromFrameName(frameName) ?? this.parseInstanceIdFromUrl(rawUrl)
    if (!instanceId) {
      log.warn('小组件子窗口缺少 instanceId，忽略注册')
      return
    }

    const pending = this.pendingOpens.get(instanceId)
    if (!pending) {
      return
    }
    clearTimeout(pending.timer)
    this.pendingOpens.delete(instanceId)

    this.setupChildWindow(win, instanceId, pending.resolve)
  }

  /**
   * 从 frameName（widget-<instanceId>）解析实例 ID。
   *
   * @param frameName window.open 的窗口名
   * @returns 实例 ID，格式不匹配时返回 null
   */
  private parseInstanceIdFromFrameName(frameName: string): string | null {
    const prefix = 'widget-'
    return frameName.startsWith(prefix) ? frameName.slice(prefix.length) || null : null
  }

  /**
   * 从子窗口 URL 的查询参数解析实例 ID。
   *
   * @param rawUrl 子窗口 URL
   * @returns 实例 ID，解析失败时返回 null
   */
  private parseInstanceIdFromUrl(rawUrl: string): string | null {
    try {
      return new URL(rawUrl).searchParams.get('instanceId')
    } catch {
      return null
    }
  }

  /**
   * 配置小组件子窗口：注册进窗口注册表、定位尺寸、显示与关闭回收。
   *
   * @param win 子窗口
   * @param instanceId 实例 ID
   * @param resolve 创建完成回调
   */
  private setupChildWindow(
    win: BrowserWindow,
    instanceId: string,
    resolve: (win: BrowserWindow) => void
  ): void {
    const instance = WidgetService.getInstance().getInstance(instanceId)

    // 注册为 widget 类型（key = widget:<instanceId>），与旧实现及 IPC 定位逻辑保持一致
    windowRegistry.register('widget', win, {
      config: widgetWindowConfig,
      instanceId,
      query: { widgetId: instance?.widgetId, instanceId }
    })

    // 定位尺寸：优先 boundsStore 保存的位置，否则使用实例自身保存的位置
    const boundsKey = `widgetWindowBounds:${instanceId}`
    const saved = boundsStore.get(boundsKey)
    const position = saved ? { x: saved.x, y: saved.y } : instance?.position
    const size = instance?.size
    if (position && size) {
      win.setBounds({ x: position.x, y: position.y, width: size.width, height: size.height })
    } else if (size) {
      win.setSize(size.width, size.height)
    }

    // 渲染就绪后再显示，避免透明窗口闪烁
    win.once('ready-to-show', () => {
      win.show()
    })

    // debug 模式下自动打开子窗口开发者工具（与窗口工厂行为保持一致）
    if (getConfig('debugMode')) {
      win.webContents.openDevTools({ mode: 'detach' })
    }

    // 子窗口关闭：注销注册；若已无任何小组件窗口，则销毁宿主释放内存
    win.once('closed', () => {
      windowRegistry.unregister(`widget:${instanceId}`)
      this.maybeDestroyHost()
    })

    resolve(win)
  }

  /**
   * 判断 window.open 目标 URL 对应实例是否已置顶。
   *
   * 用于在子窗口创建时同步置顶状态，保证「固定」设置在应用重启后仍生效。
   *
   * @param rawUrl 子窗口 URL
   * @returns 实例已置顶时返回 true
   */
  private isPinnedInstance(rawUrl: string): boolean {
    try {
      const instanceId = new URL(rawUrl).searchParams.get('instanceId')
      if (!instanceId) return false
      return WidgetService.getInstance().getInstance(instanceId)?.pinned === true
    } catch {
      return false
    }
  }

  /**
   * 当所有小组件子窗口都已关闭时，销毁宿主窗口以释放渲染进程内存。
   *
   * 存在待创建子窗口或仍有活跃子窗口时不销毁。
   */
  private maybeDestroyHost(): void {
    if (this.pendingOpens.size > 0) {
      return
    }
    if (windowRegistry.getWindowsByType('widget').length > 0) {
      return
    }
    const host = this.host
    if (host && !host.isDestroyed()) {
      log.info('小组件已全部关闭，销毁宿主窗口释放内存')
      host.close()
    }
  }
}

export const widgetWindowService = WidgetWindowService.getInstance()
