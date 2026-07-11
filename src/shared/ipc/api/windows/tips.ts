/**
 * Tips 提示窗口 API 类型
 */

import type { CommonApi } from '../base/common'

/** Tips 提示窗口暴露的 API 接口 */
export interface TipsWindowApi extends CommonApi {
  tipsApi: {
    onShow: (callback: (data?: { message?: string; avatarUrl?: string }) => void) => () => void
    onHide: (callback: () => void) => () => void
    onMessage: (callback: (data: { message: string; avatarUrl?: string }) => void) => () => void
  }
}
