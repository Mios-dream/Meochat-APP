<template>
  <transition name="modal-fade">
    <div v-if="visible" class="modal-overlay" @click="handleClose">
      <canvas ref="sakuraCanvas" class="sakura-canvas" />

      <div class="book-scene" @click.stop>
        <div
          v-if="!showStatus"
          ref="bookContainer"
          class="book-container"
          :class="{
            'is-cover-spread': isCoverCentered,
            'is-cover-centered': isCoverCentered,
            'is-cover-opening': isCoverOpening
          }"
        >
          <div class="book-shadow" />

          <div
            v-if="phase === 'flipping' && direction === 'next' && underRight"
            class="book-page right under-layer"
            v-html="renderFace(underRight)"
          />
          <div
            v-if="phase === 'flipping' && direction === 'prev' && underLeft"
            class="book-page left under-layer"
            v-html="renderFace(underLeft)"
          />

          <div
            v-if="phase === 'flipping' && direction === 'next' && flipFromSpread > 0"
            class="book-page left static-page"
            v-html="renderFace(getLeftPage(flipFromSpread))"
          />
          <div
            v-if="phase === 'flipping' && direction === 'prev'"
            class="book-page right static-page"
            v-html="renderFace(getRightPage(flipFromSpread))"
          />

          <template v-if="phase === 'idle'">
            <div v-if="isCoverCentered" class="book-cover-only" @click="openFromCover">
              <div class="book-page cover" v-html="renderFace('cover')" />
            </div>
            <template v-else>
              <div v-if="displaySpread > 0" class="book-page left" v-html="renderFace(curLeft)" />
              <div class="book-page right" v-html="renderFace(curRight)" />
            </template>
          </template>

          <div
            v-if="!isCoverCentered && (displaySpread > 0 || phase === 'flipping')"
            class="book-spine"
          />

          <div
            v-if="phase === 'flipping' && direction"
            class="flipper"
            :class="direction"
            @animationend="finishFlip"
          >
            <div class="flipper-front" v-html="renderFace(flipFront)" />
            <div class="flipper-back" v-html="renderFace(flipBack)" />
          </div>

          <button
            v-if="canFlipPrev"
            class="page-corner prev-corner"
            type="button"
            aria-label="上一页"
            @click="flipPrev"
          />
          <button
            v-if="canFlipNext && !isCoverCentered"
            class="page-corner next-corner"
            type="button"
            aria-label="下一页"
            @click="flipNext"
          />
        </div>

        <!-- 加载/错误/空状态 -->
        <div v-if="showStatus" class="book-status">
          <span v-if="loading" class="status-icon">🌸</span>
          <p v-if="loading">正在翻开日记...</p>
          <p v-else-if="error">{{ error }}</p>
          <p v-else-if="records.length === 0">暂无日记记录</p>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { computed, ref, watch, onUnmounted, nextTick } from 'vue'

const coverAvatar = new URL('../assets/images/助手Q版.png', import.meta.url).href

type DiaryRecord = {
  day: string
  summary: string
  dayLastTimestamp: string
  dayLastTimestampSec: number
}

type DiaryPagination = {
  total: number
  count: number
  offset: number
  limit: number
}

const props = defineProps<{
  visible: boolean
  loading: boolean
  error: string
  records: DiaryRecord[]
  pagination: DiaryPagination
  formatTimestamp: (timestamp: string) => string
}>()

const emit = defineEmits<{ (e: 'close'): void }>()

// ==================== 翻书状态 ====================
type DiaryPage = {
  kind: 'entry'
  record: DiaryRecord
  text: string
  partIndex: number
  partTotal: number
}

type BookFace = DiaryPage | 'cover' | 'endpaper' | 'back' | null
type FlipDirection = 'next' | 'prev'

const showStatus = ref(true)
const phase = ref<'idle' | 'flipping'>('idle')
const direction = ref<FlipDirection | null>(null)
const displaySpread = ref(0)
const flipFromSpread = ref(0)
const flipToSpread = ref(0)
const pages = computed(() => buildPages(props.records))
const maxSpread = computed(() => Math.ceil(pages.value.length / 2))
const canFlipPrev = computed(() => phase.value === 'idle' && displaySpread.value > 0)
const canFlipNext = computed(() => phase.value === 'idle' && displaySpread.value < maxSpread.value)
const isCoverCentered = computed(() => phase.value === 'idle' && displaySpread.value === 0)
const isCoverOpening = ref(false)
const bookContainer = ref<HTMLDivElement | null>(null)
const curLeft = computed(() => getLeftPage(displaySpread.value))
const curRight = computed(() => getRightPage(displaySpread.value))
const flipFront = computed(() => {
  if (phase.value !== 'flipping' || !direction.value) return null
  return direction.value === 'next'
    ? getRightPage(flipFromSpread.value)
    : getLeftPage(flipFromSpread.value)
})
const flipBack = computed(() => {
  if (phase.value !== 'flipping' || !direction.value) return null
  return direction.value === 'next'
    ? getLeftPage(flipToSpread.value)
    : getRightPage(flipToSpread.value)
})
const underLeft = computed(() => {
  if (phase.value !== 'flipping' || direction.value !== 'prev') return null
  return getLeftPage(flipToSpread.value)
})
const underRight = computed(() => {
  if (phase.value !== 'flipping' || direction.value !== 'next') return null
  return getRightPage(flipToSpread.value)
})

