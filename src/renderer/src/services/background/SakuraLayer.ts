/**
 * SakuraLayer.ts
 *
 * 樱花飘落特效层：以 Pixi Sprite 实现的"全屏飘落樱花"装饰层。
 *
 * 设计定位（与 BackgroundScene 明确区分，避免混用）：
 * - 背景图层（BackgroundScene）负责"设计空间 4800x1600 的插画拼图 + 布料变形动画"，
 *   使用设计坐标、锚点、cover 适配；
 * - 本层不关心设计空间、锚点、cover 适配等背景逻辑，只负责"屏幕像素（CSS）坐标系
 *   下的樱花瓣粒子动画"，从实现到职责与背景图层完全解耦。
 *
 * 生命周期约定：
 * - 由 BackgroundScene 将该层挂载到 Pixi 舞台最顶层（场景容器之外），坐标为屏幕像素；
 * - 通过 setVisible() 控制显示/隐藏，由 BackgroundScene 的 update 循环每帧驱动推进；
 * - 仅在可见时产生更新开销，隐藏时零成本。
 */
import { Assets, Container, Sprite, Texture } from 'pixi.js'
import sakuraImg from '../../assets/images/sakura.webp'

/** 默认樱花瓣数量 */
const DEFAULT_PETAL_COUNT = 12

/** 单片樱花瓣的运行时数据 */
interface SakuraPetalData {
  /** 花瓣精灵实例 */
  sprite: Sprite
  /** 花瓣边长（CSS 像素），用于越界判定的参考尺寸 */
  size: number
  /** 下落速度（像素/帧） */
  fallSpeed: number
  /** 自旋角速度（弧度/帧） */
  rotationSpeed: number
  /** 横向摆动相位（弧度） */
  swayPhase: number
  /** 横向摆动角速度（弧度/帧） */
  swaySpeed: number
}

/**
 * 樱花飘落特效层。
 *
 * 实现说明：
 * - 纹理懒加载：仅在首次被显示时通过 Pixi Assets 加载，加载完成前不阻塞背景；
 * - 每片花瓣为一个 Sprite，anchor 居中、旋转围绕自身中心，与原有 Canvas2D 的
 *   drawImage(旋转) 视觉一致；
 * - 动画参数与原 Canvas2D 版本保持一致（尺寸 14~28px、下落 0.3~0.8px/帧等），
 *   不引入新的视觉差异。
 */
export class SakuraLayer {
  /** 花瓣根容器，挂载到 Pixi 舞台最顶层 */
  private readonly container: Container
  /** 当前屏幕宽度（CSS 像素） */
  private width: number
  /** 当前屏幕高度（CSS 像素） */
  private height: number
  /** 樱花瓣数量 */
  private readonly petalCount: number
  /** 花瓣运行时数据集合 */
  private petals: SakuraPetalData[] = []
  /** 樱花纹理（懒加载，加载完成后非空） */
  private texture: Texture | null = null
  /** 当前显示状态 */
  private visible = false
  /** 纹理加载 Promise（防止重复触发加载） */
  private initPromise: Promise<void> | null = null
  /** 已销毁标志，用于拦截加载完成后的异步回调 */
  private destroyed = false

  /**
   * @param width 初始屏幕宽度（CSS 像素）
   * @param height 初始屏幕高度（CSS 像素）
   * @param petalCount 樱花瓣数量，默认 12
   */
  constructor(width: number, height: number, petalCount: number = DEFAULT_PETAL_COUNT) {
    this.width = width
    this.height = height
    this.petalCount = petalCount
    this.container = new Container()
    this.container.visible = false
  }

  /** 根容器（供外部挂载到 Pixi 舞台） */
  public get view(): Container {
    return this.container
  }

  /**
   * 设置显示状态。
   * - 首次显示时触发纹理懒加载，加载完成后自动生成花瓣；
   * - 纹理就绪后的每次显示都会将花瓣重置到屏幕上方，制造"重新飘落"的起始观感。
   * @param visible 是否显示樱花
   */
  public setVisible(visible: boolean): void {
    this.visible = visible
    if (!visible) {
      this.container.visible = false
      return
    }
    if (this.texture) {
      this.spawnPetals()
      this.resetPetalsToTop()
      this.container.visible = true
    } else if (!this.initPromise) {
      this.initPromise = this.loadTexture().finally(() => {
        this.initPromise = null
      })
    }
  }

