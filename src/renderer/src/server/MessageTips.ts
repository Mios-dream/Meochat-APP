class MessageTips {
  public tipsElement: HTMLElement | null = null // Store the element reference
  private messageTimer: NodeJS.Timeout | null = null // Use null for timer

  public constructor() {}

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
   */
  public showMessage(text: string, timeout: number = 5, priority: number = 1) {
    // 2. Add check for tipsElement
    if (!this.tipsElement) {
      console.warn('MessageTips element not initialized. Skipping showMessage.')
      return
    }

    if (this.messageTimer) {
      clearTimeout(this.messageTimer)
      this.messageTimer = null
    }
    let prePriority = parseInt(sessionStorage.getItem('assistant-text-priority') || '0') // Add default value

    if (prePriority && prePriority > priority) {
      return
    }
    sessionStorage.setItem('assistant-text-priority', priority.toString())

    // Original line 25 error fixed by using tipsElement
    this.tipsElement.innerText = text
    this.tipsElement.classList.add('active')

    // 如果设置了消失时间，则设置定时器，否则则自行处理
    if (timeout > 0) {
      this.messageTimer = setTimeout(() => {
        sessionStorage.removeItem('assistant-text-priority')
        this.tipsElement!.classList.remove('active') // Use non-null assertion as it's checked above
        this.messageTimer = null // Reset timer
      }, timeout)
    }
  }

  public hideMessage() {
    if (this.tipsElement) {
      // Add check for tipsElement
      this.tipsElement.classList.remove('active')
    }
  }
}

export { MessageTips }
