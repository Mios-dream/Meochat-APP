// src/renderer/src/services/ClickEffectService.ts
//
// 全局点击光效服务。
// 本实现是对 BA-Spark-Cursor（VanillaNahida/BA-Spark-Cursor）spark.js 的逐参数移植：
//   波纹（溶解圆弧）、中心填充光盘、旋转三角碎片、鼠标拖尾的尺寸、寿命、
//   旋转速度、颜色曲线、衰减速率等均与参考实现一致，唯一替换的是主题色——
//   参考实现固定使用 BA 蓝（45,175,255），此处改为读取 CSS 变量 --theme-color。
// 采用 Canvas 2D + 加色混合（lighter）实现游戏光效的辉光叠加效果。
//
// 相对参考实现仅保留的安全增强：
//   1. 输入边界：仅响应主键（button===0 + isPrimary），过滤右键/中键/多指次触点；
//   2. prefers-reduced-motion 时整体停用；
//   3. 粒子数量设置宽松上限，防止极端连点造成的性能堆积。

interface RingSegment {
  off: number
  len: number
  rRoundRate: number
}

interface Wave {
  x: number
  y: number
  /** 填充光盘当前半径（随生命周期用三次缓动增大） */
  r: number
  /** 已存活帧数（以 60fps 为基准的帧计数） */
  life: number
  /** 环带状态：基准角度、旋转速度与弧线段列表 */
  ring: {
    ang: number
    rs: number
    segs: RingSegment[]
  }
}

interface Spark {
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  /** 旋转角速度（弧度/帧） */
  rs: number
  /** 三角形边长（像素） */
  s: number
  /** 透明度 0~1 */
  a: number
  /** 是否来自点击（拖尾碎片使用不同时间缩放与衰减） */
  fromClick: boolean
}

interface TrailPoint {
  x: number
  y: number
  life: number
}

export class ClickEffectService {
  private static instance: ClickEffectService | null = null

  // ===== 参考实现可调参数（与 BA-Spark-Cursor 默认值一致） =====
  /** 全局缩放系数 */
  private scale = 1.2
  /** 整体不透明度 */
  private opacity = 1
  /** 拖尾时间倍率 */
  private trailSpeed = 1
  /** 点击特效时间倍率 */
  private clickSpeed = 1
  /** 拖尾采样点数量上限 */
  private maxTrail = 16
  /** 是否启用鼠标拖尾（与参考实现 enableTrail 默认值一致） */
  private enableTrail = false

  // ===== 参考实现的粒子生命周期配置（逐参数移植） =====
  /** 中心填充光盘：半径增量 26，寿命 16 帧 */
  private static readonly FILLED_CIRCLE_CFG = { rAddRate: 26, maxLife: 16 }
  /** 溶解圆弧：旋转速度候选、半径倍率候选、弧长、寿命 23 帧、分段数、粗细范围、溶解阈值 */
  private static readonly RINGS_ANIM_CFG = {
    rsList: [0, 0.08, 0.1],
    rRoundRateList: [0, 1, 1.5, 2],
    len: 1.1 * Math.PI,
    maxLife: 23,
    segNum: 10,
    minW: 0.4,
    maxW: 3.3,
    lenStopAddPoint: 0.1,
    lenStartDimPoint: 0.4
  }
  /** 点击生成配置：环带参数与星点数量 */
  private static readonly CREATE_CLICK_CFG = {
    rings: {
      rsList: [0, 0.03, 0.06],
      rRoundRateList: [0, 1, 1.5, 2],
      len: 1.1 * Math.PI
    },
    sparksCount: 4
  }

  // ===== 渲染状态 =====
  private mainCanvas: HTMLCanvasElement | null = null
  private mainCtx: CanvasRenderingContext2D | null = null

  private waves: Wave[] = []
  private sparks: Spark[] = []
  private trail: TrailPoint[] = []
  private wavePool: Wave[] = []
  private sparkPool: Spark[] = []

  /** 是否处于按下状态（用于拖尾衰减速率切换） */
  private isDown = false
  /** 最近一次指针位置 */
  private lastPos: { x: number; y: number } | null = null

