import { Application, Container, Sprite, Assets, MeshPlane } from 'pixi.js'
import type { Buffer, Texture } from 'pixi.js'
import { SakuraLayer } from './SakuraLayer'

/** 飘动动画的默认参数 */
const FLUTTER_DEFAULTS = {
  /** 默认横向网格分段数 */
  SEGMENTS_X: 6,
  /** 默认纵向网格分段数 */
  SEGMENTS_Y: 12,
  /** 飘动与扩张收缩之间的相位差（弧度），错开两种运动，避免同频同相显得机械 */
  PHASE_OFFSET: Math.PI / 3
} as const

/**
 * 布料"飘动 + 扩张收缩"动画的配置项（用于裙子等部件）。
 *
 * 原理：把该图层构建为可变形网格平面（MeshPlane），每帧对顶点叠加两种位移：
 * 1. 飘动（sway）：整排顶点同相横向平移，裙摆整体左右摆动，底边位移最大、腰线为 0；
 * 2. 扩张收缩（breathe）：以中线为轴，左右边缘做反向横向位移，使裙摆底边张合
 *    （外扩 / 内收），腰线固定不动。
 * 两种运动共用一个时间基准、相位错开，整体呈现"吹拂飘动 + 底边张合"的自然动态。
 */
export interface FlutterLayerConfig {
  /** 飘动幅度（设计像素）：裙摆整体左右摆动时底边的最大位移，腰线处为 0 */
  sway: number
  /** 扩张收缩幅度（设计像素）：裙摆底边相对中线张合的位移量（左右各外扩/内收的量） */
  breathe: number
  /** 动画角频率（弧度/秒），越大动作越快 */
  speed: number
  /** 初始相位偏移，用于与其他动画错开节奏 */
  phase: number
  /** 横向网格分段数（默认 6），决定横向平滑度 */
  segmentsX?: number
  /** 纵向网格分段数（默认 12），决定裙摆高度的平滑度 */
  segmentsY?: number
}

/**
 * 拖尾扭曲变形动画的配置项（用于丝发、飘带等长条部件，配合 sway 旋转使用）。
 *
 * 原理：把该图层构建为可变形网格平面，每帧对顶点施加沿长度方向相位滞后的、
 * 垂直于长度方向的位移。根部位移恒为 0、与整体运动同步；越靠近自由端相位滞后
 * 越大，自由端落后于主体运动并随之扭曲，形成"摇曳拖尾"感。
 * 拖尾方向由 axis 决定：vertical 用于纵向部件（如后长发，尾部左右摆动）；
 * horizontal 用于横向部件（如头发飘带，尾部上下扇动，根部由 pivotX 锚定端决定）。
 */
export interface TrailLayerConfig {
  /** 拖尾幅度（设计像素）：自由端的最大滞后位移，根部为 0 */
  amplitude: number
  /** 从根部到自由端的总相位滞后（弧度），越大拖尾扭曲越明显 */
  lag: number
  /** 动画角频率（弧度/秒），需与配合的 sway 旋转速度一致以保证同步 */
  speed: number
  /** 初始相位偏移，需与 sway 旋转的相位保持一致（通常相同） */
  phase: number
  /**
   * 拖尾累积与位移方向：'vertical' 沿纵向累积、横向（x）位移（默认）；
   * 'horizontal' 沿横向累积、纵向（y）位移，根部为 pivotX 锚定端
   * （pivotX=0 左端为根、pivotX=1 右端为根）。
   */
  axis?: 'vertical' | 'horizontal'
  /** 横向网格分段数（默认 6） */
  segmentsX?: number
  /** 纵向网格分段数（默认 12），决定拖尾曲线的平滑度 */
  segmentsY?: number
}

/**
 * 背景图层的配置项。
 *
 * 本应用的整体背景由多张拆分好的插画图层拼合而成（设计空间 4800x1600，
 * 与原始整图尺寸一致）。每一层可独立配置：画布摆放坐标、旋转锚点、
 * 鼠标视差系数、摆动动画以及布料飘动动画，从而组合出"壁纸引擎"式的动态氛围背景。
 */
