declare module 'page-flip' {
  interface PageFlipSettings {
    width: number
    height: number
    size?: 'fixed' | 'stretch'
    minWidth?: number
    maxWidth?: number
    minHeight?: number
    maxHeight?: number
    drawShadow?: boolean
    flippingTime?: number
    usePortrait?: boolean
    startZIndex?: number
    startPage?: number
    autoSize?: boolean
    maxShadowOpacity?: number
    showCover?: boolean
    mobileScrollSupport?: boolean
    swipeDistance?: number
    clickEventForward?: boolean
    useMouseEvents?: boolean
    disableFlipByClick?: boolean
  }

  type FlipCorner = 'top' | 'bottom'
  type PageOrientation = 'portrait' | 'landscape'
  type PageFlipState = 'user_fold' | 'fold_corner' | 'flipping' | 'read'

  interface PageRect {
    top: number
    left: number
    width: number
    height: number
    pageWidth: number
  }

  interface FlipEvent {
    data: number
    object: PageFlip
  }

  interface ChangeStateEvent {
    data: PageFlipState
    object: PageFlip
  }

  interface OrientationEvent {
    data: PageOrientation
    object: PageFlip
  }

  interface InitOrUpdateEvent {
    data: { page: number; mode: PageOrientation }
    object: PageFlip
  }

  class PageFlip {
    constructor(parent: HTMLElement, settings: PageFlipSettings)

    getPageCount(): number
    getOrientation(): PageOrientation
    getBoundsRect(): PageRect
    getCurrentPageIndex(): number
    turnToPage(pageNum: number): void
    turnToNextPage(): void
    turnToPrevPage(): void
    flipNext(corner?: FlipCorner): void
    flipPrev(corner?: FlipCorner): void
    flip(pageNum: number, corner?: FlipCorner): void
    loadFromHTML(items: NodeListOf<HTMLElement> | HTMLElement[]): void
    loadFromImages(images: string[]): void
    updateFromHTML(items: NodeListOf<HTMLElement> | HTMLElement[]): void
    updateFromImages(images: string[]): void
    destroy(): void

    on(event: 'flip', callback: (e: FlipEvent) => void): void
    on(event: 'changeOrientation', callback: (e: OrientationEvent) => void): void
    on(event: 'changeState', callback: (e: ChangeStateEvent) => void): void
    on(event: 'init', callback: (e: InitOrUpdateEvent) => void): void
    on(event: 'update', callback: (e: InitOrUpdateEvent) => void): void
  }

  export { PageFlip }
}