  /** 帧率基准（60fps） */
  private static readonly BASE_FRAME_MS = 1000 / 60
  /** 最大单帧步长，防止切后台后恢复时跳帧爆炸 */
  private static readonly MAX_DELTA_MS = 100
  private lastFrameTime = 0
  private rafId = 0
  private mounted = false
  private resizeObserver: ResizeObserver | null = null

  /** 当前指针 id，用于匹配 pointerup 结束拖尾 */
  private activePointer: number | null = null

  /** 主题色 RGB（读取 CSS 变量 --theme-color，已按减淡系数提亮） */
  private colorRgb: [number, number, number] = [45, 175, 255]
  /** 主题色逗号分隔字符串，用于拼接 rgba 颜色，避免每帧反复 join */
  private colorCss = '45,175,255'
  /** 环带起点色（白色高能核心） */
  private ringsStartColor: [number, number, number] = [250, 252, 252]
  /** 环带终点色（主题色混入 2/3 白色，与参考实现 ringsEndColorFromRgb 一致） */
  private ringsEndColor: [number, number, number] = [250, 252, 252]

  /** 用户开启"减弱动态效果"时整体停用 */
  private readonly reducedMotion: boolean =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  /** 波纹数量安全上限（正常使用远达不到，仅防御极端连点） */
  private static readonly MAX_WAVES = 40
  /** 星点数量安全上限 */
  private static readonly MAX_SPARKS = 200
  /** 设备像素比上限，控制高分屏填充成本 */
  private static readonly MAX_DPR = 2
  /**
   * 主题色减淡系数（0~1）。
   * 应用主题粉（252,142,173）比参考实现的 BA 蓝（45,175,255）饱和度高，
   * 直接使用会显得颜色过深。此处将主题色按该比例向白色混入，
   * 保持色相的同时提升明度，使填充光盘、拖尾与环带整体变浅。
   * 数值越大颜色越淡，0 表示使用原始主题色。
   */
  private static readonly COLOR_LIGHTEN = 0.2

  static getInstance(): ClickEffectService {
    if (!ClickEffectService.instance) {
      ClickEffectService.instance = new ClickEffectService()
    }
    return ClickEffectService.instance
  }

  /**
   * 挂载光效服务。
   * 初始化画布与离屏缓冲、读取主题色、监听指针与尺寸事件，并启动渲染循环。
   * @param canvas 承载光效的全屏画布元素（由 ClickEffectLayer.vue teleport 到 body）
   */
  mount(canvas: HTMLCanvasElement): void {
    if (this.mounted) {
      return
    }

    this.mainCanvas = canvas
    this.mainCtx = canvas.getContext('2d')

    this.readThemeColor()
    this.resize()

    // 监听画布尺寸变化（窗口 resize、DPI 变化、多显示器切换均会触发）
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(canvas)
    window.addEventListener('resize', this.handleWindowResize)

    // 指针事件（参考实现用 mouse 事件；改用 pointer 事件在视觉一致的前提下
    // 同时支持触摸，并可在主键过滤上获得更精确的边界判断）
    window.addEventListener('pointerdown', this.handlePointerDown, {
      capture: true,
      passive: true
    })
    window.addEventListener('pointermove', this.handlePointerMove, { passive: true })
    window.addEventListener('pointerup', this.handlePointerUp, { passive: true })
    window.addEventListener('pointercancel', this.handlePointerUp, { passive: true })
    // 窗口失焦时强制结束拖尾，避免指针在其他窗口释放后状态残留
    window.addEventListener('blur', this.handleWindowBlur)

    this.lastFrameTime = performance.now()
    this.rafId = requestAnimationFrame(this.animationLoops)
    this.mounted = true
  }

  /**
   * 卸载光效服务。
   * 移除所有监听、停止渲染循环、清空全部状态并释放画布。
   */
  unmount(): void {
    if (!this.mounted) {
      return
    }

    cancelAnimationFrame(this.rafId)
    this.rafId = 0

    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
      this.resizeObserver = null
    }
    window.removeEventListener('resize', this.handleWindowResize)
    window.removeEventListener('pointerdown', this.handlePointerDown, {
      capture: true
    } as EventListenerOptions)
    window.removeEventListener('pointermove', this.handlePointerMove)
    window.removeEventListener('pointerup', this.handlePointerUp)
    window.removeEventListener('pointercancel', this.handlePointerUp)
    window.removeEventListener('blur', this.handleWindowBlur)

