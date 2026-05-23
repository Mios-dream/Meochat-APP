import type { Application, WebGLRenderer } from 'pixi.js'

/**
 * 从点击的位置判断像素是否透明。
 */
export function isPixelTransparentFromEvent(app: Application | null, event: MouseEvent): boolean {
  if (!app || !app.renderer) return false

  const gl = (app.renderer as WebGLRenderer).gl
  const canvas = app.canvas as HTMLCanvasElement
  const rect = canvas.getBoundingClientRect()

  // 计算相对于canvas的CSS坐标
  const cssX = event.clientX - rect.left
  const cssY = event.clientY - rect.top

  // 使用真实画布像素尺寸进行映射，避免 autoDensity / DPI 场景下命中偏移
  const scaleX = rect.width > 0 ? canvas.width / rect.width : 1
  const scaleY = rect.height > 0 ? canvas.height / rect.height : 1
  const glX = Math.floor(cssX * scaleX)
  const glY = Math.floor(cssY * scaleY)

  // 注意：WebGL坐标系Y轴方向与CSS相反
  const glYFlipped = canvas.height - glY - 1

  // 边界检查
  if (glX < 0 || glYFlipped < 0 || glX >= canvas.width || glYFlipped >= canvas.height) {
    return true // 超出边界视为透明
  }

  const pixels = new Uint8Array(4)
  gl.readPixels(glX, glYFlipped, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
  return pixels[3] < 10
}
