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
 */

import { BrowserWindow, ipcMain } from 'electron'
import { loadWindowContent, getPreloadPath, resolveWindowOpenUrl } from '../windows/urlResolver'
import { windowRegistry, widgetWindowConfig, widgetHostWindowConfig } from '../windows'
import { getConfig } from '../config/configManager'
import { boundsStore } from './boundsStore'
import { WidgetService } from './widgetService'
import { CHANNELS } from '@shared/ipc/channels'
import type { WidgetInstance, WidgetHostOpenResult } from '@shared/types/widget'
import log from '../utils/logger'

/** 创建子窗口的超时时间（ms），防止窗口异常导致 Promise 悬挂 */
const CREATE_TIMEOUT_MS = 15000

/** 请求序号：保证同实例并发创建时 requestId 不冲突 */
let PendingOpenSeq = 0

/** 待创建子窗口的回调条目 */
interface PendingOpen {
  /** 实例 ID，用于 did-create-window 匹配与并发去重 */
  instanceId: string
  resolve: (win: BrowserWindow) => void
  reject: (err: unknown) => void
  timer: NodeJS.Timeout
  /** 子窗口实例（did-create-window 时记录，用于超时清理） */
  win: BrowserWindow | null
  /** 本次创建的 Promise，供并发同实例请求复用同一结果 */
  promise: Promise<BrowserWindow>
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
  /** 待创建子窗口队列：requestId -> 回调，用于结果回传与 did-create-window 匹配 */
  private readonly pendingOpens = new Map<string, PendingOpen>()
  /** 宿主开窗结果监听是否已注册（ipcMain.on 全局唯一，防重复注册） */
  private openResultRegistered = false

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

    // 并发保护：await 期间可能已有同实例请求在途，复用其 Promise，
    // 避免重复 window.open 打开同名窗口导致 did-create-window 永不触发
    const inflight = this.findPendingByInstanceId(instance.id)
    if (inflight) {
      return inflight.entry.promise
    }

    const url = resolveWindowOpenUrl('widget.html', {
      widgetId: instance.widgetId,
      instanceId: instance.id
    })
    const frameName = `widget-${instance.id}`
    // 唯一请求标识：自增序号，确保并发请求 key 不冲突
    const requestId = `${instance.id}-${PendingOpenSeq++}`

    // 先构造 Promise，再将其引用存入待创建条目，
    // 便于并发同实例请求通过 findPendingByInstanceId 复用同一结果
    let resolveFn!: (win: BrowserWindow) => void
    let rejectFn!: (err: unknown) => void
    const promise = new Promise<BrowserWindow>((resolve, reject) => {
      resolveFn = resolve
      rejectFn = reject
    })

    const entry: PendingOpen = {
      instanceId: instance.id,
      resolve: resolveFn,
      reject: rejectFn,
      timer: undefined as unknown as NodeJS.Timeout,
      win: null,
      promise
    }
    entry.timer = setTimeout(() => {
      this.pendingOpens.delete(requestId)
      // 超时清理：若窗口已创建（did-create-window 已触发但未 resolve），销毁孤儿窗口
      if (entry.win && !entry.win.isDestroyed()) {
        log.warn(`小组件窗口创建超时，清理孤儿窗口: ${instance.widgetId}`)
        entry.win.destroy()
      }
      rejectFn(new Error(`小组件窗口创建超时: ${instance.widgetId}`))
    }, CREATE_TIMEOUT_MS)
    this.pendingOpens.set(requestId, entry)

    // 通过宿主 preload 桥接发起 window.open，替代 executeJavaScript 字符串注入
    // 注意：宿主可能在 ensureHost 返回后被销毁（如全部小组件关闭），需兜底快速失败
    try {
      if (!host.webContents.isDestroyed()) {
        host.webContents.send(CHANNELS.WIDGET_HOST_OPEN_REQUEST, {
          requestId,
          url,
          frameName
        })
      } else {
        throw new Error('宿主窗口已销毁')
      }
    } catch (err) {
      this.pendingOpens.delete(requestId)
      clearTimeout(entry.timer)
      rejectFn(err)
    }

