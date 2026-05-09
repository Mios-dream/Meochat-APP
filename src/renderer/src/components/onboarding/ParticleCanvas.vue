<template>
  <canvas ref="canvasRef" class="particle-canvas" />
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import sakuraImgUrl from '../../assets/images/sakura.webp'

const props = withDefaults(
  defineProps<{
    mode: 'logstream' | 'sakura' | 'contract' | 'idle' | 'hidden'
    density?: number
  }>(),
  { mode: 'idle', density: 1.0 }
)

interface Particle {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  text: string
  color: string
  alpha: number
  targetAlpha: number
  size: number
  life: number
  maxLife: number
  rotation: number
  rotationSpeed: number
  type: 'log' | 'sakura' | 'sparkle'
}

const canvasRef = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null
let animationId = 0
let lastTime = 0
let width = 0
let height = 0
let dpr = 1

const sakuraImage = new Image()
sakuraImage.src = sakuraImgUrl

const particles: Particle[] = []
const MAX_PARTICLES = 220

const LOG_COLORS_PINK = ['#f8bbd0', '#f48fb1', '#f06292', '#ec407a', '#fca5b9', '#ffcdd2', '#ef9a9a', '#fb7299']
const SAKURA_COLORS = ['#f8bbd0', '#f48fb1', '#f06292', '#ec407a', '#e91e63', '#fce4ec', '#ffcdd2', '#ef9a9a', '#fb7299', '#ffc0d6']
const SPARKLE_COLORS = ['#ffffff', '#fff9c4', '#ffecb3', '#ffe0b2', '#ffccbc', '#fff0f5']

const NARRATIVE_LINES = [
  '正在加载温暖的心跳...',
  '人格核心 v3.7.1 初始化中...',
  '搭建情感网络连接...',
  '同步心跳频率...',
  '校准温柔传感器...',
  '唤醒沉睡的回忆碎片...',
  '连接命运之线...',
  '樱花协议加载中...',
  '编译共情模块...',
  '启动自我意识...',
  '解析情感数据...',
  '连接到 MoeChat 网络...',
  '温暖的感情核心预热中...',
  '触摸响应初始化...',
  '语音模块准备完成...',
  '视觉追踪已校准...',
  '后台服务启动完成...',
  '心跳信号已建立...',
  '回忆碎片加载中 (3/7)...',
  '人格核心：已上线',
  '等待初次接触...',
  '命运之线：已连接',
  '情感网络：同步完成',
  '樱花协议：已激活',
]

function initCanvas(): void {
  const canvas = canvasRef.value
  if (!canvas) return
  ctx = canvas.getContext('2d')!
  resizeCanvas()
}

function resizeCanvas(): void {
  const canvas = canvasRef.value
  if (!canvas) return
  dpr = window.devicePixelRatio || 1
  width = window.innerWidth
  height = window.innerHeight
  canvas.width = width * dpr
  canvas.height = height * dpr
  canvas.style.width = width + 'px'
  canvas.style.height = height + 'px'
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
}

function createParticle(overrides: Partial<Particle> = {}): Particle {
  const z = overrides.z ?? Math.random()
  const depthScale = 0.4 + z * 0.6
  return {
    x: overrides.x ?? Math.random() * width,
    y: overrides.y ?? height + 20,
    z,
    vx: overrides.vx ?? (Math.random() - 0.5) * 0.25,
    vy: overrides.vy ?? -(0.15 + z * 0.35) * depthScale * 20,
    text: overrides.text ?? NARRATIVE_LINES[Math.floor(Math.random() * NARRATIVE_LINES.length)],
    color: overrides.color ?? LOG_COLORS_PINK[Math.floor(Math.random() * LOG_COLORS_PINK.length)],
    alpha: 0,
    targetAlpha: overrides.targetAlpha ?? 0.12 + z * 0.28,
    size: overrides.size ?? 9 + z * 7,
    life: 0,
    maxLife: overrides.maxLife ?? 10 + z * 12,
    rotation: overrides.rotation ?? Math.random() * Math.PI * 2,
    rotationSpeed: overrides.rotationSpeed ?? (Math.random() - 0.5) * 0.15,
    type: overrides.type ?? 'log'
  }
}

function spawnLogParticle(): void {
  if (particles.length >= MAX_PARTICLES) return
  const z = Math.random()
  particles.push(
    createParticle({
      z,
      y: height + Math.random() * 40,
      vy: -(0.1 + z * 0.25) * 18,
      size: 8 + z * 8,
      targetAlpha: 0.06 + z * 0.24,
      maxLife: 12 + z * 14,
      type: 'log'
    })
  )
}

function spawnSakuraParticle(): void {
  if (particles.length >= MAX_PARTICLES) return
  const z = Math.random()
  const fromLeft = Math.random() > 0.5
  particles.push(
    createParticle({
      z,
      x: fromLeft ? -30 : width + 30,
      y: Math.random() * height * 0.8,
      vx: (fromLeft ? 1 : -1) * (0.15 + z * 0.35) * 10,
      vy: (Math.random() - 0.5) * 8 + z * 4,
      color: SAKURA_COLORS[Math.floor(Math.random() * SAKURA_COLORS.length)],
      targetAlpha: 0.25 + z * 0.4,
      size: 6 + z * 14,
      maxLife: 12 + z * 14,
      rotationSpeed: (Math.random() - 0.5) * 0.5,
      type: 'sakura'
    })
  )
}