export interface BackgroundLayerConfig {
  /** 图层唯一标识，便于日志定位与后续扩展 */
  key: string
  /** 素材图片路径（经 Vite 编译后的资源 URL） */
  source: string
  /** 绘制层级，数值越小越靠后（背景层为 0） */
  z: number
  /** 画布坐标 X（设计空间 0~4800 内的绝对坐标，需按实际画面手动定位） */
  x: number
  /** 画布坐标 Y（设计空间 0~1600 内的绝对坐标，需按实际画面手动定位） */
  y: number
  /** 旋转锚点 X，取值 0~1，相对自身宽高的归一化比例（0.5 为水平居中） */
  pivotX: number
  /** 旋转锚点 Y，取值 0~1（0 为顶部、1 为底部） */
  pivotY: number
  /**
   * 本地缩放系数，默认 1。
   * 背景层可设为 >1 实现"过扫描"：在 cover 适配导致的零余量方向上留出缓冲，
   * 使视差位移不会露出画布边缘下的底层空白。
   */
  scale?: number
  /** 鼠标视差系数（设计像素），数值越大，该层跟随鼠标位移越明显 */
  parallax: number
  /**
   * 摆动动画配置；可与 flutter 叠加：flutter 负责顶点变形，sway 负责整体旋转摆动。
   * 省略则该图层保持静止，仅参与视差。
   */
  sway?: {
    /** 摆动幅度（弧度），负值可反转摆动方向 */
    rotation: number
    /** 摆动角频率（弧度/秒），越大摆得越快 */
    speed: number
    /** 初始相位偏移，用于错开多个图层的摆动节奏 */
    phase: number
    /** 纵向浮动幅度（设计像素），制造轻微起伏感 */
    translateY: number
    /** 横向浮动幅度（设计像素） */
    translateX: number
  }
  /**
   * 布料飘动动画配置；配置后该图层渲染为可变形网格平面并执行
   * "飘动 + 扩张收缩"。可与 sway 叠加（变形 + 整体旋转摆动）。用于裙子等部件。
   */
  flutter?: FlutterLayerConfig
  /**
   * 拖尾扭曲变形动画配置；配置后该图层渲染为可变形网格平面并执行
   * 随整体旋转滞后的拖尾扭曲。需配合 sway 旋转使用（如后长发）。
   * 与 flutter 二选一。
   */
  trail?: TrailLayerConfig
}

/**
 * 动态背景场景管理器。
 *
 * 负责创建与管理 Pixi WebGL 应用，将拆分图层按配置组装为完整的背景画面，
 * 并驱动三类动画：
 * 1. 鼠标视差：各层按不同系数跟随鼠标位移，产生纵深层次感；
 * 2. 旋转摆动：普通图层围绕锚点做正弦旋转摆动（耳朵）；可再叠加顶点变形；
 * 3. 顶点变形：配置 flutter 的图层（如裙子、前发刘海）执行"飘动 + 扩张收缩"；
 *    配置 trail 的图层（如后长发、头发飘带）执行随主体运动滞后的"拖尾扭曲"。
 *
 * 性能策略：所有动画仅修改 transform 或少量顶点（由 GPU 合成），单 Ticker 驱动；
 * 页面隐藏时降帧至 5fps 以释放 GPU 压力（与 Live2DManager 同策略）。
 */
/**
 * 可变形网格图层的运行时数据（flutter 布料飘动 / trail 拖尾扭曲共用）。
 * 持有可变形网格平面、顶点位置缓冲与原始坐标快照，供每帧叠加位移。
 */
interface MeshDeformData {
  /** 可变形网格平面实例 */
  plane: MeshPlane
  /** 顶点位置缓冲（data 为 Float32Array，修改后需调用 update() 同步 GPU） */
  positionBuffer: Buffer
  /** 网格初始顶点坐标快照（动画前的静态坐标，单位：设计像素） */
  basePositions: Float32Array
  /** 网格横向顶点数 */
  verticesX: number
  /** 网格纵向顶点数 */
  verticesY: number
}

/** 图层运行时实例（含可选可变形网格数据） */
interface LayerInstance {
  config: BackgroundLayerConfig
  view: Sprite | MeshPlane
  baseX: number
  baseY: number
  deform?: MeshDeformData
}