    return promise
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
        // 宿主窗口与子窗口共用 widget 类型，暴露 widgetApi 及开窗桥接
        additionalArguments: ['--window-type=widget'],
        contextIsolation: true,
        sandbox: false,
        nodeIntegration: false,
        backgroundThrottling: true,
        // 全局禁用拼写检查
        spellcheck: false
      }
    })
    this.host = host

    // 注册到窗口注册表，便于统一生命周期管理与查询
    windowRegistry.register('widgetHost', host, { config: widgetHostWindowConfig })

    // 拦截宿主页面的所有 window.open：仅放行应用自身的小组件子窗口，其余一律拒绝
    // 注意：window.open 子窗口不会继承父窗口的 preload，必须在此显式指定，
    // 否则子窗口 window.api 未定义，小组件无法工作。
    host.webContents.setWindowOpenHandler(({ url }) => {
      return {
        action: 'allow',
        // 与宿主生命周期绑定：子窗口依赖宿主网关完成 IPC，
        // 宿主销毁时子窗口一并关闭，避免出现无法通信的孤儿窗口
        outlivesOpener: false,
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
            nodeIntegration: false,
            // 全局禁用拼写检查
            spellcheck: false
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

    // 注册宿主开窗结果监听（全局唯一，避免宿主重建时重复注册）
    this.registerOpenResultListener()

    // 加载内容（await loadURL/loadFile 等价于等待 did-finish-load）
    this.hostReady = loadWindowContent(host, widgetHostWindowConfig).then(() => {
      log.info('小组件宿主窗口已就绪')
    })
    await this.hostReady
    return host
  }

  /**
   * 注册宿主开窗结果监听。
   *
   * 宿主 preload 完成 window.open 后通过 WIDGET_HOST_OPEN_RESULT 回传布尔结果，
   * 主进程据此快速判定「被拒绝」（opened === false）场景并提前拒绝，
   * 避免悬挂到超时。
   */
  private registerOpenResultListener(): void {
    if (this.openResultRegistered) return
    this.openResultRegistered = true

    ipcMain.on(CHANNELS.WIDGET_HOST_OPEN_RESULT, (_event, result: WidgetHostOpenResult) => {
      const entry = this.pendingOpens.get(result.requestId)
      if (!entry) return

      // opened === false：window.open 被 setWindowOpenHandler 拒绝或打开失败，立即拒绝
      if (result.opened === false) {
        this.pendingOpens.delete(result.requestId)
        clearTimeout(entry.timer)
        entry.reject(new Error('window.open 被拒绝'))
      }
      // opened === true：窗口创建成功，等待 did-create-window 完成注册与定位
    })
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

    const entry = this.findPendingByInstanceId(instanceId)?.entry
    if (!entry) return
    // 记录已创建的窗口，供超时清理使用
    entry.win = win

    this.setupChildWindow(win, instanceId, entry)
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
   * 按实例 ID 查找在途的创建请求。
   *
   * @param instanceId 实例 ID
   * @returns 命中的待创建条目，不存在时返回 undefined
   */
  private findPendingByInstanceId(instanceId: string): { entry: PendingOpen } | undefined {
    for (const entry of this.pendingOpens.values()) {
      if (entry.instanceId === instanceId) {
        return { entry }
      }
    }
    return undefined
  }

  /**
   * 配置小组件子窗口：注册进窗口注册表、定位尺寸、显示与关闭回收。
   *
   * 创建 Promise 的完成时机与加载结果绑定：
   * - ready-to-show：页面渲染就绪，resolve(win)；
   * - did-fail-load：页面加载失败，销毁窗口并 reject；
   * - 超时（未走到上述任一分支）：由 createWidgetWindow 中的定时器兜底。
   *
   * @param win 子窗口
   * @param instanceId 实例 ID
   * @param entry 本次创建请求的待处理条目（resolve/reject/timer）
   */
  private setupChildWindow(win: BrowserWindow, instanceId: string, entry: PendingOpen): void {
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

    // 收敛工具：只允许 settle 一次，清除定时器并从队列移除
    let settled = false
    const settle = (action: () => void): void => {
      if (settled) return
      settled = true
      clearTimeout(entry.timer)
      for (const [key, e] of this.pendingOpens.entries()) {
        if (e === entry) {
          this.pendingOpens.delete(key)
          break
        }
      }
      action()
    }

    // 渲染就绪后再显示，避免透明窗口闪烁；同时完成 Promise
    win.once('ready-to-show', () => {
      if (win.isDestroyed()) return
      win.show()
      settle(() => entry.resolve(win))
    })

    // 加载失败兜底：销毁窗口并注销，避免「已注册但永不可见」的幽灵窗口
    // 注意：-3 为 ERR_ABORTED（导航被中断，如重定向/新导航替换），不属于真实失败，需忽略
    win.webContents.on(
      'did-fail-load',
      (_event, errorCode, errorDescription, _url, isMainFrame) => {
        if (!isMainFrame || errorCode === -3) return
        log.error(`小组件页面加载失败 (${errorCode}): ${errorDescription}`)
        settle(() => {
          if (!win.isDestroyed()) {
            win.destroy()
          }
          entry.reject(new Error(`小组件页面加载失败: ${errorDescription}`))
        })
      }
    )

    // debug 模式下自动打开子窗口开发者工具（与窗口工厂行为保持一致）
    if (getConfig('debugMode')) {
      win.webContents.openDevTools({ mode: 'detach' })
    }

    // 子窗口关闭：注销注册；若已无任何小组件窗口，则销毁宿主释放内存
    win.once('closed', () => {
      // 若尚未 settle（窗口在渲染就绪前被关闭），拒绝创建 Promise
      settle(() => {
        entry.reject(new Error('小组件窗口在渲染就绪前被关闭'))
      })
      // 无论是否已 settle，都要注销注册并尝试回收宿主
      windowRegistry.unregister(`widget:${instanceId}`)
      // 通知宿主网关清理该实例的子窗口引用，避免向已关闭窗口空投事件
      const host = this.host
      if (host && !host.isDestroyed()) {
        host.webContents.send(CHANNELS.WIDGET_HOST_CHILD_CLOSED, instanceId)
      }
      this.maybeDestroyHost()
    })
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
