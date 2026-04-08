<template>
  <div :class="['message-text', role]">
    <span v-for="(segment, index) in parsedSegments" :key="index" :class="segment.class">
      {{ segment.text }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  content: string
  role: 'user' | 'assistant'
}

const props = defineProps<Props>()

interface TextSegment {
  text: string
  class?: string
}

const parsedSegments = computed(() => {
  const segments: TextSegment[] = []
  let remainingText = props.content || ''

  // 匹配括号内容的正则表达式
  const bracketRegex = /(\([^)]*\)|\[[^\]]*\]|（[^）]*）|【[^】]*】)/g

  let lastIndex = 0
  let match

  while ((match = bracketRegex.exec(remainingText)) !== null) {
    // 添加括号前的普通文本
    if (match.index > lastIndex) {
      segments.push({
        text: remainingText.slice(lastIndex, match.index)
      })
    }

    // 添加括号内的内容（淡显）
    segments.push({
      text: match[1],
      class: 'message-dim'
    })

    lastIndex = match.index + match[1].length
  }

  // 添加剩余文本
  if (lastIndex < remainingText.length) {
    segments.push({
      text: remainingText.slice(lastIndex)
    })
  }

  // 如果没有匹配到括号，直接返回原文本
  if (segments.length === 0) {
    segments.push({
      text: remainingText
    })
  }

  return segments
})
</script>

<style scoped>
.message-text {
  line-height: 1.5;
}

.message-dim {
  color: #2d2d2d;
}

/* 用户消息样式 */
.message-text.user {
  color: #333;
}

/* 助手消息样式 */
.message-text.assistant {
  color: #2c3e50;
}
</style>