export class BackgroundScene {
  /** 设计空间宽度（与原始整图一致） */
  private readonly designWidth = 4800
  /** 设计空间高度（与原始整图一致） */
  private readonly designHeight = 1600
  /** 隐藏窗口时的降帧上限 */
  private static readonly HIDDEN_MAX_FPS = 5
  /** 鼠标坐标平滑系数，越大跟随越灵敏 */
  private static readonly MOUSE_SMOOTH = 0.05

  /** Pixi 应用实例 */
  private app: Application | null = null
  /** 场景容器：整体负责"封面适配"缩放与居中 */
  private scene: Container | null = null
  /** 各图层的运行时实例集合 */
  private layerInstances: LayerInstance[] = []
  /** 樱花飘落特效层（懒创建，仅当外部首次启用时创建并挂载） */
  private sakuraLayer: SakuraLayer | null = null

  /** 当前鼠标位置（归一化到 -1~1，x 右正左负、y 下正上负） */
  private targetMouse = { x: 0, y: 0 }
  /** 平滑后的鼠标位置，用于驱动视差 */
  private smoothedMouse = { x: 0, y: 0 }
  /** 场景开始运行的时间戳（毫秒），作为动画时间基准 */
  private startTime = 0

  /** 窗口 resize 监听回调（用于重算封面适配），需在销毁时移除 */
  private readonly handleResize = (): void => {
    this.applyCoverFit()
  }

  /** 鼠标移动监听回调，记录归一化坐标 */
  private readonly handleMouseMove = (event: MouseEvent): void => {
    this.targetMouse.x = (event.clientX / window.innerWidth) * 2 - 1
    this.targetMouse.y = (event.clientY / window.innerHeight) * 2 - 1
  }

  /** 页面可见性监听回调，隐藏时降帧 */
  private readonly handleVisibilityChange = (): void => {
    if (!this.app) return
    this.app.ticker.maxFPS = document.hidden ? BackgroundScene.HIDDEN_MAX_FPS : 0
  }

  /**
   * 初始化场景：创建 Pixi 应用、加载图层素材并组装画面。
   * @param canvas 挂载动画的画布元素（需由调用方提供）
   * @param layers 图层配置列表（含素材路径与动画参数）
   */
  public async init(canvas: HTMLCanvasElement, layers: BackgroundLayerConfig[]): Promise<void> {
    if (this.app) {
      console.warn('[BackgroundScene] 场景已初始化，请先调用 destroy()')
      return
    }

    // 创建 WebGL 渲染应用：透明背景、抗锯齿、DPR 上限 2 避免高分辨率膨胀显存
    const app = new Application()
    await app.init({
      preference: 'webgl',
      canvas,
      backgroundAlpha: 0,
      autoStart: true,
      antialias: true,
      resizeTo: window,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio, 2),
      powerPreference: 'high-performance'
    })
    this.app = app

    // 组装场景容器与各图层
    this.scene = new Container()
    app.stage.addChild(this.scene)
    this.buildLayers(layers)

    // 记录时间基准并挂载事件监听
    this.startTime = performance.now()
    window.addEventListener('resize', this.handleResize)
    window.addEventListener('mousemove', this.handleMouseMove)
    document.addEventListener('visibilitychange', this.handleVisibilityChange)

