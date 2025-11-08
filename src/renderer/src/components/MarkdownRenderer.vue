<template>
  <!-- 使用 v-html -->
  <!-- eslint-disable vue/no-v-html -->
  <div class="markdown-content" v-html="renderedMarkdown"></div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { marked } from 'marked'

interface Props {
  markdown?: string
}

const props = withDefaults(defineProps<Props>(), {
  markdown: ''
})

const renderedMarkdown = computed(() => {
  return marked(props.markdown)
})
</script>

<style scoped>
.markdown-content {
  text-align: left;
}

.markdown-content :deep(h1),
.markdown-content :deep(h2),
.markdown-content :deep(h3) {
  margin-top: 1em;
  margin-bottom: 0.5em;
  color: #333;
}

.markdown-content :deep(p) {
  line-height: 1.6;
  margin-bottom: 1em;
}

.markdown-content :deep(ul),
.markdown-content :deep(ol) {
  padding-left: 1.5em;
  margin-bottom: 1em;
}

.markdown-content :deep(li) {
  margin-bottom: 0.5em;
}

.markdown-content :deep(code) {
  background-color: #f4f4f4;
  padding: 0.2em 0.4em;
  border-radius: 3px;
  font-family: monospace;
}

.markdown-content :deep(pre) {
  background-color: #f4f4f4;
  padding: 1em;
  border-radius: 5px;
  overflow-x: auto;
}

.markdown-content :deep(pre code) {
  background: none;
  padding: 0;
}

.markdown-content :deep(blockquote) {
  border-left: 4px solid #fca9c2;
  padding-left: 1em;
  margin-left: 0;
  color: #666;
}
</style>