// ==================== 构建页面 ====================
function buildPageHTML(page: DiaryPage): string {
  const entry = page.record
  const dateLabel = fmtDate(entry.day || entry.dayLastTimestamp)
  const timeLabel = props.formatTimestamp(entry.dayLastTimestamp)
  const tags = getTags(entry.summary).slice(0, 3)
  const tagsHTML = tags.map((t) => `<span class="pf-tag">#${t}</span>`).join('')
  const mood = tags[0] || '日记'
  const text = escapeHTML(page.text || '今天还没有写下内容。')
  const partLabel = page.partTotal > 1 ? `第 ${page.partIndex + 1}/${page.partTotal} 页` : ''
  const isContinued = page.partIndex > 0
  const headerHTML = isContinued
    ? `
      <div class="pf-continued-header">
        <span class="pf-continued-tag">续页</span>
      </div>`
    : `
      <h2 class="pf-title">日记</h2>
      <div class="pf-divider"><div class="pf-divider-line"></div><span class="pf-divider-dot">✦</span></div>
      <div class="pf-memory-card">
        <div class="pf-memory-glow"></div>
        <span class="pf-memory-icon">${getMoodIcon(mood)}</span>
      </div>`

  return `
    <div class="pf-page-inner${isContinued ? ' is-continued' : ''}">
      <div class="pf-meta">
        <span class="pf-date">${dateLabel}</span>
        <span class="pf-time"><span>🌸</span>${timeLabel}</span>
      </div>
      ${headerHTML}
      <div class="pf-body"><p class="pf-text">${text}</p></div>
      <div class="pf-footer">
        <div class="pf-mood"><span>心情</span><b>${getMoodIcon(mood)} ${mood}</b></div>
        <div class="pf-tags">${tagsHTML}</div>
      </div>
      ${partLabel ? `<div class="pf-part">${partLabel}</div>` : ''}
    </div>`
}

function resetBook(): void {
  showStatus.value = true
  phase.value = 'idle'
  direction.value = null
  displaySpread.value = 0
  flipFromSpread.value = 0
  flipToSpread.value = 0
  isCoverOpening.value = false
}

// ==================== 翻页控制 ====================
function flipNext(): void {
  if (!canFlipNext.value) return

  phase.value = 'flipping'
  direction.value = 'next'
  flipFromSpread.value = displaySpread.value
  flipToSpread.value = displaySpread.value + 1
}

function flipPrev(): void {
  if (!canFlipPrev.value) return

  phase.value = 'flipping'
  direction.value = 'prev'
  flipFromSpread.value = displaySpread.value
  flipToSpread.value = displaySpread.value - 1
}

function finishFlip(event?: AnimationEvent): void {
  if (event && event.animationName === 'diaryFlipShadow') return
  displaySpread.value = flipToSpread.value
  phase.value = 'idle'
  direction.value = null
  isCoverOpening.value = false
}

function getLeftPage(spread: number): BookFace {
  if (spread <= 0) return null
  return pages.value[(spread - 1) * 2] || null
}

function getRightPage(spread: number): BookFace {
  if (spread <= 0) return 'cover'
  return pages.value[(spread - 1) * 2 + 1] || null
}

function renderFace(face: BookFace): string {
  if (face === 'cover') return buildCoverHTML()
  if (face === 'endpaper') return buildEndpaperHTML()
  if (face === 'back') return buildBackCoverHTML()
  if (!face) return ''
  return buildPageHTML(face)
}

