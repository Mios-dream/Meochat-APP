interface CharRenderData {
  id: number
  char: string
  dim: boolean
  delay: number
}

interface SegmentData {
  text: string
  dim: boolean
}

type RenderCallback = (data: {
  chars: CharRenderData[]
  icon?: { path: string }
  totalAnimDuration: number
}) => void

class MessageTips {
  private messageTimer: ReturnType<typeof setTimeout> | null = null
  private measureElement: HTMLDivElement | null = null
  private renderCallback: RenderCallback | null = null
  private charIdCounter = 0
  private lastRenderedText = ''

  private readonly bracketPairs: Record<string, string> = {
    '(': ')',
    '[': ']',
    '（': '）',
    '【': '】'
  }
  private readonly closingBrackets = new Set(Object.values(this.bracketPairs))

  public setRenderCallback(cb: RenderCallback): void {
    this.renderCallback = cb
  }

  public showMessage(
    text: string,
    timeout: number = 5000,
    priority: number = 1,
    transitionDuration: number = 0,
    icon?: { path: string }
  ): void {
    if (this.messageTimer) {
      clearTimeout(this.messageTimer)
      this.messageTimer = null
    }

    const prePriority = parseInt(sessionStorage.getItem('assistant-text-priority') || '0')

    if (prePriority && prePriority > priority) {
      return
    }
    sessionStorage.setItem('assistant-text-priority', priority.toString())

    const fadeDuration = transitionDuration > 0 ? transitionDuration : 350
    const chars = this.buildCharData(text, fadeDuration)

    this.renderCallback?.({
      chars,
      icon,
      totalAnimDuration: Math.max(250, Math.floor(fadeDuration))
    })

    this.lastRenderedText = text

    if (timeout > 0) {
      this.messageTimer = setTimeout(() => {
        sessionStorage.removeItem('assistant-text-priority')
        this.renderCallback?.({ chars: [], totalAnimDuration: 0 })
        this.lastRenderedText = ''
        this.messageTimer = null
      }, timeout)
    }
  }

  public hideMessage(): void {
    this.lastRenderedText = ''
    this.renderCallback?.({ chars: [], totalAnimDuration: 0 })
  }

  private buildCharData(text: string, fadeDuration: number): CharRenderData[] {
    const maxTipHeight = this.calculateMaxTipHeight()
    const segments = this.splitByBracketDim(text)
    const visibleSegments = this.fitSegmentsToSingleView(segments, maxTipHeight)

    const allText = visibleSegments.map((s) => s.text).join('')
    const prefixLength = this.getCommonPrefixLength(this.lastRenderedText, allText)
    const [staticSegments, appendedSegments] = this.splitSegmentsByCharOffset(
      visibleSegments,
      prefixLength
    )

    const staticChars = this.segmentsToCharData(staticSegments, 0, 0)
    const totalNewChars = appendedSegments.reduce((s, seg) => s + seg.text.length, 0)
    const delayPerChar =
      totalNewChars > 0 ? Math.max(250, Math.floor(fadeDuration)) / totalNewChars : 0
    const newChars = this.segmentsToCharData(appendedSegments, delayPerChar, staticChars.length)

    return [...staticChars, ...newChars]
  }

  private segmentsToCharData(
    segments: SegmentData[],
    delayPerChar: number,
    startIndex: number
  ): CharRenderData[] {
    const result: CharRenderData[] = []
    let charOffset = 0

    for (const segment of segments) {
      for (const char of segment.text) {
        result.push({
          id: this.charIdCounter++,
          char,
          dim: segment.dim,
          delay: Math.floor((startIndex + charOffset) * delayPerChar)
        })
        charOffset++
      }
    }

    return result
  }

  private calculateMaxTipHeight(): number {
    const viewportHeight = window.innerHeight || 720
    return Math.max(96, Math.min(320, Math.floor(viewportHeight * 0.4)))
  }

  private getMaxContentHeight(maxTipHeight: number): number {
    const padding = 40
    return Math.max(32, maxTipHeight - padding)
  }

  private doesSegmentsFit(segments: SegmentData[], maxContentHeight: number): boolean {
    const probe = this.getMeasureElement()
    const width = Math.max(1, window.innerWidth * 0.8 - 40)
    probe.style.width = `${Math.min(width, 560)}px`

    probe.textContent = ''
    for (const segment of segments) {
      if (!segment.text) continue
      const span = document.createElement('span')
      span.style.display = 'inline'
      if (segment.dim) {
        span.style.opacity = '0.45'
      }
      span.textContent = segment.text
      probe.appendChild(span)
    }

    return probe.scrollHeight <= maxContentHeight
  }

  private getMeasureElement(): HTMLDivElement {
    if (this.measureElement) {
      return this.measureElement
    }

    const probe = document.createElement('div')
    probe.style.cssText = `
      position: fixed;
      left: -99999px;
      top: 0;
      visibility: hidden;
      pointer-events: none;
      white-space: normal;
      word-break: break-word;
      box-sizing: border-box;
      z-index: -1;
      font-size: 14px;
      line-height: 30px;
      padding: 20px;
    `
    document.body.appendChild(probe)
    this.measureElement = probe
    return probe
  }

