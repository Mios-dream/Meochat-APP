import path from 'path'
import log from 'electron-log'
import { resolveLogDir } from './pathResolve'

// 设置日志级别
log.transports.file.level = 'info'
log.transports.console.level = 'info'

// 禁用主进程 → 渲染进程的日志 IPC 转发：
// electron-log 的 ipc transport 会向 BrowserWindow.getAllWindows() 的所有窗口
// 广播 __ELECTRON_LOG_IPC__，其中包含由 window.open 创建、未运行 preload 的
// 小组件子窗口——向其 webContents.send 会触发 Electron
// 「ipcNative object was missing」报错。本项目渲染进程未初始化 electron-log，
// 该转发本就没有接收方（主进程日志由 console / file transport 输出），直接禁用。
log.transports.ipc.level = false

// 设置日志格式
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}'
log.transports.console.format = '[{h}:{i}:{s}] [{level}] {text}'

// 限制日志文件大小（1MB）
log.transports.file.maxSize = 1 * 1024 * 1024

// 自定义日志文件存储位置
log.transports.file.resolvePathFn = () => path.join(resolveLogDir(), 'main.log')

// 导出日志实例
export default log
