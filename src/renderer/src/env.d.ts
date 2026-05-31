/// <reference types="vite/client" />

/** 提示窗口 API 类型声明 */
interface TipsApi {
  onShow: (callback: (data?: { message?: string; avatarUrl?: string }) => void) => () => void
  onHide: (callback: () => void) => () => void
  onMessage: (callback: (data: { message: string; avatarUrl?: string }) => void) => () => void
  ready: () => void
  animationComplete: () => void
}

interface Window {
  tipsApi?: TipsApi
}

declare module '*.css' {
  const css: string
  export default css
}

declare module '*.scss' {
  const css: string
  export default css
}

declare module '*.sass' {
  const css: string
  export default css
}

declare module '*.less' {
  const css: string
  export default css
}

declare module '*.png' {
  const url: string
  export default url
}

declare module '*.jpg' {
  const url: string
  export default url
}

declare module '*.jpeg' {
  const url: string
  export default url
}

declare module '*.gif' {
  const url: string
  export default url
}

declare module '*.svg' {
  const url: string
  export default url
}

declare module '*.webp' {
  const url: string
  export default url
}