  private getCommonPrefixLength(a: string, b: string): number {
    const maxLength = Math.min(a.length, b.length)
    let index = 0
    while (index < maxLength && a[index] === b[index]) {
      index++
    }
    return index
  }

  private splitSegmentsByCharOffset(
    segments: SegmentData[],
    offset: number
  ): [SegmentData[], SegmentData[]] {
    if (offset <= 0) {
      return [[], segments]
    }

    const staticSegments: SegmentData[] = []
    const appendedSegments: SegmentData[] = []
    let consumed = 0

    for (const segment of segments) {
      const segmentLength = segment.text.length
      const nextConsumed = consumed + segmentLength

      if (nextConsumed <= offset) {
        staticSegments.push({ ...segment })
        consumed = nextConsumed
        continue
      }

      if (consumed < offset) {
        const splitIndex = offset - consumed
        const leftText = segment.text.slice(0, splitIndex)
        const rightText = segment.text.slice(splitIndex)
        if (leftText) {
          staticSegments.push({ text: leftText, dim: segment.dim })
        }
        if (rightText) {
          appendedSegments.push({ text: rightText, dim: segment.dim })
        }
      } else {
        appendedSegments.push({ ...segment })
      }

      consumed = nextConsumed
    }

    return [staticSegments, appendedSegments]
  }

  private fitSegmentsToSingleView(segments: SegmentData[], maxTipHeight: number): SegmentData[] {
    if (segments.length === 0) {
      return segments
    }

    const contentHeight = this.getMaxContentHeight(maxTipHeight)
    if (this.doesSegmentsFit(segments, contentHeight)) {
      return segments
    }

    const chars = this.expandSegmentsToChars(segments)
    let low = 0
    let high = chars.length - 1
    let bestStart = chars.length - 1

    while (low <= high) {
      const mid = Math.floor((low + high) / 2)
      const candidate = this.compressChars(chars.slice(mid))
      if (this.doesSegmentsFit(candidate, contentHeight)) {
        bestStart = mid
        high = mid - 1
      } else {
        low = mid + 1
      }
    }

    const sentenceSafeStart = this.adjustStartIndexForSentence(chars, bestStart)
    const sentenceSafeSegments = this.compressChars(chars.slice(sentenceSafeStart))

    if (this.doesSegmentsFit(sentenceSafeSegments, contentHeight)) {
      return sentenceSafeSegments
    }

    return this.compressChars(chars.slice(bestStart))
  }

  private expandSegmentsToChars(segments: SegmentData[]): Array<{ char: string; dim: boolean }> {
    const chars: Array<{ char: string; dim: boolean }> = []
    for (const segment of segments) {
      for (const char of segment.text) {
        chars.push({ char, dim: segment.dim })
      }
    }
    return chars
  }

  private compressChars(chars: Array<{ char: string; dim: boolean }>): SegmentData[] {
    const segments: SegmentData[] = []
    for (const item of chars) {
      const last = segments[segments.length - 1]
      if (last && last.dim === item.dim) {
        last.text += item.char
      } else {
        segments.push({ text: item.char, dim: item.dim })
      }
    }
    return segments
  }

  private adjustStartIndexForSentence(
    chars: Array<{ char: string; dim: boolean }>,
    startIndex: number
  ): number {
    if (startIndex <= 0 || startIndex >= chars.length) {
      return Math.max(0, Math.min(startIndex, chars.length - 1))
    }

    const hardBoundary = /[。！？!?；;…\n]/
    const softBoundary = /[，,、：:]/
    const maxForwardScan = Math.min(chars.length - 1, startIndex + 36)

    for (let i = startIndex + 1; i <= maxForwardScan; i++) {
      const prev = chars[i - 1]
      if (!prev || prev.dim || chars[i]?.dim) {
        continue
      }
      if (hardBoundary.test(prev.char)) {
        return i
      }
    }

    for (let i = startIndex + 1; i <= Math.min(maxForwardScan, startIndex + 20); i++) {
      const prev = chars[i - 1]
      if (!prev || prev.dim || chars[i]?.dim) {
        continue
      }
      if (softBoundary.test(prev.char)) {
        return i
      }
    }

    let safeStart = startIndex
    while (safeStart < chars.length - 1 && chars[safeStart].dim) {
      safeStart++
    }

    return safeStart
  }

  private splitByBracketDim(text: string): SegmentData[] {
    const segments: SegmentData[] = []
    const stack: string[] = []

    for (const char of text) {
      let dim = stack.length > 0

      if (this.bracketPairs[char]) {
        dim = true
        stack.push(this.bracketPairs[char])
      } else if (this.closingBrackets.has(char)) {
        if (stack.length > 0) {
          dim = true
          if (stack[stack.length - 1] === char) {
            stack.pop()
          }
        }
      }

      const last = segments[segments.length - 1]
      if (last && last.dim === dim) {
        last.text += char
      } else {
        segments.push({ text: char, dim })
      }
    }

    return segments
  }
}

export { MessageTips, type CharRenderData, type RenderCallback }
