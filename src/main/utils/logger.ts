import log from 'electron-log'

// 设置日志级别
log.transports.file.level = 'info'
log.transports.console.level = 'info'

// 设置日志格式
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}'
log.transports.console.format = '[{h}:{i}:{s}] [{level}] {text}'

// 限制日志文件大小（1MB）
log.transports.file.maxSize = 1 * 1024 * 1024

// 导出日志实例
export default log
