class MessageTips {
  // 显示消息的DOM元素的引用
  public tipsElement: HTMLElement | null = null
  // 定时器ID，用于自动隐藏消息
  private messageTimer: ReturnType<typeof setTimeout> | null = null
  // 文本动画相关的状态
  private textAnimationTimer: ReturnType<typeof setTimeout> | null = null
  // 文本动画和分页循环的token，用于取消过期的定时器回调
  private textAnimationToken = 0
  // 用于测量文本高度的隐藏元素
  private measureElement: HTMLDivElement | null = null
  // 是否已注入淡入动画样式
  private fadeStyleInjected = false
  // 上一次渲染的页面文本，用于仅对新增后缀做淡入
  private lastRenderedText = ''
  // 当前事件图标配置
  private currentIcon?: { path: string }
  // 定义括号对和对应的dim状态
  private readonly bracketPairs: Record<string, string> = {
    '(': ')',
    '[': ']',
    '（': '）',
    '【': '】'
  }
  private readonly closingBrackets = new Set(Object.values(this.bracketPairs))

  // 1. New method to set the DOM element
  public setTipsElement(tipsElement: HTMLElement): void {
    if (tipsElement) {
      this.tipsElement = tipsElement
      console.log('MessageTips element initialized.')
    } else {
      console.error(
        `DOM element with ID '${tipsElement}' not found. MessageTips will not function.`
      )
    }
  }

  /*
   * 显示消息
   * @param {string} text - 消息内容
   * @param {number} timeout - 消息显示时间
   * @param {number} priority - 消息优先级
   * @param {number} transitionDuration - 文本过渡时间（毫秒）
   * @param {object} icon - 事件图标配置，用于在台词板末尾显示对应图标
   */
  public showMessage(
    text: string,
    timeout: number = 5000,
    priority: number = 1,
    transitionDuration: number = 0,
    icon?: { path: string }
  ): void {
    // 2. Add check for tipsElement
    if (!this.tipsElement) {
      console.warn('MessageTips element not initialized. Skipping showMessage.')
      return
    }

    if (this.messageTimer) {
      clearTimeout(this.messageTimer)
      this.messageTimer = null
    }
    this.clearTextAnimationTimer()
    const prePriority = parseInt(sessionStorage.getItem('assistant-text-priority') || '0') // Add default value

    if (prePriority && prePriority > priority) {
      return
    }
    sessionStorage.setItem('assistant-text-priority', priority.toString())

    // 保存当前图标配置
    this.currentIcon = icon

    const fadeDuration = transitionDuration > 0 ? transitionDuration : 350
    this.renderFormattedText(text, fadeDuration)
    this.tipsElement.classList.add('active')

    // 如果设置了消失时间，则设置定时器，否则则自行处理
    if (timeout > 0) {
      this.messageTimer = setTimeout(() => {
        sessionStorage.removeItem('assistant-text-priority')
        this.tipsElement!.classList.remove('active') // Use non-null assertion as it's checked above
        this.clearTextAnimationTimer()
        this.currentIcon = undefined
        this.messageTimer = null // Reset timer
      }, timeout)
    }
  }

  private renderFormattedText(text: string, fadeDuration: number = 350): void {
    if (!this.tipsElement) return

    this.ensureFadeAnimationStyle()
    const maxTipHeight = this.applyTipsHeightConstraint()
    const segments = this.splitByBracketDim(text)
    const visibleSegments = this.fitSegmentsToSingleView(segments, maxTipHeight)

    this.renderSegments(visibleSegments, fadeDuration, 'append')
  }

