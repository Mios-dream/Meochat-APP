/**
 * 窗口 API 类型入口
 *
 * 使用方式：
 *   import type { MainWindowApi, CommonApi } from '@shared/ipc/api'
 *   const api = window.api as MainWindowApi
 */

export * from './base/common'
export * from './windows/main'
export * from './windows/assistant'
export * from './windows/assistantSettings'
export * from './windows/chatBox'
export * from './windows/widget'
export * from './windows/tips'