    this.waves.length = 0
    this.sparks.length = 0
    this.trail.length = 0
    this.wavePool.length = 0
    this.sparkPool.length = 0
    this.isDown = false
    this.lastPos = null
    this.activePointer = null

    this.mainCanvas = null
    this.mainCtx = null
    this.mounted = false
  }

  // ===== 输入事件（边界处理与参考实现保持一致的行为） =====

  /**
   * 全局 pointerdown 处理。
   * 边界约定：
   *   - 仅响应主键（左键 / 单指触摸），过滤右键、中键与多指次要触点；
   *   - 事件被 preventDefault 消费、或开启"减弱动态效果"时不生成光效；
   *   - 标题栏等 app-region: drag 区域被 Electron 消费，事件不会到达此处；
   *   - 拖拽只在此刻触发一次光效，不随移动刷屏。
   */
  private handlePointerDown = (event: PointerEvent): void => {
    if (this.reducedMotion || event.defaultPrevented) {
      return
    }
    if (event.button !== 0 || !event.isPrimary) {
      return
    }
    this.isDown = true
    this.activePointer = event.pointerId
    this.lastPos = { x: event.clientX, y: event.clientY }
    this.createEffects(this.lastPos.x, this.lastPos.y)
  }

  /** 按住主键拖动时采样拖尾点，并小概率生成拖尾碎片 */
  private handlePointerMove = (event: PointerEvent): void => {
    if (!this.enableTrail) {
      return
    }
    if (event.pointerId !== this.activePointer) {
      return
    }
    const p = { x: event.clientX, y: event.clientY }
    const prev = this.lastPos
    if (!prev) {
      this.lastPos = p
      return
    }
    // 移动距离过小时跳过，避免密集采样
    if (Math.hypot(p.x - prev.x, p.y - prev.y) > 2) {
      this.trail.push({ x: p.x, y: p.y, life: 1 })
      if (this.trail.length > this.maxTrail) {
        this.trail.shift()
      }

      // 30% 概率在轨迹上生成飞散碎片
      if (Math.random() < 0.3) {
        const a = Math.random() * Math.PI * 2
        const speedAdjust = this.scale / 1.5
        this.sparks.push({
          x: p.x + Math.cos(a) * 10 * this.scale,
          y: p.y + Math.sin(a) * 10 * this.scale,
          vx: Math.cos(a) * 1.3 * speedAdjust,
          vy: Math.sin(a) * 1.3 * speedAdjust,
          rot: Math.random() * Math.PI * 2,
          rs: 0.16,
          s: 9 * this.scale,
          a: 0.7,
          fromClick: false
        })
      }
    }
    this.lastPos = p
  }

  /** 释放主键（或指针取消）时结束拖尾 */
  private handlePointerUp = (event: PointerEvent): void => {
    if (event.pointerId === this.activePointer) {
      this.isDown = false
      this.activePointer = null
    }
  }

  /** 窗口失焦：强制结束拖尾 */
  private handleWindowBlur = (): void => {
    this.isDown = false
    this.activePointer = null
  }

  /** 窗口尺寸变化时重建画布缓冲 */
  private handleWindowResize = (): void => {
    this.resize()
  }

  // ===== 光效生成（与参考实现 createEffects 一致） =====

  /**
   * 在指定坐标生成一次点击光效：波纹（2 段溶解圆弧）+ 中心填充光盘 + 星点碎片。
   * @param x 点击点视口横坐标（clientX）
   * @param y 点击点视口纵坐标（clientY）
   */
  private createEffects(x: number, y: number): void {
    const rc = ClickEffectService.CREATE_CLICK_CFG.rings

    // 波纹数量达安全上限时回收最旧波纹
    if (this.waves.length >= ClickEffectService.MAX_WAVES) {
      const oldest = this.waves.shift()
      if (oldest) {
        this.wavePool.push(oldest)
      }
    }

    // 从对象池取波纹对象，复用避免 GC 抖动
    const wave = this.wavePool.pop() ?? this.createWave()
    wave.x = x
    wave.y = y
    wave.r = 0
    wave.life = 0
    wave.ring.ang = Math.random() * Math.PI * 2
    wave.ring.rs = rc.rsList[Math.floor(Math.random() * rc.rsList.length)]
    // 复用池内弧段对象，避免每次点击新建两个对象造成 GC 压力
    const seg0 = wave.ring.segs[0] ?? (wave.ring.segs[0] = { off: 0, len: 0, rRoundRate: 0 })
    seg0.off = 0
    seg0.len = rc.len
    seg0.rRoundRate = rc.rRoundRateList[Math.floor(Math.random() * rc.rRoundRateList.length)]
    const seg1 = wave.ring.segs[1] ?? (wave.ring.segs[1] = { off: 0, len: 0, rRoundRate: 0 })
    seg1.off = (Math.random() * 3 - 1.5) * Math.PI
    seg1.len = rc.len
    seg1.rRoundRate = rc.rRoundRateList[Math.floor(Math.random() * rc.rRoundRateList.length)]
    this.waves.push(wave)

    // 星点碎片沿随机方向飞散
    const speedAdjust = this.scale / 1.5
    const sparksCount = ClickEffectService.CREATE_CLICK_CFG.sparksCount
    for (let i = 0; i < sparksCount; i++) {
      if (this.sparks.length >= ClickEffectService.MAX_SPARKS) {
        const oldest = this.sparks.shift()
        if (oldest) {
          this.sparkPool.push(oldest)
        }
      }
      const a = Math.random() * Math.PI * 2
      const speed = (4.8 + Math.random() * 2) * speedAdjust

      const spark = this.sparkPool.pop() ?? this.createSpark()
      spark.x = x
      spark.y = y
      spark.vx = Math.cos(a) * speed
      spark.vy = Math.sin(a) * speed
      spark.rot = Math.random() * Math.PI * 2
      spark.rs = (Math.random() - 0.5) * 0.28
      spark.s = (4 + Math.random() * 3) * this.scale
      spark.a = 1
      spark.fromClick = true
      this.sparks.push(spark)
    }
  }

  /** 创建波纹对象（首次创建，之后复用） */
  private createWave(): Wave {
    return { x: 0, y: 0, r: 0, life: 0, ring: { ang: 0, rs: 0, segs: [] } }
  }

  /** 创建星点对象（首次创建，之后复用） */
  private createSpark(): Spark {
    return { x: 0, y: 0, vx: 0, vy: 0, rot: 0, rs: 0, s: 0, a: 0, fromClick: true }
  }

  // ===== 渲染循环（与参考实现 animationLoops 一致） =====

  /**
   * 渲染主循环。
   * 参考实现始终驻留 rAF；此处无任何活跃粒子/拖尾时停帧并清屏，降低常驻开销。
   */
  private animationLoops = (now: number): void => {
    this.rafId = requestAnimationFrame(this.animationLoops)

    const hasWork = this.waves.length > 0 || this.sparks.length > 0 || this.trail.length > 0
    if (!hasWork) {
      this.lastFrameTime = now
      this.clearMain()
      return
    }

    // 帧率无关时间步进：换算为 60fps 基准的帧缩放，并限制最大步长
    const deltaMs = Math.min(now - this.lastFrameTime, ClickEffectService.MAX_DELTA_MS)
    this.lastFrameTime = now
    const baseScale = deltaMs / ClickEffectService.BASE_FRAME_MS
    const trailFrameScale = baseScale * this.trailSpeed
    const clickFrameScale = baseScale * this.clickSpeed

    // 加色混合：叠加而非覆盖，产生游戏光效的辉光感。
    // 直接在主画布上绘制——画布每帧清空为透明，加色计算只在画布内部生效，
    // 与页面背景的合成由浏览器按普通 alpha 混合完成，无需离屏缓冲中转。
    const ctx = this.mainCtx
    if (!ctx) {
      return
    }
    ctx.globalCompositeOperation = 'lighter'
    this.clearMain()
    this.updateTrail(trailFrameScale)
    this.updateWaves(clickFrameScale)
    this.updateSparks(clickFrameScale, trailFrameScale)
    ctx.globalCompositeOperation = 'source-over'
  }

  /** 清空画布（在设备像素坐标系下执行，覆盖全尺寸） */
  private clearMain(): void {
    if (this.mainCtx && this.mainCanvas) {
      this.mainCtx.clearRect(0, 0, this.mainCanvas.width, this.mainCanvas.height)
    }
  }

  /** 透明度钳制工具（参考实现 alpha()） */
  private alpha(value: number): number {
    return Math.max(0, Math.min(1, value * this.opacity))
  }

  /**
   * 更新并绘制拖尾光轨（参考实现 _updateTrail）。
   * 轨迹按"旧点→新点"方向绘制，亮度由位置决定：头部亮、尾部暗；
   * 单点情况（间距过小）退化为绘制一个圆点。
   */
  private updateTrail(frameScale: number): void {
    const ctx = this.mainCtx
    if (!ctx) {
      return
    }
    const n = this.trail.length

    // 亮度衰减：按住时慢（0.085/帧），松开后快（0.18/帧），并按位置加权
    const baseDecay = (this.isDown ? 0.085 : 0.18) * frameScale
    const maxStep = 0.42
    for (let i = n - 1; i >= 0; i--) {
      const t = this.trail[i]
      const span = Math.max(1, n - 1)
      const along = n > 1 ? i / span : 1
      const towardCursorBias = 1.25 - 0.55 * along
      let step = baseDecay * towardCursorBias
      if (step > maxStep) {
        step = maxStep
      }
      t.life -= step
      if (t.life <= 0) {
        this.trail.splice(i, 1)
      }
    }

    // 末尾补充当前指针位置，让光轨紧跟光标
    const head = this.lastPos
    const pts =
      head && this.trail.length > 0
        ? this.trail.concat([{ x: head.x, y: head.y, life: 1 }])
        : this.trail.slice()
    if (pts.length < 2) {
      return
    }

    // 单点情况：间距过小绘制一个跟随光标的圆点
    const gap = Math.hypot(
      pts[pts.length - 1].x - pts[pts.length - 2].x,
      pts[pts.length - 1].y - pts[pts.length - 2].y
    )
    if (gap < 0.75 && this.trail.length === 1) {
      const fade = Math.max(0, this.trail[0].life)
      ctx.shadowColor = 'transparent'
      ctx.beginPath()
      ctx.arc(pts[0].x, pts[0].y, 2.5 + 2 * fade, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${this.colorCss},${this.alpha(fade * 0.85)})`
      ctx.fill()
      return
    }

    // 光轨：线宽 5，带阴影辉光，逐段渐变透明度（头亮尾暗）
    ctx.lineWidth = 5.0
    ctx.shadowColor = `rgba(${this.colorCss}, 0.6)`
    ctx.shadowBlur = 3
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0

    const lastIdx = pts.length - 1
    for (let i = 0; i < lastIdx; i++) {
      const a0 = pts[i]
      const a1 = pts[i + 1]
      const alphaStart = i / lastIdx
      const alphaEnd = (i + 1) / lastIdx

      const segGrad = ctx.createLinearGradient(a0.x, a0.y, a1.x, a1.y)
      segGrad.addColorStop(0, `rgba(${this.colorCss}, ${this.alpha(alphaStart)})`)
      segGrad.addColorStop(1, `rgba(${this.colorCss}, ${this.alpha(alphaEnd)})`)

      ctx.beginPath()
      ctx.moveTo(a0.x, a0.y)
      ctx.lineTo(a1.x, a1.y)
      ctx.strokeStyle = segGrad
      ctx.stroke()
    }

    ctx.shadowColor = 'transparent'
  }

  /**
   * 更新并绘制波纹：中心填充光盘 + 2 段溶解圆弧（参考实现 _updateWaves）。
   * 圆弧半径由填充光盘半径 + 段倍率决定（紧凑贴合点击点），
   * 弧长按生命周期先增长、保持、再收缩（溶解），颜色从白色渐变到主题色。
   * 颜色、透明度、线宽倍率在单帧内与弧段位置无关，提前计算一次复用，
   * 避免每个子线段重复插值与拼接颜色字符串。
   */
  private updateWaves(clickFrameScale: number): void {
    const ctx = this.mainCtx
    if (!ctx) {
      return
    }
    const filled = ClickEffectService.FILLED_CIRCLE_CFG
    const rings = ClickEffectService.RINGS_ANIM_CFG
    const scale = this.scale
    const startColor = this.ringsStartColor
    const endColor = this.ringsEndColor

    // 逐波纹更新，倒序遍历便于移除回收
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i]
      w.life += clickFrameScale
      const waveProg = Math.min(w.life / filled.maxLife, 1)
      const ringProg = Math.min(w.life / rings.maxLife, 1)

      // ---- 中心填充光盘：半径三次缓动扩张，透明度线性衰减 ----
      const ease = 1 - Math.pow(1 - waveProg, 3)
      w.r = filled.rAddRate * scale * ease
      const diskAlpha = Math.max(0, 1 - waveProg)
      if (diskAlpha > 0) {
        ctx.beginPath()
        ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${this.colorCss},${this.alpha(diskAlpha)})`
        ctx.fill()
      }

      // ---- 溶解圆弧：2 段弧随时间旋转，弧长先增长后溶解 ----
      // 颜色插值：白色 → 浅主题色（ringsEndColor 已混入 2/3 白色）
      const t = Math.min(1.2 * ringProg, 1)
      const rr = Math.round(startColor[0] * (1 - t) + endColor[0] * t)
      const gg = Math.round(startColor[1] * (1 - t) + endColor[1] * t)
      const bb = Math.round(startColor[2] * (1 - t) + endColor[2] * t)
      const alphaRing = Math.min(1.1 - 0.3 * ringProg, 1)
      // 单帧内所有弧段颜色一致，只拼接一次颜色字符串供各子线段复用
      const strokeStyle = `rgba(${rr},${gg},${bb},${alphaRing})`
      // 弧宽随生命周期略收窄
      const lineWidthMul = Math.min(-0.8 * (ringProg - 0.8) + 1, 1)

      const ring = w.ring
      ring.ang -= ring.rs * clickFrameScale

      for (let s = 0; s < 2; s++) {
        const seg = ring.segs[s]
        const base = ring.ang + seg.off

        // 弧长相位：前 10% 增长、中段保持完整、后 60% 收缩至消失
        let start: number
        let end: number
        let len: number
        if (ringProg <= rings.lenStopAddPoint) {
          len = seg.len * (ringProg / rings.lenStopAddPoint)
          end = base + seg.len
          start = end - len
        } else if (ringProg > rings.lenStartDimPoint) {
          len = seg.len * (1 - (ringProg - rings.lenStartDimPoint) / (1 - rings.lenStartDimPoint))
          start = base
          end = start + len
        } else {
          len = seg.len
          start = base
          end = start + len
        }
        if (len <= 0) {
          continue
        }

        const radius = w.r + seg.rRoundRate * scale

        // 将弧切分为多段描线，用分段权重模拟环带由粗到细的过渡
        for (let k = 0; k < rings.segNum; k++) {
          const t0 = k / rings.segNum
          const t1 = (k + 1) / rings.segNum
          const a0 = start + (end - start) * t0
          const a1 = start + (end - start) * t1
          if (Math.abs(a1 - a0) < 0.01) {
            continue
          }
          const wT = Math.min(2 - Math.abs(4 * (t0 - 0.5)), 1)
          ctx.beginPath()
          ctx.arc(w.x, w.y, radius, a0, a1)
          ctx.lineWidth = (rings.minW * (1 - wT) + rings.maxW * wT) * lineWidthMul
          ctx.strokeStyle = strokeStyle
          ctx.stroke()
        }
      }

      // 波纹寿命结束，回收进对象池
      if (ringProg >= 1 && waveProg >= 1) {
        this.waves.splice(i, 1)
        this.wavePool.push(w)
      }
    }
  }

  /**
   * 更新并绘制星点碎片：旋转的白色三角形，速度按摩擦系数衰减（参考实现 _updateSparks）。
   * @param clickFrameScale 点击碎片时间缩放
   * @param trailFrameScale 拖尾碎片时间缩放
   */
  private updateSparks(clickFrameScale: number, trailFrameScale: number): void {
    const ctx = this.mainCtx
    if (!ctx) {
      return
    }
    // 所有点击碎片的摩擦系数均为 0.9、拖尾碎片均为 0.95，
    // 每帧只计算两次速度衰减因子，避免每个粒子每帧各执行两次 Math.pow
    const clickFade = Math.pow(0.9, clickFrameScale)
    const trailFade = Math.pow(0.95, trailFrameScale)

    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i]
      const fs = s.fromClick ? clickFrameScale : trailFrameScale
      s.x += s.vx * fs
      s.y += s.vy * fs
      const fade = s.fromClick ? clickFade : trailFade
      s.vx *= fade
      s.vy *= fade
      s.rot += s.rs * fs
      s.a -= 0.032 * fs
      if (s.a <= 0) {
        this.sparks.splice(i, 1)
        this.sparkPool.push(s)
        continue
      }

      ctx.save()
      ctx.translate(s.x, s.y)
      ctx.rotate(s.rot)
      ctx.beginPath()
      ctx.moveTo(0, -s.s)
      ctx.lineTo(s.s * 0.6, s.s * 0.6)
      ctx.lineTo(-s.s * 0.6, s.s * 0.6)
      ctx.fillStyle = `rgba(255,255,255,${this.alpha(s.a)})`
      ctx.fill()
      ctx.restore()
    }
  }

  // ===== 画布与主题色 =====

  /**
   * 重建画布缓冲尺寸。
   * 主画布与离屏缓冲按 CSS 尺寸 × 设备像素比（限制上限）设置物理像素，
   * 离屏缓冲设置坐标变换使绘制坐标与 CSS 像素一致。
   */
  private resize(): void {
    if (!this.mainCanvas || !this.mainCtx) {
      return
    }

    this.readThemeColor()

    const dpr = Math.min(window.devicePixelRatio || 1, ClickEffectService.MAX_DPR)
    const w = Math.max(1, Math.floor(window.innerWidth * dpr))
    const h = Math.max(1, Math.floor(window.innerHeight * dpr))

    this.mainCanvas.width = w
    this.mainCanvas.height = h
    // 坐标变换使绘制坐标与 CSS 像素一致
    this.mainCtx.setTransform(dpr, 0, 0, dpr, 0, 0)

    this.clearMain()
  }

  /** 读取 CSS 变量 --theme-color 作为主题色，并推导环带起点/终点色 */
  private readThemeColor(): void {
    if (typeof document === 'undefined') {
      return
    }
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--theme-color').trim()
    const parsed = ClickEffectService.parseColor(raw)
    if (parsed) {
      // 按减淡系数向白色混入，提升明度、保持色相
      const lighten = ClickEffectService.COLOR_LIGHTEN
      this.colorRgb = [
        Math.round(parsed[0] + (255 - parsed[0]) * lighten),
        Math.round(parsed[1] + (255 - parsed[1]) * lighten),
        Math.round(parsed[2] + (255 - parsed[2]) * lighten)
      ]
      // 预生成逗号分隔字符串，供每帧拼接 rgba 时复用，避免反复 join
      this.colorCss = this.colorRgb.join(',')
    }
    // 环带终点色 = (主题色 + 白色×2) / 3，与参考实现 ringsEndColorFromRgb 一致
    this.ringsEndColor = this.colorRgb.map((n) => (n + 255 * 2) / 3) as [number, number, number]
  }

  /** 解析主题色字符串，支持 rgb() 与十六进制写法，解析失败返回 null */
  private static parseColor(raw: string): [number, number, number] | null {
    const s = raw.trim()
    if (!s) {
      return null
    }
    const rgb = s.match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/)
    if (rgb) {
      return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])]
    }
    const hex = s.startsWith('#') ? s.slice(1) : s
    if (/^[0-9a-fA-F]{6}$/.test(hex)) {
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16)
      ]
    }
    return null
  }
}