  private renderSegments(
    segments: Array<{ text: string; dim: boolean }>,
    fadeDuration: number,
    mode: 'append' | 'full' = 'full'
  ): void {
    if (!this.tipsElement) return

    const fragment = document.createDocumentFragment()
    const contentSpan = document.createElement('span')
    contentSpan.className = 'assistant-tips-content'
    contentSpan.style.display = 'inline'
    contentSpan.style.whiteSpace = 'normal'
    contentSpan.style.wordBreak = 'break-word'

    const pageText = segments.map((segment) => segment.text).join('')
    const prefixLength =
      mode === 'append' ? this.getCommonPrefixLength(this.lastRenderedText, pageText) : 0
    const [staticSegments, appendedSegments] = this.splitSegmentsByCharOffset(
      segments,
      prefixLength
    )

    this.appendSegmentsToContainer(contentSpan, staticSegments)

    const animationDuration = Math.max(250, Math.floor(fadeDuration))

    if (appendedSegments.length > 0) {
      const appendedSpan = document.createElement('span')
      appendedSpan.style.display = 'inline'
      this.appendCharSpansWithFade(appendedSpan, appendedSegments, animationDuration)
      contentSpan.appendChild(appendedSpan)
    }

    // 渲染事件图标（如果有）- 直接添加到 contentSpan 内部，紧跟文字末尾
    if (this.currentIcon) {
      // 创建一个不可分割的包装元素，确保图标不会与前面的文字分离到不同行
      const iconWrapper = document.createElement('span')
      iconWrapper.style.cssText = `
        display: inline-flex;
        white-space: nowrap;
        align-items: center;
        vertical-align: middle;
      `

      const iconSpan = document.createElement('span')
      iconSpan.className = 'assistant-tips-icon'
      iconSpan.style.cssText = `
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin-left: 4px;
        vertical-align: middle;
        font-size: 1.1em;
        line-height: 1;
        opacity: 0;
        animation: assistantTipsCharFadeIn ${animationDuration}ms ease-out forwards;
        animation-delay: ${animationDuration}ms;
      `

      // 优先使用本地图片路径
      if (this.currentIcon.path) {
        const img = document.createElement('img')
        img.src = this.currentIcon.path
        img.style.cssText = `
          width: 1.1em;
          height: 1.1em;
          object-fit: contain;
          vertical-align: middle;
        `
        iconSpan.appendChild(img)
        iconWrapper.appendChild(iconSpan)
        contentSpan.appendChild(iconWrapper)
      }
    }

    this.lastRenderedText = pageText

    fragment.appendChild(contentSpan)
    this.tipsElement.textContent = ''
    this.tipsElement.appendChild(fragment)
  }

  /**
   * 将文字拆分成单个字符并添加淡入动画。
   * @param container 容器元素
   * @param segments 文字段落
   * @param animationDuration 动画总时长
   */
  private appendCharSpansWithFade(
    container: HTMLElement,
    segments: Array<{ text: string; dim: boolean }>,
    animationDuration: number
  ): void {
    let charIndex = 0
    // 计算总字符数，用于分配动画延迟
    const totalChars = segments.reduce((sum, seg) => sum + seg.text.length, 0)
    // 每个字符的延迟时间
    const delayPerChar = totalChars > 0 ? animationDuration / totalChars : 0

    for (const segment of segments) {
      if (!segment.text) continue

      for (const char of segment.text) {
        const charSpan = document.createElement('span')
        charSpan.style.display = 'inline'
        charSpan.style.opacity = '0'
        charSpan.style.animation = `assistantTipsCharFadeIn ${Math.max(150, animationDuration * 0.3)}ms ease-out forwards`
        charSpan.style.animationDelay = `${Math.floor(charIndex * delayPerChar)}ms`

        if (segment.dim) {
          charSpan.className = 'assistant-tips-dim'
          charSpan.style.opacity = '0'
        }

        charSpan.textContent = char
        container.appendChild(charSpan)
        charIndex++
      }
    }
  }