function spawnSparkleParticle(): void {
  if (particles.length >= MAX_PARTICLES) return
  const z = Math.random()
  particles.push(
    createParticle({
      z,
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 3,
      vy: -(Math.random() * 6 + 2),
      color: SPARKLE_COLORS[Math.floor(Math.random() * SPARKLE_COLORS.length)],
      targetAlpha: 0.5 + Math.random() * 0.35,
      size: 1.5 + Math.random() * 2.5,
      maxLife: 2 + Math.random() * 2.5,
      rotation: 0,
      rotationSpeed: 0,
      type: 'sparkle'
    })
  )
}

function getSpawnRate(): number {
  const base = props.density
  switch (props.mode) {
    case 'logstream':
      return 0.06 * base
    case 'sakura':
      return 0.1 * base
    case 'contract':
      return 0.15 * base
    case 'idle':
      return 0.03 * base
    default:
      return 0
  }
}

function drawSakuraPetal(p: Particle): void {
  if (!ctx || !sakuraImage.complete) return
  const size = p.size
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.rotate(p.rotation)
  ctx.globalAlpha = p.alpha
  ctx.drawImage(sakuraImage, -size, -size, size * 2, size * 2)
  ctx.restore()
}

function drawSparkle(p: Particle): void {
  if (!ctx) return
  ctx.save()
  ctx.globalAlpha = p.alpha
  ctx.fillStyle = p.color
  ctx.shadowColor = p.color
  ctx.shadowBlur = 6

  ctx.beginPath()
  ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}

function drawLogText(p: Particle): void {
  if (!ctx) return
  ctx.save()
  ctx.globalAlpha = p.alpha
  ctx.fillStyle = p.color
  ctx.font = `${p.size}px "Consolas", "Courier New", monospace`
  ctx.shadowColor = p.color
  ctx.shadowBlur = 3
  ctx.fillText(p.text, p.x, p.y)
  ctx.restore()
}

function updateParticles(dt: number): void {
  const cappedDt = Math.min(dt, 0.1)

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]
    p.life += cappedDt
    p.x += p.vx * cappedDt * 60
    p.y += p.vy * cappedDt * 60
    p.rotation += p.rotationSpeed * cappedDt

    const fadeIn = Math.min(p.life / 1.5, 1.0)
    const fadeOut = p.life > p.maxLife * 0.7 ? 1 - (p.life - p.maxLife * 0.7) / (p.maxLife * 0.3) : 1
    p.alpha = p.targetAlpha * fadeIn * Math.max(0, fadeOut)

    const isOutOfBounds =
      p.y < -80 ||
      p.y > height + 80 ||
      p.x < -200 ||
      p.x > width + 200 ||
      p.life > p.maxLife

    if (isOutOfBounds) {
      particles.splice(i, 1)
    }
  }
}

function spawnParticles(): void {
  const rate = getSpawnRate()
  if (Math.random() < rate) {
    switch (props.mode) {
      case 'logstream':
        spawnLogParticle()
        break
      case 'sakura':
      case 'idle':
        spawnSakuraParticle()
        break
      case 'contract':
        spawnSakuraParticle()
        if (Math.random() < 0.3) spawnSparkleParticle()
        break
    }
  }
}

function render(): void {
  if (!ctx) return
  ctx.clearRect(0, 0, width, height)

  // depth sort
  particles.sort((a, b) => a.z - b.z)

  for (const p of particles) {
    if (p.alpha <= 0.01) continue
    switch (p.type) {
      case 'log':
        drawLogText(p)
        break
      case 'sakura':
        drawSakuraPetal(p)
        break
      case 'sparkle':
        drawSparkle(p)
        break
    }
  }
}

function loop(time: number): void {
  const dt = (time - lastTime) / 1000
  lastTime = time

  if (props.mode !== 'hidden') {
    spawnParticles()
    updateParticles(dt)
    render()
  } else {
    particles.length = 0
    if (ctx) ctx.clearRect(0, 0, width, height)
  }

  animationId = requestAnimationFrame(loop)
}

function startLoop(): void {
  lastTime = performance.now()
  animationId = requestAnimationFrame(loop)
}

function stopLoop(): void {
  cancelAnimationFrame(animationId)
}

// morph existing log particles to sakura
function morphToSakura(): void {
  for (const p of particles) {
    if (p.type === 'log') {
      p.type = 'sakura'
      p.color = SAKURA_COLORS[Math.floor(Math.random() * SAKURA_COLORS.length)]
      p.vx += (Math.random() - 0.5) * 15
      p.vy += (Math.random() - 0.5) * 8
      p.rotationSpeed = (Math.random() - 0.5) * 0.5
      p.size = p.size * 0.7
      p.maxLife = p.maxLife * 1.3
      p.life = p.life * 0.5
    }
  }
}

function clearParticles(): void {
  for (const p of particles) {
    p.targetAlpha = 0
    p.maxLife = Math.min(p.maxLife, p.life + 1.5)
  }
}

defineExpose({ morphToSakura, clearParticles, resizeCanvas })

onMounted(() => {
  initCanvas()
  startLoop()
  window.addEventListener('resize', resizeCanvas)
})

onUnmounted(() => {
  stopLoop()
  window.removeEventListener('resize', resizeCanvas)
})
</script>

<style scoped>
.particle-canvas {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
}
</style>
