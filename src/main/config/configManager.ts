import Store, { Schema } from 'electron-store'
import { BrowserWindow, app } from 'electron'
import { CHANNELS } from '@shared/ipc/channels'
import { registerHandle } from '../utils/registerIpcHandler'

import { AppConfig } from '@shared/types/appConfig'
import { resolveAppDataDir } from '../utils/pathResolve'
import { setBaseUrl } from '@shared/api/request'

// 配置项的默认值
const schema: Schema<AppConfig> = {
  // 基础配置
  baseUrl: { type: 'string', default: 'http://127.0.0.1:8001' },
  // 核心运行模式：'local' = 本地模式，'api' = API模式
  kernelMode: { type: 'string', default: 'local' },
  autoStartOnBoot: { type: 'boolean', default: false },
  autoUpdate: { type: 'boolean', default: true },
  debugMode: { type: 'boolean', default: false },
  silentMode: { type: 'boolean', default: false },
  // 助手配置
  volume: { type: 'number', default: 0.5 },
  // 是否启用动作生成
  generateMotion: { type: 'boolean', default: false },
  // 是否启用助手语音唤醒服务
  autoChat: { type: 'boolean', default: false },
  // 待机事件
  idleEvent: { type: 'boolean', default: true },
  // 安静模式
  quietMode: { type: 'boolean', default: false },
  // 是否启用桌面台词板
  desktopSpeechBoard: { type: 'boolean', default: true },
  // 是否启用应用内台词板
  appSpeechBoard: { type: 'boolean', default: true },
  // 助手是否开启
  assistantEnabled: { type: 'boolean', default: false },
  // 当前助手
  currentAssistant: { type: 'string', default: '' },
  // 主题色
  themeColor: { type: 'string', default: '#fb7299' },
  // 聊天快捷键
  chatShortcut: { type: 'string', default: 'Alt+A' },
  // 是否处于睡眠模式
  sleepMode: { type: 'boolean', default: false }
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
    app.setLoginItemSettings({
      openAtLogin: value,
      openAsHidden: false,
      args: value ? ['--auto-start'] : []
    })
  })
}

export { setupConfigIPC, getConfig, setConfig }