    // 初始封面适配，并启动动画循环
    this.applyCoverFit()
    app.ticker.add(this.update)
  }

  /**
   * 设置樱花飘落特效的显示状态（懒创建）。
   * 首次启用时创建樱花层并挂载到舞台最顶层（场景容器之外，坐标为屏幕像素），
   * 之后仅切换显示状态，不重复创建。
   * @param visible 是否显示樱花
   */
  public setSakuraVisible(visible: boolean): void {
    if (!this.app) return
    if (!this.sakuraLayer) {
      this.sakuraLayer = new SakuraLayer(this.app.renderer.width, this.app.renderer.height)
      this.app.stage.addChild(this.sakuraLayer.view)
      this.sakuraLayer.setVisible(visible)
    } else {
      this.sakuraLayer.setVisible(visible)
    }
  }

  /**
   * 暂停/恢复整个动态背景的动画循环（含背景图层与樱花特效）。
   * 通过停止/启动 Pixi Ticker 实现：暂停时所有动画与每帧更新全部冻结。
   * @param paused true=暂停，false=恢复
   */
  public setPaused(paused: boolean): void {
    if (!this.app) return
    if (paused) {
      this.app.ticker.stop()
    } else {
      this.app.ticker.start()
    }
  }

  /**
   * 根据图层配置加载素材并创建精灵实例。
   * 所有图层先放置在设计空间坐标（0,0 左上角），由 applyCoverFit 统一缩放居中。
   */
  private async buildLayers(layers: BackgroundLayerConfig[]): Promise<void> {
    const sorted = [...layers].sort((a, b) => a.z - b.z)
    for (const config of sorted) {
      try {
        // 加载图层纹理（重复路径由 Pixi 缓存自动去重）
        const texture = await Assets.load(config.source)
        // 本地缩放：背景层用于过扫描留白，其余层默认 1
        const scale = config.scale ?? 1

        let view: Sprite | MeshPlane
        let deform: MeshDeformData | undefined
        if (config.flutter || config.trail) {
          // 可变形网格层：构建网格平面，实现布料飘动或拖尾扭曲
          const built = this.buildDeformPlane(config, texture)
          view = built.view
          deform = built.deformData
        } else {
          // 普通图层：使用精灵，锚点即旋转锚点（自身宽高的归一化比例）
          const sprite = new Sprite(texture)
          sprite.anchor.set(config.pivotX, config.pivotY)
          view = sprite
        }

        view.position.set(config.x, config.y)
        view.scale.set(scale, scale)
        this.scene?.addChild(view)
        this.layerInstances.push({
          config,
          view,
          baseX: config.x,
          baseY: config.y,
          deform
        })
      } catch (error) {
        // 单个图层加载失败不应阻塞整体背景，仅记录告警并跳过该层
        console.error(`[BackgroundScene] 图层 ${config.key} 加载失败:`, error)
      }
    }
  }

  /**
   * 构建可变形网格图层：创建网格平面并初始化变形运行时数据。
   * @param config 图层配置（必须包含 flutter 或 trail 配置）
   * @param texture 已加载的图层纹理
   * @returns 网格平面视图与其变形运行时数据
   */
  private buildDeformPlane(
    config: BackgroundLayerConfig,
    texture: Texture
  ): { view: MeshPlane; deformData: MeshDeformData } {
    const deformConfig = config.flutter ?? config.trail!
    const verticesX = deformConfig.segmentsX ?? FLUTTER_DEFAULTS.SEGMENTS_X
    const verticesY = deformConfig.segmentsY ?? FLUTTER_DEFAULTS.SEGMENTS_Y
    const plane = new MeshPlane({ texture, verticesX, verticesY })
    // MeshPlane 没有 anchor，用 pivot 等价实现归一化锚点（像素级偏移）
    plane.pivot.set(texture.width * config.pivotX, texture.height * config.pivotY)
    // 记录初始顶点坐标快照，供每帧在原始位置上叠加位移
    const positionBuffer = plane.geometry.getAttribute('aPosition').buffer
    const basePositions = new Float32Array(positionBuffer.data)
    return {
      view: plane,
      deformData: {
        plane,
        positionBuffer,
        basePositions,
        verticesX,
        verticesY
      }
    }
  }

  /**
   * 封面适配：将 4800x1600 的设计空间等比缩放并铺满窗口。
   * 采用 cover（等比放大裁切）策略，与原始 CSS 背景效果保持一致。
   * 场景容器原点 = 缩放后画布的左上角，因此设计空间 (0,0) 恰好对齐可视区域左上角。
   */
  private applyCoverFit(): void {
    if (!this.scene || !this.app) return
    const renderer = this.app.renderer
    const scale = Math.max(renderer.width / this.designWidth, renderer.height / this.designHeight)
    this.scene.scale.set(scale, scale)
    this.scene.position.set(
      (renderer.width - this.designWidth * scale) / 2,
      (renderer.height - this.designHeight * scale) / 2
    )
    // 同步樱花特效层的屏幕边界（其为独立舞台层，使用屏幕像素坐标系）
    this.sakuraLayer?.resize(renderer.width, renderer.height)
  }

  /**
   * 每帧动画更新：平滑跟随鼠标计算视差，并驱动各图层的正弦摆动。
   * 全部只修改精灵的 position/rotation，走 GPU 合成，性能开销极小。
   */
  private readonly update = (): void => {
    if (!this.app) return
    // 对鼠标坐标做指数平滑，避免视差生硬跳变
    this.smoothedMouse.x +=
      (this.targetMouse.x - this.smoothedMouse.x) * BackgroundScene.MOUSE_SMOOTH
    this.smoothedMouse.y +=
      (this.targetMouse.y - this.smoothedMouse.y) * BackgroundScene.MOUSE_SMOOTH

    // 以毫秒为单位的累计动画时间，作为正弦波形的自变量
    const t = performance.now() - this.startTime
    const seconds = t / 1000

    for (const layer of this.layerInstances) {
      const { config, view, baseX, baseY } = layer
      // 1. 视差位移：各层按配置系数跟随鼠标
      const parallaxX = this.smoothedMouse.x * config.parallax
      const parallaxY = this.smoothedMouse.y * config.parallax
      view.x = baseX + parallaxX
      view.y = baseY + parallaxY

      // 2. 动画：顶点变形（flutter 布料飘动 / trail 拖尾扭曲）与旋转摆动
      //    （transform 旋转）可叠加。同时配置时先做顶点变形、再做整体旋转，
      //    二者互不影响（如后长发的"旋转摆动 + 拖尾扭曲"叠加效果）。
      if (config.flutter && layer.deform) {
        this.applyFlutter(layer.config, layer.deform, seconds)
      }
      if (config.trail && layer.deform) {
        this.applyTrail(layer.config, layer.deform, seconds)
      }
      const sway = config.sway
      if (sway) {
        const phase = seconds * sway.speed + sway.phase
        view.rotation = Math.sin(phase) * sway.rotation
        view.x += Math.cos(phase) * sway.translateX
        view.y += Math.sin(phase) * sway.translateY
      }
    }

    // 驱动樱花飘落特效（内部自判断显示状态，隐藏时零开销）
    this.sakuraLayer?.update()
  }

  /**
   * 驱动布料飘动：对网格顶点叠加两种横向位移——"飘动"使整排同相平移（裙摆左右
   * 摆动），"扩张收缩"以中线为轴让左右边缘反向位移（裙摆底边张合）。两种运动
   * 共用时间基准、相位错开，腰线处位移恒为 0，底边动作最大。
   * 仅修改横向坐标，纵向保持不动，避免裙摆与身体分离。
   * @param config 图层配置（含 flutter 参数）
   * @param deform 可变形网格运行时数据
   * @param seconds 累计动画时间（秒）
   */
  private applyFlutter(
    config: BackgroundLayerConfig,
    deform: MeshDeformData,
    seconds: number
  ): void {
    const flutterConfig = config.flutter!
    const { positionBuffer, basePositions, verticesX, verticesY } = deform
    const data = positionBuffer.data as Float32Array
    // 基础相位驱动飘动；张合相位与飘动错开，动作更自然
    const swayPhase = seconds * flutterConfig.speed + flutterConfig.phase
    const breathePhase = swayPhase + FLUTTER_DEFAULTS.PHASE_OFFSET
    // 预计算两种位移的瞬时值（不含纵向缩放）
    const swayOffset = Math.sin(swayPhase) * flutterConfig.sway
    const breatheOffset = Math.cos(breathePhase) * flutterConfig.breathe

    for (let j = 0; j < verticesY; j++) {
      // v：纵向归一化位置，0 为腰线（锚点行）、1 为裙摆底部
      const v = j / (verticesY - 1)
      const swayDx = swayOffset * v
      const breatheDx = breatheOffset * v
      const rowIndex = j * verticesX
      for (let i = 0; i < verticesX; i++) {
        // u：横向归一化位置，0 为左边缘、0.5 为中线、1 为右边缘
        const u = i / (verticesX - 1)
        const idx = (rowIndex + i) * 2
        data[idx] = basePositions[idx] + swayDx + (u - 0.5) * 2 * breatheDx
        data[idx + 1] = basePositions[idx + 1]
      }
    }
    // 通知 Pixi 将新的顶点数据同步到 GPU
    positionBuffer.update()
  }

  /**
   * 驱动拖尾扭曲：对网格顶点施加沿长度方向相位滞后、垂直于长度方向的位移。
   * 根部位移恒为 0、与主体运动同步；越靠近自由端相位滞后越大（二次方累积），
   * 自由端落后并扭曲，形成"摇曳拖尾"感。
   * vertical 轴：沿纵向累积，横向（x）位移（如后长发）；
   * horizontal 轴：沿横向累积，纵向（y）位移，根部为 pivotX 锚定端（如头发飘带）。
   * @param config 图层配置（含 trail 参数）
   * @param deform 可变形网格运行时数据
   * @param seconds 累计动画时间（秒）
   */
  private applyTrail(config: BackgroundLayerConfig, deform: MeshDeformData, seconds: number): void {
    const trailConfig = config.trail!
    const { positionBuffer, basePositions, verticesX, verticesY } = deform
    const data = positionBuffer.data as Float32Array
    const isHorizontal = trailConfig.axis === 'horizontal'
    // horizontal 轴：根部在 pivotX 锚定端（pivotX=1 右端为根，pivotX=0 左端为根）
    const horizontalRootRight = isHorizontal && config.pivotX >= 0.5
    // 根部相位与整体运动一致；自由端相位滞后
    const rootPhase = seconds * trailConfig.speed + trailConfig.phase
    const verticesCount = verticesX * verticesY

    for (let idx = 0; idx < verticesCount; idx++) {
      const i = idx % verticesX
      const j = (idx / verticesX) | 0
      // u：横向归一化位置（0 为左边缘、1 为右边缘）；v：纵向归一化位置（0 顶、1 底）
      const u = i / (verticesX - 1)
      const v = j / (verticesY - 1)
      // k：0 为根部、1 为自由端（拖尾沿长度方向的归一化累积位置）
      const k = isHorizontal ? (horizontalRootRight ? 1 - u : u) : v
      // 振幅随长度位置线性放大：根部为 0、自由端最大
      const amp = trailConfig.amplitude * k
      // 相位滞后沿长度方向二次方累积：近根端紧跟主体、末端滞后急剧加大
      const phase = rootPhase - trailConfig.lag * k * k
      const displace = Math.sin(phase) * amp
      // 位移垂直于长度方向：vertical 轴改 x，horizontal 轴改 y
      data[idx * 2] = basePositions[idx * 2] + (isHorizontal ? 0 : displace)
      data[idx * 2 + 1] = basePositions[idx * 2 + 1] + (isHorizontal ? displace : 0)
    }
    // 通知 Pixi 将新的顶点数据同步到 GPU
    positionBuffer.update()
  }

  /**
   * 销毁场景：释放 WebGL 资源、移除监听并停止动画循环。
   */
  public destroy(): void {
    window.removeEventListener('resize', this.handleResize)
    window.removeEventListener('mousemove', this.handleMouseMove)
    document.removeEventListener('visibilitychange', this.handleVisibilityChange)
    this.layerInstances = []
    this.sakuraLayer?.destroy()
    this.sakuraLayer = null
    if (this.app) {
      // 注意：不得传入 true（等价于 releaseGlobalResources），否则 Pixi 会清空
      // 全局共享的 Batch 池，破坏同时存在的其他 Pixi 应用（如助手空间 Live2D）的渲染，
      // 触发 "Cannot read properties of null (reading 'ids')"。
      // 纹理同样不显式销毁：素材纹理来自全局 Assets 缓存，随本 WebGL context
      // 销毁后 GPU 资源自动释放；若销毁 JS 纹理对象会导致重进时 Assets 命中已销毁纹理。
      this.app.destroy({ removeView: true }, { children: true })
      this.app = null
    }
  }
}
