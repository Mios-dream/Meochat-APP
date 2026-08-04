<template>
  <div class="tool-group-block">
    <div v-for="tool in tools" :key="tool.id" class="tool-group-item">
      <!-- 可点击头部：展开/折叠有结果的项目；无结果的项目灰色不可点击 -->
      <div
        :class="['tgi-header', { clickable: tool.result !== undefined }]"
        @click="toggle(tool.id)"
      >
        <font-awesome-icon icon="wrench" class="tgi-icon" />
        <span class="tgi-name">工具：{{ tool.name }}</span>
        <span class="tgi-args">{{ tool.args?.trim() }}</span>
        <span class="tgi-status">
          <template v-if="tool.result !== undefined">
            <!-- 有结果 → 展开/折叠指示器 -->
            <font-awesome-icon
              :icon="expanded[tool.id] ? 'chevron-down' : 'chevron-right'"
              class="tgi-chevron"
            />
          </template>
          <template v-else>
            <!-- 执行中动画 -->
            <span class="tgi-running-dot" />
            <span class="tgi-running-text">执行中</span>
          </template>
        </span>
      </div>
      <!-- 展开的详情区域：请求参数 + 返回结果 -->
      <transition name="result-expand">
        <div v-if="expanded[tool.id] && tool.result !== undefined" class="tgi-result">
          <div class="tgi-result-label">请求</div>
          <pre class="tgi-args-text">{{ formatJSON(tool.args) }}</pre>
          <div class="tgi-result-label">返回</div>
          <pre class="tgi-result-text">{{ formatJSON(tool.result) }}</pre>
        </div>
      </transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue'
import type { MergedTool } from '../chat/toolGrouping'

// 向后兼容导出：MergedTool 类型统一收敛到 chat/toolGrouping，这里仅做再导出
export type { MergedTool }

interface Props {
  tools: MergedTool[]
}

const props = defineProps<Props>()

/** 每项独立的展开/折叠状态 */
const expanded = reactive<Record<string, boolean>>({})

function toggle(id: string): void {
  expanded[id] = !expanded[id]
}

/** 监听 props 变化，为新出现的工具初始化折叠状态 */
watch(
  () => props.tools,
  (tools) => {
    for (const t of tools) {
      if (!(t.id in expanded)) {
        expanded[t.id] = false
      }
    }
  },
  { immediate: true, deep: true }
)

/** 格式化 JSON 参数；非 JSON 字符串原样返回 */
function formatJSON(raw: string | undefined): string {
  if (!raw) return ''
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}
</script>

<style scoped>
.tool-group-block {
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.07);
  border-radius: 8px;
  overflow: hidden;
}

.tool-group-item + .tool-group-item {
  border-top: 1px solid rgba(0, 0, 0, 0.04);
}

.tgi-header {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 10px;
  cursor: default;
  user-select: none;
  transition: background 0.15s;
  min-height: 32px;
}

.tgi-header.clickable {
  cursor: pointer;
}

.tgi-header.clickable:hover {
  background: rgba(0, 0, 0, 0.025);
}

.tgi-icon {
  font-size: 11px;
  color: #8b5cf6;
  flex-shrink: 0;
}

.tgi-name {
  font-size: 12px;
  color: #8b5cf6;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tgi-status {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
}

.tgi-chevron {
  font-size: 10px;
  color: #bbb;
  transition: transform 0.2s;
}

.tgi-running-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #fca5b9;
  animation: tg-pulse 1.2s ease-in-out infinite;
}

@keyframes tg-pulse {
  0%,
  100% {
    opacity: 0.4;
    transform: scale(0.85);
  }
  50% {
    opacity: 1;
    transform: scale(1.15);
  }
}

.tgi-running-text {
  font-size: 11px;
  color: #c0a0ae;
  white-space: nowrap;
}

/* 展开详情（请求 + 返回） */
.tgi-result {
  padding: 12px;
  background: rgba(0, 0, 0, 0.015);
  border-top: 1px solid rgba(0, 0, 0, 0.03);
}

.tgi-result-label {
  font-size: 10px;
  color: #8b5cf6;
  margin: 6px 0 3px;
  user-select: none;
}

.tgi-result-label:first-child {
  margin-top: 2px;
}

.tgi-args {
  flex: 1;
  color: #bbb;
  margin: 0;
  font-size: 11px;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tgi-args-text,
.tgi-result-text {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  background: rgba(251, 114, 153, 0.04);
  border: 1px solid rgba(251, 114, 153, 0.08);
  border-radius: 6px;
  padding: 6px 8px;
}

.tgi-args-text {
  color: #919191;
}

.tgi-result-text {
  color: #919191;
}

/* 展开/折叠动画 */
.result-expand-enter-active,
.result-expand-leave-active {
  transition:
    opacity 0.2s ease,
    max-height 0.25s ease;
  max-height: 600px;
  overflow: hidden;
}

.result-expand-enter-from,
.result-expand-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}
</style>