  private appendSegmentsToContainer(
    container: HTMLElement,
    segments: Array<{ text: string; dim: boolean }>
  ): void {
    for (const segment of segments) {
      if (!segment.text) continue
      if (!segment.dim) {
        container.appendChild(document.createTextNode(segment.text))
        continue
      }

      const dimSpan = document.createElement('span')
      dimSpan.className = 'assistant-tips-dim'
      dimSpan.style.opacity = '0.45'
      dimSpan.textContent = segment.text
      container.appendChild(dimSpan)
    }
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
    segments: Array<{ text: string; dim: boolean }>,
    offset: number
  ): [Array<{ text: string; dim: boolean }>, Array<{ text: string; dim: boolean }>] {
    if (offset <= 0) {
      return [[], segments]
    }

    const staticSegments: Array<{ text: string; dim: boolean }> = []
    const appendedSegments: Array<{ text: string; dim: boolean }> = []
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

  private applyTipsHeightConstraint(): number {
    if (!this.tipsElement) {
      return 220
    }

    const viewportHeight = window.innerHeight || 720
    const maxTipHeight = Math.max(96, Math.min(320, Math.floor(viewportHeight * 0.4)))

    this.tipsElement.style.maxHeight = `${maxTipHeight}px`
    this.tipsElement.style.overflow = 'hidden'
    this.tipsElement.style.alignItems = 'flex-start'

    return maxTipHeight
  }

  private fitSegmentsToSingleView(
    segments: Array<{ text: string; dim: boolean }>,
    maxTipHeight: number
  ): Array<{ text: string; dim: boolean }> {
    if (!this.tipsElement || segments.length === 0) {
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

  private getMaxContentHeight(maxTipHeight: number): number {
    if (!this.tipsElement) {
      return maxTipHeight
    }

    const computedStyle = window.getComputedStyle(this.tipsElement)
    const paddingTop = parseFloat(computedStyle.paddingTop || '0')
    const paddingBottom = parseFloat(computedStyle.paddingBottom || '0')

    return Math.max(32, maxTipHeight - paddingTop - paddingBottom)
  }

  private doesSegmentsFit(
    segments: Array<{ text: string; dim: boolean }>,
    maxContentHeight: number
  ): boolean {
    if (!this.tipsElement) {
      return true
    }

    const probe = this.getMeasureElement()
    const computedStyle = window.getComputedStyle(this.tipsElement)
    const width = Math.max(
      1,
      this.tipsElement.clientWidth -
        parseFloat(computedStyle.paddingLeft || '0') -
        parseFloat(computedStyle.paddingRight || '0')
    )

    probe.style.width = `${width}px`
    probe.style.fontSize = computedStyle.fontSize
    probe.style.fontFamily = computedStyle.fontFamily
    probe.style.fontWeight = computedStyle.fontWeight
    probe.style.lineHeight = computedStyle.lineHeight
    probe.style.letterSpacing = computedStyle.letterSpacing

    probe.textContent = ''
    const contentSpan = document.createElement('span')
    contentSpan.style.display = 'inline'
    contentSpan.style.whiteSpace = 'normal'
    contentSpan.style.wordBreak = 'break-word'

    for (const segment of segments) {
      if (!segment.text) continue
      if (!segment.dim) {
        contentSpan.appendChild(document.createTextNode(segment.text))
      } else {
        const dimSpan = document.createElement('span')
        dimSpan.style.opacity = '0.45'
        dimSpan.textContent = segment.text
        contentSpan.appendChild(dimSpan)
      }
    }

    probe.appendChild(contentSpan)
    return probe.scrollHeight <= maxContentHeight
  }

  private getMeasureElement(): HTMLDivElement {
    if (this.measureElement) {
      return this.measureElement
    }

    const probe = document.createElement('div')
    probe.style.position = 'fixed'
    probe.style.left = '-99999px'
    probe.style.top = '0'
    probe.style.visibility = 'hidden'
    probe.style.pointerEvents = 'none'
    probe.style.whiteSpace = 'normal'
    probe.style.wordBreak = 'break-word'
    probe.style.boxSizing = 'border-box'
    probe.style.zIndex = '-1'
    document.body.appendChild(probe)

    this.measureElement = probe
    return probe
  }

  private expandSegmentsToChars(
    segments: Array<{ text: string; dim: boolean }>
  ): Array<{ char: string; dim: boolean }> {
    const chars: Array<{ char: string; dim: boolean }> = []

    for (const segment of segments) {
      for (const char of segment.text) {
        chars.push({ char, dim: segment.dim })
      }
    }

    return chars
  }

  private compressChars(
    chars: Array<{ char: string; dim: boolean }>
  ): Array<{ text: string; dim: boolean }> {
    const segments: Array<{ text: string; dim: boolean }> = []

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

  private ensureFadeAnimationStyle(): void {
    if (this.fadeStyleInjected || typeof document === 'undefined') {
      return
    }

    const styleId = 'assistant-tips-soft-fade-style'
    if (document.getElementById(styleId)) {
      this.fadeStyleInjected = true
      return
    }

    const style = document.createElement('style')
    style.id = styleId
    style.textContent = `
      @keyframes assistantTipsCharFadeIn {
        0% {
          opacity: 0;
        }
        100% {
          opacity: 1;
        }
      }
      .assistant-tips-dim {
        opacity: 0.45 !important;
      }
    `
    document.head.appendChild(style)
    this.fadeStyleInjected = true
  }

  private clearTextAnimationTimer(): void {
    this.textAnimationToken++
    if (this.textAnimationTimer) {
      clearTimeout(this.textAnimationTimer)
      this.textAnimationTimer = null
    }
  }

  private splitByBracketDim(text: string): Array<{ text: string; dim: boolean }> {
    const segments: Array<{ text: string; dim: boolean }> = []
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

  public hideMessage(): void {
    if (this.tipsElement) {
      // Add check for tipsElement
      this.tipsElement.classList.remove('active')
    }
    this.lastRenderedText = ''
    this.clearTextAnimationTimer()
  }
}

export { MessageTips }