function buildCoverHTML(): string {
  return `
    <div class="pf-cover-front">
      <div class="pf-cover-card">
        <i class="pf-cover-corner tl"></i>
        <i class="pf-cover-corner tr"></i>
        <i class="pf-cover-corner bl"></i>
        <i class="pf-cover-corner br"></i>
        <div class="pf-cover-portrait">
          <span class="pf-cover-ear left"></span>
          <span class="pf-cover-ear right"></span>
          <img class="pf-cover-avatar" src="${coverAvatar}" alt="助手Q版头像" />
        </div>
        <h1 class="pf-cover-title">治愈日记</h1>
        <div class="pf-cover-sub">Healing Diary</div>
        <div class="pf-cover-date">✿ 今日的心情 ✿</div>
        <div class="pf-cover-divider"></div>
        <p class="pf-cover-quote">“愿你在这里，收集到每一次小小的幸福。”</p>
      </div>
    </div>`
}

function buildEndpaperHTML(): string {
  return `
    <div class="pf-endpaper">
      <div class="pf-endpaper-pattern"></div>
      <div class="pf-endpaper-inner">
        <span class="pf-endpaper-icon">🌸</span>
        <p class="pf-endpaper-text">愿所有心事，都被温柔收藏</p>
      </div>
    </div>`
}

function buildBackCoverHTML(): string {
  return `
    <div class="pf-cover-back">
      <div class="pf-back-inner">
        <div class="pf-back-pattern"></div>
        <div class="pf-back-content">
          <span class="pf-back-icon">🌙</span>
          <p class="pf-back-text">故事还在继续</p>
          <p class="pf-back-text">下一页，明天见</p>
        </div>
      </div>
    </div>`
}