  /**
   * 每帧推进樱花动画（由 BackgroundScene 的 update 循环驱动）。
   * 仅在显示状态下产生开销，隐藏时直接返回。
   */
  public update(): void {
    if (!this.visible || this.petals.length === 0) return
    for (const petal of this.petals) {
      // 推进摆动相位并叠加横向位移，模拟风中的斜向飘落
      petal.swayPhase += petal.swaySpeed
      petal.sprite.x += Math.sin(petal.swayPhase) * 0.3
      petal.sprite.y += petal.fallSpeed
      petal.sprite.rotation += petal.rotationSpeed
      // 越界回收：底部掉出则从顶部重投，左右越界则从对侧回到视野
      if (petal.sprite.y > this.height + petal.size) {
        petal.sprite.y = -petal.size
        petal.sprite.x = Math.random() * this.width
      }
      if (petal.sprite.x > this.width + petal.size) petal.sprite.x = -petal.size
      if (petal.sprite.x < -petal.size) petal.sprite.x = this.width + petal.size
    }
  }

  /**
   * 屏幕尺寸变化时同步边界：按比例缩放花瓣坐标并夹取到新边界内，
   * 避免窗口调整后花瓣停留在视野外。
   * @param width 新屏幕宽度（CSS 像素）
   * @param height 新屏幕高度（CSS 像素）
   */
  public resize(width: number, height: number): void {
    if (this.petals.length === 0) {
      this.width = width
      this.height = height
      return
    }
    const scaleX = this.width > 0 ? width / this.width : 1
    const scaleY = this.height > 0 ? height / this.height : 1
    for (const petal of this.petals) {
      petal.sprite.x = Math.min(Math.max(petal.sprite.x * scaleX, -petal.size), width + petal.size)
      petal.sprite.y = Math.min(Math.max(petal.sprite.y * scaleY, -petal.size), height + petal.size)
    }
    this.width = width
    this.height = height
  }

  /** 销毁层：清空精灵并释放纹理引用，防止异步回调穿透 */
  public destroy(): void {
    this.destroyed = true
    this.visible = false
    this.petals = []
    this.texture = null
    this.container.destroy({ children: true })
  }

  /** 加载樱花纹理；失败时仅记录告警，不中断背景运行 */
  private async loadTexture(): Promise<void> {
    try {
      const texture = await Assets.load(sakuraImg)
      if (this.destroyed) return
      this.texture = texture
      if (this.visible) {
        this.spawnPetals()
        this.resetPetalsToTop()
        this.container.visible = true
      }
    } catch (error) {
      console.error('[SakuraLayer] 樱花纹理加载失败:', error)
    }
  }

  /** 生成全部樱花瓣精灵（幂等：已生成则直接复用） */
  private spawnPetals(): void {
    const texture = this.texture
    if (!texture || this.petals.length > 0) return
    for (let i = 0; i < this.petalCount; i++) {
      const size = 14 + Math.random() * 14
      const sprite = new Sprite(texture)
      sprite.anchor.set(0.5)
      sprite.width = size
      sprite.height = size
      sprite.alpha = 0.5 + Math.random() * 0.5
      this.container.addChild(sprite)
      this.petals.push({
        sprite,
        size,
        fallSpeed: 0.3 + Math.random() * 0.5,
        rotationSpeed: (Math.random() - 0.5) * 0.015,
        swayPhase: Math.random() * Math.PI * 2,
        swaySpeed: 0.005 + Math.random() * 0.008
      })
    }
  }

  /** 将所有花瓣重置到屏幕上方随机位置（每次显示时制造"重新飘落"的起始状态） */
  private resetPetalsToTop(): void {
    for (const petal of this.petals) {
      petal.sprite.x = Math.random() * this.width
      petal.sprite.y = Math.random() * this.height - this.height
      petal.sprite.rotation = Math.random() * Math.PI * 2
    }
  }
}
