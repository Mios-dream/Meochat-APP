/**
 * 窗口工厂
 * 提供统一的窗口创建接口，封装创建细节
 *
 * 核心职责：
 * 1. 根据配置创建窗口实例
 * 2. 自动注册到窗口注册表
 * 3. 统一处理 preload、webPreferences
 * 4. 绑定生命周期事件
 */

import { BrowserWindow, screen } from 'electron'
import type { Rectangle } from 'electron'
import type { WindowConfig, CreateWindowOptions, WindowEventCallbacks } from './types'
import { loadWindowContent, getPreloadPath } from './urlResolver'
import { windowRegistry } from './registry'
import { getConfig } from '../config/configManager'
import { boundsStore } from '../services/boundsStore'
import log from '../utils/logger'

/** 检查是否是开机自启 */
const isAutoStarted = process.argv.includes('--auto-start')

/**
 * 验证窗口位置是否在屏幕范围内
 * @param bounds 窗口边界
 * @returns 验证后的边界
 */
function validateBounds(bounds: Rectangle): Rectangle {
  const primaryDisplay = screen.getPrimaryDisplay()
  const displayBounds = primaryDisplay.bounds

  let { x, y } = bounds
  const { width, height } = bounds

  // 确保窗口在屏幕范围内
  if (x < displayBounds.x) x = displayBounds.x
  if (y < displayBounds.y) y = displayBounds.y
  if (x + width > displayBounds.x + displayBounds.width) {
    x = displayBounds.x + displayBounds.width - width
  }
  if (y + height > displayBounds.y + displayBounds.height) {
    y = displayBounds.y + displayBounds.height - height
  }

  return { x, y, width, height }
}

/**
 * 创建窗口实例
 *
 * @param config 窗口配置
 * @param options 创建选项
 * @param callbacks 事件回调
 * @returns BrowserWindow 实例
 */
export async function createWindow(
  config: WindowConfig,
  options: CreateWindowOptions = {},
  callbacks?: WindowEventCallbacks
): Promise<BrowserWindow> {
  const { instanceId, query, overrides, showImmediately = false } = options

  // 单例检查：如果窗口已存在且为单例模式，显示并聚焦返回
  if (config.singleton !== false && !instanceId) {
    const existingWindow = windowRegistry.getWindowByType(config.type)
    if (existingWindow && !existingWindow.isDestroyed()) {
      existingWindow.show()
      existingWindow.focus()
      return existingWindow
    }
  }

  // 恢复保存的窗口边界
  // 多实例窗口使用 boundsKey:instanceId 作为唯一键
  let windowBounds: Partial<Rectangle> | undefined
  const effectiveBoundsKey = config.boundsKey
    ? instanceId
      ? `${config.boundsKey}:${instanceId}`
      : config.boundsKey
    : undefined

  if (effectiveBoundsKey) {
    const savedBounds = boundsStore.get(effectiveBoundsKey)
    if (savedBounds) {
      windowBounds = validateBounds(savedBounds)
    }
  }

  // 合并窗口选项
  const windowOptions: Electron.BrowserWindowConstructorOptions = {
    ...config.options,
    ...windowBounds,
    ...overrides,
    show: false, // 默认不显示，等 dom-ready 后再显示
    webPreferences: {
      ...config.options.webPreferences,
      preload: getPreloadPath(config.preload),
      additionalArguments: [`--window-type=${config.type}`],
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false
    }
  }

  // 创建窗口
  const window = new BrowserWindow(windowOptions)

  // 注册到窗口注册表
  const key = windowRegistry.register(config.type, window, {
    config,
    instanceId,
    query,
    state: 'creating'
  })

  // 绑定生命周期事件
  bindWindowEvents(window, key, callbacks, effectiveBoundsKey)

  // 先注册 ready-to-show 事件，再加载内容（避免竞态条件）
  // 使用 ready-to-show 而非 dom-ready，确保首次绘制完成后才显示窗口，避免透明窗口闪烁黑边
  const domReadyPromise = new Promise<void>((resolve) => {
    window.once('ready-to-show', () => {
      windowRegistry.updateState(key, 'ready')
      log.info(`窗口就绪: ${key}`)

      // 主窗口显示逻辑：默认显示，除非静默模式+自动启动
      const shouldShow =
        showImmediately || (config.type === 'main' && !(getConfig('silentMode') && isAutoStarted))

      if (shouldShow) {
        window.show()
      }

      // debug模式下自动打开开发者工具
      if (getConfig('debugMode')) {
        window.webContents.openDevTools({ mode: 'detach' })
      }

      callbacks?.onReady?.(window)
      config.onCreated?.(window)
      resolve()
    })
  })

  // 加载内容
  windowRegistry.updateState(key, 'loading')
  log.info(`窗口加载中: ${key}`)

  try {
    await loadWindowContent(window, config, query)
    log.info(`窗口内容已加载: ${key}`)
  } catch (error) {
    log.error(`窗口加载失败: ${key}`, error)
    windowRegistry.unregister(key)
    throw error
  }

  // 等待 dom-ready 事件
  await domReadyPromise

  return window
}

/**
 * 绑定窗口生命周期事件
 */
function bindWindowEvents(
  window: BrowserWindow,
  key: string,
  callbacks?: WindowEventCallbacks,
  effectiveBoundsKey?: string
): void {
  // 窗口移动事件
  window.on('move', () => {
    const bounds = window.getBounds()
    windowRegistry.updateBounds(key, bounds)
    callbacks?.onMoved?.(bounds)

    // 持久化窗口位置
    if (effectiveBoundsKey) {
      boundsStore.set(effectiveBoundsKey, bounds)
    }
  })

  // 窗口大小改变事件
  window.on('resize', () => {
    const bounds = window.getBounds()
    windowRegistry.updateBounds(key, bounds)
    callbacks?.onResized?.(bounds)

    // 持久化窗口大小
    if (effectiveBoundsKey) {
      boundsStore.set(effectiveBoundsKey, bounds)
    }
  })

  // 窗口获得焦点
  window.on('focus', () => {
    callbacks?.onFocus?.(window)
  })

  // 窗口失去焦点
  window.on('blur', () => {
    callbacks?.onBlur?.(window)
  })

  // 窗口关闭事件
  window.on('close', () => {
    callbacks?.onClose?.(window)
  })

  // 窗口关闭后清理
  window.on('closed', () => {
    windowRegistry.updateState(key, 'destroyed')
    windowRegistry.unregister(key)
    callbacks?.onClosed?.(window)
    log.info(`窗口已销毁: ${key}`)
  })
}
