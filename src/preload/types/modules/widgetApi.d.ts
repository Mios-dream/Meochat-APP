import type { WidgetApi } from '@shared/types/widget'

declare global {
  interface Window {
    widgetApi: WidgetApi
  }
}

export {}