// ==================== 工具 ====================
function fmtDate(dateStr: string): string {
  if (!dateStr) return '----'
  const d = new Date(dateStr.replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return dateStr
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function escapeHTML(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function splitSummary(summary: string): string[] {
  const trimmed = summary?.trim() || ''
  if (!trimmed) return ['今天还没有写下内容。']
  const { first, continued } = getPageCharLimits()
  const pagesList: string[] = []
  let buffer = ''
  let limit = first

  const pushBuffer = (): void => {
    if (buffer) pagesList.push(buffer.trim())
    buffer = ''
    limit = continued
  }

  const appendChunk = (chunk: string): void => {
    const next = buffer ? `${buffer}\n${chunk}` : chunk
    if (Array.from(next).length > limit) {
      if (buffer) pushBuffer()
      if (Array.from(chunk).length > limit) {
        const chars = Array.from(chunk)
        for (let i = 0; i < chars.length; i += limit) {
          pagesList.push(
            chars
              .slice(i, i + limit)
              .join('')
              .trim()
          )
        }
        buffer = ''
        limit = continued
      } else {
        buffer = chunk
      }
      return
    }
    buffer = next
  }

  trimmed
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .forEach((line) => appendChunk(line))

  if (buffer) pagesList.push(buffer.trim())
  return pagesList.length > 0 ? pagesList : ['今天还没有写下内容。']
}

// 根据屏幕宽度动态调整每页字符限制，保持适当的分页效果
function getPageCharLimits(): { first: number; continued: number } {
  if (typeof window === 'undefined') return { first: 220, continued: 320 }
  const base = Math.max(200, Math.min(360, Math.floor(window.innerWidth / 3)))
  return {
    first: Math.floor(base * 0.56),
    continued: base
  }
}

function buildPages(records: DiaryRecord[]): BookFace[] {
  const pagesList: BookFace[] = []
  records.forEach((record) => {
    const parts = splitSummary(record.summary)
    parts.forEach((text, index) => {
      pagesList.push({
        kind: 'entry',
        record,
        text,
        partIndex: index,
        partTotal: parts.length
      })
    })
  })

  if (pagesList.length % 2 === 0) pagesList.push('endpaper')
  pagesList.push('back')
  return pagesList
}

function getMoodIcon(mood: string): string {
  const icons: Record<string, string> = {
    开心: '😊',
    难过: '💧',
    期待: '✦',
    约定: '🤍',
    晚安: '🌙',
    陪伴: '🌸',
    温馨: '💕',
    想念: '💌',
    喜欢: '💗',
    雨天: '☔',
    音乐: '🎵',
    梦境: '✨',
    樱花: '🌸',
    第一次: '✨',
    惊喜: '🎀',
    聊天: '💬',
    深夜: '🌙',
    日记: '🌸'
  }
  return icons[mood] || '🌸'
}

function getTags(summary: string): string[] {
  if (!summary) return ['日记']
  const tags: string[] = []
  const map: Record<string, string> = {
    开心: '开心',
    难过: '难过',
    期待: '期待',
    约定: '约定',
    晚安: '晚安',
    陪伴: '陪伴',
    温馨: '温馨',
    想念: '想念',
    喜欢: '喜欢',
    雨: '雨天',
    歌: '音乐',
    梦: '梦境',
    樱花: '樱花',
    第一次: '第一次',
    惊喜: '惊喜',
    聊天: '聊天',
    电话: '深夜'
  }
  for (const [k, v] of Object.entries(map)) {
    if (summary.includes(k) && !tags.includes(v)) tags.push(v)
  }
  return tags.length > 0 ? tags : ['日记']
}

// ==================== 键盘 ====================
function handleKey(e: KeyboardEvent): void {
  if (!props.visible) return
  if (e.key === 'ArrowRight') openFromCover()
  else if (e.key === 'ArrowLeft') flipPrev()
  else if (e.key === 'Escape') handleClose()
}

// ==================== 樱花 ====================
const sakuraCanvas = ref<HTMLCanvasElement | null>(null)
let sAnimId = 0
let sParts: Array<{
  x: number
  y: number
  size: number
  sy: number
  sx: number
  r: number
  rs: number
  o: number
  wf: number
  wa: number
  wp: number
}> = []
let sW = 0,
  sH = 0

function initSakura(): void {
  const c = sakuraCanvas.value
  if (!c) return
  const ctx = c.getContext('2d')
  if (!ctx) return
  const rez = (): void => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    sW = window.innerWidth
    sH = window.innerHeight
    c.width = sW * dpr
    c.height = sH * dpr
    c.style.width = sW + 'px'
    c.style.height = sH + 'px'
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  rez()

  sParts = Array.from({ length: 35 }, () => ({
    x: Math.random() * sW,
    y: Math.random() * sH,
    size: Math.random() * 4 + 3,
    sy: Math.random() * 0.8 + 0.3,
    sx: Math.random() * 0.6 - 0.3,
    r: Math.random() * 360,
    rs: Math.random() * 1.5 - 0.75,
    o: Math.random() * 0.22 + 0.1,
    wf: Math.random() * 0.01 + 0.005,
    wa: Math.random() * 0.5 + 0.3,
    wp: Math.random() * Math.PI * 2
  }))

  const anim = (): void => {
    if (!c.isConnected) return
    ctx.clearRect(0, 0, sW, sH)
    sParts.forEach((p) => {
      p.y += p.sy
      p.x += p.sx + Math.sin(p.y * p.wf + p.wp) * p.wa
      p.r += p.rs
      if (p.y > sH + 20) p.y = -20
      if (p.x < -20) p.x = sW + 20
      if (p.x > sW + 20) p.x = -20
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate((p.r * Math.PI) / 180)
      ctx.globalAlpha = p.o
      ctx.fillStyle = '#f7c7d9'
      for (let i = 0; i < 5; i++) {
        ctx.beginPath()
        ctx.ellipse(0, -p.size * 0.5, p.size * 0.25, p.size * 0.55, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.rotate((Math.PI * 2) / 5)
      }
      ctx.beginPath()
      ctx.arc(0, 0, p.size * 0.15, 0, Math.PI * 2)
      ctx.fillStyle = '#ffe4ed'
      ctx.fill()
      ctx.restore()
    })
    sAnimId = requestAnimationFrame(anim)
  }
  anim()
}

function destroySakura(): void {
  if (sAnimId) {
    cancelAnimationFrame(sAnimId)
    sAnimId = 0
  }
  sParts = []
}

async function tryInit(): Promise<void> {
  if (!props.visible || props.loading || props.records.length === 0) return
  await nextTick()
  showStatus.value = false
}

// ==================== 生命周期 ====================
watch(
  () => props.visible,
  async (v) => {
    if (v) {
      nextTick(() => initSakura())
      await tryInit()
    } else {
      destroySakura()
      resetBook()
    }
  }
)

watch(
  () => props.loading,
  async () => {
    await tryInit()
  }
)

watch(
  () => props.records,
  async (records) => {
    if (!props.visible) return
    if (records.length === 0) {
      resetBook()
      return
    }
    displaySpread.value = Math.min(displaySpread.value, maxSpread.value)
    await tryInit()
  }
)

// 键盘事件
watch(
  () => props.visible,
  (v) => {
    if (v) {
      document.addEventListener('keydown', handleKey)
    } else {
      document.removeEventListener('keydown', handleKey)
    }
  }
)

onUnmounted(() => {
  destroySakura()
  resetBook()
  document.removeEventListener('keydown', handleKey)
})

function handleClose(): void {
  emit('close')
}

async function waitForCoverShift(): Promise<void> {
  return new Promise((resolve) => {
    const el = bookContainer.value
    if (!el) {
      resolve()
      return
    }
    let done = false
    const finish = (): void => {
      if (done) return
      done = true
      el.removeEventListener('transitionend', onEnd)
      resolve()
    }
    const onEnd = (event: TransitionEvent): void => {
      if (event.propertyName === 'transform') finish()
    }
    el.addEventListener('transitionend', onEnd)
    window.setTimeout(finish, 360)
  })
}

async function openFromCover(): Promise<void> {
  if (isCoverCentered.value) {
    if (isCoverOpening.value) return
    isCoverOpening.value = true
    await nextTick()
    await waitForCoverShift()
    flipNext()
    return
  }
  flipNext()
}
</script>

<style scoped>
/* ==================== 遮罩 (贴合主题) ==================== */
.modal-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  overflow: hidden;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

/* ==================== 樱花 ==================== */
.sakura-canvas {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 2;
}

/* ==================== 场景 ==================== */
.book-scene {
  position: relative;
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: min(960px, 94vw);
  perspective: 2000px;
  user-select: none;
}

/* ==================== 书本容器 (参考页自绘翻页逻辑) ==================== */
.book-container {
  position: relative;
  width: min(920px, 90vw);
  height: min(620px, calc(90vw / 1.45), calc(100vh - 170px));
  min-height: 360px;
  overflow: visible;
  transform-style: preserve-3d;
  transition: transform 0.4s ease;
}

.book-container.is-cover-centered {
  transform: translateX(-25%);
}

.book-container.is-cover-opening {
  transform: translateX(0);
}

.book-shadow {
  position: absolute;
  inset: -15px -20px;
  z-index: -1;
  border-radius: 16px;
  background: rgba(90, 74, 90, 0.06);
  filter: blur(25px);
}

.book-page {
  position: absolute;
  top: 0;
  width: 50%;
  height: 100%;
  overflow: hidden;
  background: #fffdfd;
  transform-style: preserve-3d;
  box-shadow:
    inset 0 0 40px rgba(0, 0, 0, 0.02),
    0 4px 20px rgba(0, 0, 0, 0.04);
}

.book-page.left {
  left: 0;
  border-right: 1px solid rgba(0, 0, 0, 0.04);
  border-radius: 10px 0 0 10px;
  transform-origin: right center;
}

.book-page.right {
  right: 0;
  border-left: 1px solid rgba(0, 0, 0, 0.04);
  border-radius: 0 10px 10px 0;
  transform-origin: left center;
}

.book-page.cover {
  width: 50%;
  border-radius: 12px;
  box-shadow:
    inset 0 0 40px rgba(0, 0, 0, 0.03),
    0 12px 32px rgba(0, 0, 0, 0.08);
}

.book-cover-only {
  position: absolute;
  inset: 0;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  cursor: pointer;
}

.book-cover-only .book-page {
  position: relative;
  width: 50%;
  height: 100%;
}

.static-page {
  z-index: 3;
}

.under-layer {
  z-index: 1;
}

.book-spine {
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  z-index: 10;
  width: 3px;
  transform: translateX(-50%);
  background: linear-gradient(
    to bottom,
    transparent 0%,
    rgba(0, 0, 0, 0.06) 20%,
    rgba(0, 0, 0, 0.08) 50%,
    rgba(0, 0, 0, 0.06) 80%,
    transparent 100%
  );
  pointer-events: none;
}

.flipper {
  position: absolute;
  z-index: 50;
  width: 50%;
  height: 100%;
  transform-style: preserve-3d;
}

.flipper.next {
  right: 0;
  transform-origin: left center;
  animation: diaryFlipNext 0.85s cubic-bezier(0.645, 0.045, 0.355, 1) forwards;
}

.flipper.prev {
  left: 0;
  transform-origin: right center;
  animation: diaryFlipPrev 0.85s cubic-bezier(0.645, 0.045, 0.355, 1) forwards;
}

@keyframes diaryFlipNext {
  from {
    transform: rotateY(0deg);
  }
  to {
    transform: rotateY(-180deg);
  }
}

@keyframes diaryFlipPrev {
  from {
    transform: rotateY(0deg);
  }
  to {
    transform: rotateY(180deg);
  }
}

.flipper-front,
.flipper-back {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #fffdfd;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  transform-style: preserve-3d;
}

.flipper.next .flipper-front,
.flipper.next .flipper-back {
  border-radius: 0 10px 10px 0;
}

.flipper.prev .flipper-front,
.flipper.prev .flipper-back {
  border-radius: 10px 0 0 10px;
}

.flipper-back {
  transform: rotateY(180deg);
}

.flipper.next::after,
.flipper.prev::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
  animation: diaryFlipShadow 0.85s ease forwards;
}

.flipper.next::after {
  background: linear-gradient(to left, rgba(0, 0, 0, 0.18), transparent 50%);
}

.flipper.prev::after {
  background: linear-gradient(to right, rgba(0, 0, 0, 0.18), transparent 50%);
}

@keyframes diaryFlipShadow {
  0% {
    opacity: 0;
  }
  30% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}

.page-corner {
  position: absolute;
  bottom: 0;
  z-index: 60;
  width: 70px;
  height: 70px;
  padding: 0;
  border: 0;
  cursor: pointer;
  transition: all 0.25s ease;
}

.next-corner {
  right: 0;
  border-radius: 0 0 10px 0;
  background:
    linear-gradient(315deg, transparent 50%, rgba(247, 199, 217, 0.5) 50%),
    linear-gradient(135deg, transparent 50%, rgba(247, 199, 217, 0.18) 50%);
}

.prev-corner {
  left: 0;
  border-radius: 0 0 0 10px;
  background:
    linear-gradient(45deg, transparent 50%, rgba(247, 199, 217, 0.5) 50%),
    linear-gradient(225deg, transparent 50%, rgba(247, 199, 217, 0.18) 50%);
}

.page-corner:hover {
  width: 92px;
  height: 92px;
}

/* ==================== 内页样式 (v-html 内容需全局选择器) ==================== */
:global(.pf-cover-front) {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #fff0f5 0%, #ffe4e1 50%, #fff5f7 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  border-right: 4px solid rgba(212, 174, 198, 0.8);
  box-shadow: inset -18px 0 28px -18px rgba(0, 0, 0, 0.18);
}

.book-container.is-cover-spread :global(.pf-cover-front) {
  border-radius: 10px;
  box-shadow:
    inset -18px 0 28px -18px rgba(0, 0, 0, 0.18),
    0 20px 60px rgba(247, 199, 217, 0.25),
    0 8px 16px rgba(0, 0, 0, 0.04);
}

.book-cover-only :global(.pf-cover-front) {
  border-right: 0;
  border-radius: 12px;
  box-shadow:
    inset 0 0 28px rgba(0, 0, 0, 0.12),
    0 24px 60px rgba(247, 199, 217, 0.3);
}

:global(.pf-cover-card) {
  position: relative;
  z-index: 2;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  border-radius: 26px;
  padding: 38px 40px;
  width: min(360px, 82%);
  text-align: center;
  box-shadow:
    0 18px 40px rgba(214, 150, 173, 0.2),
    0 0 80px rgba(255, 182, 193, 0.12) inset;
}

:global(.pf-cover-corner) {
  position: absolute;
  width: 34px;
  height: 34px;
  border: 2px solid rgba(255, 182, 193, 0.5);
  pointer-events: none;
}

:global(.pf-cover-corner.tl) {
  top: 18px;
  left: 18px;
  border-right: none;
  border-bottom: none;
  border-radius: 10px 0 0 0;
}

:global(.pf-cover-corner.tr) {
  top: 18px;
  right: 18px;
  border-left: none;
  border-bottom: none;
  border-radius: 0 10px 0 0;
}

:global(.pf-cover-corner.bl) {
  bottom: 18px;
  left: 18px;
  border-right: none;
  border-top: none;
  border-radius: 0 0 0 10px;
}

:global(.pf-cover-corner.br) {
  bottom: 18px;
  right: 18px;
  border-left: none;
  border-top: none;
  border-radius: 0 0 10px 0;
}

:global(.pf-cover-portrait) {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 18px;
}

:global(.pf-cover-ear) {
  position: absolute;
  width: 30px;
  height: 62px;
  background: linear-gradient(to bottom, #ffd1dc, #ffb6c1);
  border-radius: 50% 50% 50% 50%;
  top: -18px;
  opacity: 0.8;
}

:global(.pf-cover-ear.left) {
  left: 18px;
  transform: rotate(-15deg);
}

:global(.pf-cover-ear.right) {
  right: 18px;
  transform: rotate(15deg);
}

:global(.pf-cover-avatar) {
  width: 140px;
  height: 140px;
  border-radius: 50%;
  background: linear-gradient(135deg, #fff0f5, #ffe4e1);
  border: 4px solid rgba(255, 182, 193, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  object-fit: cover;
  background-color: #fff0f5;
  box-shadow: 0 0 0 8px rgba(255, 240, 245, 0.5);
}

:global(.pf-cover-title) {
  font-family: 'LoliFont', serif;
  font-size: 1.9rem;
  color: #d4869c;
  margin: 0 0 8px;
  letter-spacing: 4px;
  text-shadow: 2px 2px 4px rgba(212, 134, 156, 0.15);
}

:global(.pf-cover-sub) {
  font-size: 13px;
  color: #e8a4b8;
  letter-spacing: 3px;
  margin-bottom: 18px;
}

:global(.pf-cover-date) {
  display: inline-block;
  background: linear-gradient(135deg, #fff0f5, #ffe4e1);
  padding: 8px 20px;
  border-radius: 18px;
  color: #c97b93;
  font-size: 12px;
  letter-spacing: 1px;
  border: 1px solid rgba(255, 182, 193, 0.3);
  box-shadow: 0 4px 14px rgba(255, 182, 193, 0.14);
  margin-bottom: 18px;
}

:global(.pf-cover-divider) {
  width: 60%;
  height: 1px;
  background: linear-gradient(to right, transparent, #ffd1dc, transparent);
  margin: 0 auto 16px;
}

:global(.pf-cover-quote) {
  color: #d49aaa;
  font-size: 12px;
  line-height: 1.8;
  font-style: italic;
  margin: 0 0 18px;
}

:global(.pf-cover-footer) {
  display: flex;
  justify-content: center;
  gap: 12px;
  font-size: 18px;
  opacity: 0.7;
}

/* 封面背页 */
:global(.pf-cover-back) {
  width: 100%;
  height: 100%;
}

:global(.pf-endpaper) {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #fff5fb, #f7e8f2 50%, #fdeaf3);
  position: relative;
  overflow: hidden;
}

:global(.pf-endpaper-pattern) {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.55) 0%, transparent 50%),
    radial-gradient(circle at 80% 70%, rgba(255, 255, 255, 0.35) 0%, transparent 45%);
  pointer-events: none;
}

:global(.pf-endpaper-inner) {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: #b190a0;
  letter-spacing: 3px;
}

:global(.pf-endpaper-icon) {
  font-size: 2.6rem;
  margin-bottom: 14px;
}

:global(.pf-endpaper-text) {
  margin: 0;
  font-family: 'LoliFont', serif;
  font-size: 1.1rem;
}

:global(.pf-back-inner) {
  width: 100%;
  height: 100%;
  background: linear-gradient(150deg, #f2d4e4, #e2c4d8);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  border-left: 4px solid #d4b0c4;
  box-shadow: inset 18px 0 28px -18px rgba(0, 0, 0, 0.18);
}

:global(.pf-back-pattern) {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 30% 25%, rgba(255, 255, 255, 0.2) 0%, transparent 50%),
    radial-gradient(circle at 70% 70%, rgba(255, 255, 255, 0.15) 0%, transparent 50%);
  pointer-events: none;
}

:global(.pf-back-content) {
  text-align: center;
  position: relative;
}

:global(.pf-back-icon) {
  font-size: 2.5rem;
  display: block;
  margin-bottom: 12px;
}

:global(.pf-back-text) {
  font-family: 'LoliFont', serif;
  font-size: 1.1rem;
  color: #8b6a7c;
  line-height: 1.8;
  margin: 0;
  letter-spacing: 3px;
}

/* 日记内页 */
:global(.pf-page) {
  width: 100%;
  height: 100%;
}

:global(.pf-page-inner) {
  width: 100%;
  height: 100%;
  position: relative;
  padding: 28px 32px;
  display: flex;
  flex-direction: column;
  background: #fffdfd;
  background-image: radial-gradient(rgba(0, 0, 0, 0.015) 1px, transparent 1px);
  background-size: 16px 16px;
  box-sizing: border-box;
  overflow: hidden;
}

:global(.pf-page-inner.is-continued) {
  background: #fffdfd;
}

.book-page.left :global(.pf-page-inner),
.flipper.prev .flipper-front :global(.pf-page-inner),
.flipper.next .flipper-back :global(.pf-page-inner) {
  background:
    radial-gradient(rgba(0, 0, 0, 0.015) 1px, transparent 1px),
    linear-gradient(to right, #fffdfd 90%, #fdf5f8 100%);
  background-size:
    16px 16px,
    100% 100%;
  box-shadow: inset -10px 0 20px -10px rgba(0, 0, 0, 0.04);
}

.book-page.right :global(.pf-page-inner),
.flipper.next .flipper-front :global(.pf-page-inner),
.flipper.prev .flipper-back :global(.pf-page-inner) {
  background:
    radial-gradient(rgba(0, 0, 0, 0.015) 1px, transparent 1px),
    linear-gradient(to left, #fffdfd 90%, #fdf5f8 100%);
  background-size:
    16px 16px,
    100% 100%;
  box-shadow: inset 10px 0 20px -10px rgba(0, 0, 0, 0.04);
}

:global(.pf-meta) {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  font-size: clamp(11px, 1.4vw, 13px);
}

:global(.pf-page-inner.is-continued .pf-meta) {
  display: none;
}

:global(.pf-date) {
  color: #b8a0b0;
  font-weight: 500;
  letter-spacing: 1px;
}

:global(.pf-time) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #c0b0b8;
  background: rgba(255, 255, 255, 0.65);
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
}

:global(.pf-title) {
  font-family: 'LoliFont', serif;
  font-size: clamp(1.35rem, 2.7vw, 1.9rem);
  color: #5a4a5c;
  margin: 0 0 12px;
  line-height: 1.18;
  letter-spacing: 1px;
}

:global(.pf-continued-header) {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}

:global(.pf-continued-tag) {
  font-size: 10px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(247, 199, 217, 0.18);
  color: #b07b94;
  letter-spacing: 2px;
}

:global(.pf-continued-title) {
  font-family: 'LoliFont', serif;
  font-size: clamp(1.1rem, 2.2vw, 1.5rem);
  color: #6a5362;
  margin: 0;
  letter-spacing: 1px;
}

:global(.pf-divider) {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 20px;
}

:global(.pf-divider-line) {
  width: 48px;
  height: 2px;
  background: linear-gradient(to right, #f7c7d9, #fdf0f5);
  border-radius: 2px;
}

:global(.pf-divider-dot) {
  font-size: 10px;
  color: #e0b0c8;
}

:global(.pf-body) {
  flex: 1;
  overflow: hidden;
  padding-right: 4px;
}

:global(.pf-text) {
  color: #6b5a66;
  line-height: 1.85;
  font-size: clamp(13px, 1.6vw, 15px);
  font-weight: 300;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

:global(.pf-text::first-letter) {
  float: left;
  font-size: 3rem;
  line-height: 1.1;
  margin-right: 0.1em;
  font-family: 'ZhiMangXingFont', serif;
  color: #fca5b9;
}

:global(.pf-page-inner.is-continued .pf-text::first-letter) {
  float: none;
  font-size: inherit;
  line-height: inherit;
  margin-right: 0;
  font-family: inherit;
  color: inherit;
}

:global(.pf-memory-card) {
  position: relative;
  width: 100%;
  height: clamp(86px, 15vh, 132px);
  margin-bottom: 20px;
  border-radius: 12px;
  overflow: hidden;
  background: linear-gradient(135deg, #fff0f6, #faf4ff 52%, #fff7fb);
}

:global(.pf-memory-glow) {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 28% 25%, rgba(255, 255, 255, 0.8), transparent 36%),
    radial-gradient(circle at 70% 68%, rgba(217, 184, 255, 0.35), transparent 42%);
}

:global(.pf-memory-icon) {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: clamp(2rem, 5vw, 3rem);
  opacity: 0.42;
  transition: transform 0.5s ease;
}

:global(.pf-page-inner:hover .pf-memory-icon) {
  transform: scale(1.1);
}

:global(.pf-footer) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid rgba(247, 199, 217, 0.35);
}

:global(.pf-mood) {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  color: #a9a0a7;
  font-size: 12px;
}

:global(.pf-mood b) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid rgba(247, 199, 217, 0.4);
  background: linear-gradient(90deg, rgba(255, 240, 246, 0.9), rgba(250, 244, 255, 0.8));
  color: #d281a0;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

:global(.pf-tags) {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  flex-wrap: wrap;
}

:global(.pf-part) {
  position: absolute;
  right: 26px;
  bottom: 18px;
  font-size: 10px;
  letter-spacing: 1px;
  color: rgba(130, 115, 125, 0.6);
}

:global(.pf-tag) {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 10px;
  background: rgba(247, 199, 217, 0.15);
  color: #c08aa0;
}

:global(.pf-corner-fold) {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 68px;
  height: 68px;
  opacity: 0.65;
  background: linear-gradient(135deg, transparent 50%, rgba(247, 199, 217, 0.22) 51%);
  pointer-events: none;
  transition: opacity 0.2s ease;
}

.book-page.left :global(.pf-corner-fold),
.flipper.prev .flipper-front :global(.pf-corner-fold),
.flipper.next .flipper-back :global(.pf-corner-fold) {
  right: auto;
  left: 0;
  transform: scaleX(-1);
}

:global(.pf-page-inner:hover .pf-corner-fold) {
  opacity: 1;
}

/* ==================== 状态占位 ==================== */
.book-status {
  position: absolute;
  text-align: center;
  color: #b098a8;
  font-style: italic;
}
.status-icon {
  font-size: 2rem;
  display: inline-block;
  animation: bounce 1s ease infinite;
}
@keyframes bounce {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
}

/* ==================== 过渡 ==================== */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.35s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
</style>
