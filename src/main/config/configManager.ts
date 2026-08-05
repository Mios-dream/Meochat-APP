import Store, { Schema } from 'electron-store'
import { BrowserWindow, app } from 'electron'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { CHANNELS } from '@shared/ipc/channels'
import { registerHandle } from '../utils/registerIpcHandler'

import { AppConfig, AppSettings, AssistantConfigSettings } from '@shared/types/appConfig'
import { resolveAppDataDir } from '../utils/pathResolve'
import { setBaseUrl } from '@shared/api/request'

// 配置项的默认值按命名空间分组定义，最后再合并为扁平 schema：
// 存储仍保持扁平单对象（electron-store 单一 JSON），分组仅是代码组织方式，
// 与 appConfig.ts 中 AppSettings / AssistantSettings 的分组一一对应。
const appSchema: Schema<AppSettings> = {
  baseUrl: { type: 'string', default: 'http://127.0.0.1:8001' },
  kernelMode: { type: 'string', default: 'local', enum: ['local', 'api'] },
  autoStartOnBoot: { type: 'boolean', default: false },
  autoUpdate: { type: 'boolean', default: true },
  debugMode: { type: 'boolean', default: false },
  silentMode: { type: 'boolean', default: false },
  themeColor: { type: 'string', default: '#fb7299' }
}

const assistantSchema: Schema<AssistantConfigSettings> = {
  volume: { type: 'number', default: 0.5 },
  autoChat: { type: 'boolean', default: false },
  idleEvent: { type: 'boolean', default: true },
  quietMode: { type: 'boolean', default: false },
  desktopSpeechBoard: { type: 'boolean', default: true },
  appSpeechBoard: { type: 'boolean', default: true },
  assistantEnabled: { type: 'boolean', default: false },
  currentAssistant: { type: 'string', default: '' },
  chatShortcut: { type: 'string', default: 'Alt+A' },
  sleepMode: { type: 'boolean', default: false },
  initiativeLevel: { type: 'string', default: 'low', enum: ['low', 'medium', 'high'] },
  renderFps: { type: 'number', default: 60, enum: [30, 60, 120] }
}

// 合并分组 schema 为完整配置 schema（键无重叠，分组边界由 AppConfig 扩展保证）
const schema: Schema<AppConfig> = {
  ...appSchema,
  ...assistantSchema
}

const appDataDir = resolveAppDataDir()

const store = new Store({
  schema,
  cwd: appDataDir
})

setBaseUrl(getConfig('baseUrl'))

function getConfig<K extends keyof AppConfig>(key: K): AppConfig[K] {
  return store.get(key) as AppConfig[K]
}

function setConfig<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
  store.set(key, value)
}

// ─── Linux 开机自启（XDG Autostart）─────────────────────────────────────────
//
// Electron 的 app.setLoginItemSettings 仅支持 Windows / macOS，
// Linux 需要遵循 XDG Desktop Entry 规范，在 ~/.config/autostart/ 写入 .desktop 文件。
// 与 Windows 行为对齐：启用时创建自启项（携带 --auto-start 参数），禁用时删除。

/** Linux XDG 自启目录（标准用户级 autostart 位置） */
const LINUX_AUTOSTART_DIR = path.join(os.homedir(), '.config', 'autostart')

/** Linux 自启 .desktop 文件名（与 appId/产品名对应，避免与其他应用冲突） */
const LINUX_AUTOSTART_FILENAME = 'moechat.desktop'

/**
 * 设置 Linux 开机自启
 * 通过写入/删除 ~/.config/autostart/moechat.desktop 实现：
 * - 启用：创建 .desktop 文件，Exec 指向当前可执行文件并追加 --auto-start 参数；
 * - 禁用：删除已存在的 .desktop 文件。
 */
function setLinuxAutoStart(enabled: boolean): void {
  try {
    const autostartFile = path.join(LINUX_AUTOSTART_DIR, LINUX_AUTOSTART_FILENAME)

    if (!enabled) {
      // 禁用自启：删除文件（不存在时静默忽略）
      if (fs.existsSync(autostartFile)) {
        fs.rmSync(autostartFile, { force: true })
      }
      return
    }

    // 确保自启目录存在
    fs.mkdirSync(LINUX_AUTOSTART_DIR, { recursive: true })

    // 可执行文件路径：AppImage 下 process.execPath 即 AppImage 本体
    const execPath = process.execPath
    const desktopEntry = [
      '[Desktop Entry]',
      'Type=Application',
      'Name=MoeChat',
      `Exec="${execPath}" --auto-start`,
      'X-GNOME-Autostart-enabled=true',
      'Comment=MoeChat desktop AI assistant',
      ''
    ].join('\n')

    fs.writeFileSync(autostartFile, desktopEntry, { encoding: 'utf8', mode: 0o644 })
  } catch (error) {
    // 自启设置失败不影响主流程，仅记录错误
    console.error('设置 Linux 开机自启失败:', error)
  }
}

function setupConfigIPC(): void {
  // 监听配置更新并广播给所有渲染进程
  store.onDidAnyChange(() => {
    setBaseUrl(getConfig('baseUrl'))
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send(CHANNELS.CONFIG_CHANGED_EVENT, store.store)
    })
  })
  // 提供 IPC 接口
  registerHandle(CHANNELS.CONFIG_GET, (_, key) => {
    return key ? store.get(key) : store.store
  })
  registerHandle(CHANNELS.CONFIG_SET, (_, key, value) => {
    store.set(key, value)
  })

  // 保留原有的开机启动逻辑
  registerHandle(CHANNELS.CONFIG_AUTO_START, (_, value) => {
    // Linux 使用 XDG autostart 方案；Windows/macOS 使用 Electron 原生接口
    if (process.platform === 'linux') {
      setLinuxAutoStart(Boolean(value))
      return
    }
    app.setLoginItemSettings({
      openAtLogin: value,
      openAsHidden: false,
      args: value ? ['--auto-start'] : []
    })
  })
}

export { setupConfigIPC, getConfig, setConfig }
