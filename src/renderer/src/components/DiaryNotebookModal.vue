<template>
  <transition name="modal-fade">
    <div v-if="visible" class="modal-overlay" @click="handleClose">
      <div class="diary-notebook-modal" @click.stop>
        <div class="diary-notebook-header">
          <h2>助手日记本</h2>
          <div class="diary-meta">共 {{ pagination.total }} 篇记录</div>
        </div>
        <div class="diary-notebook-body">
          <div class="diary-binding" aria-hidden="true"></div>
          <div class="diary-page">
            <div v-if="loading" class="no-history">正在翻开日记本...</div>
            <div v-else-if="error" class="no-history">{{ error }}</div>
            <div v-else-if="records.length === 0" class="no-history">暂无日记记录</div>
            <div v-else class="diary-entry-list">
              <article
                v-for="(record, index) in records"
                :key="`${record.day}-${index}`"
                class="diary-entry"
              >
                <div class="diary-entry-header">
                  <div class="diary-day">{{ record.day || '未命名日期' }}</div>
                  <div class="diary-timestamp">
                    {{ formatTimestamp(record.dayLastTimestamp) }}
                  </div>
                </div>
                <p class="diary-summary">{{ record.summary || '今天还没有写下内容。' }}</p>
              </article>
            </div>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
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

defineProps<{
  visible: boolean
  loading: boolean
  error: string
  records: DiaryRecord[]
  pagination: DiaryPagination
  formatTimestamp: (timestamp: string) => string
}>()

const emit = defineEmits<{ (e: 'close'): void }>()

function handleClose(): void {
  emit('close')
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.diary-notebook-modal {
  width: min(920px, 92vw);
  max-height: 78vh;
  background: linear-gradient(180deg, #fff9fb 0%, #fff3f7 100%);
  border-radius: 24px;
  border: 1px solid #ffd4e3;
  box-shadow: 0 20px 40px rgba(251, 114, 153, 0.2);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.diary-notebook-header {
  padding: 16px 24px;
  background: linear-gradient(90deg, #f982a6 0%, #ff9fbe 100%);
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: 'LoliFont';
}

.diary-notebook-header h2 {
  margin: 0;
  font-size: 1.45rem;
}

.diary-meta {
  font-size: 0.9rem;
  opacity: 0.95;
}

.diary-notebook-body {
  display: flex;
  min-height: 460px;
  height: 100%;
}

.diary-binding {
  width: 52px;
  background:
    radial-gradient(circle at center, #ffffff 4px, transparent 4px) center 16px / 20px 40px repeat-y,
    linear-gradient(180deg, #ffd4e3 0%, #ffc1d7 100%);
  border-right: 2px solid #f7afc6;
}

.diary-page {
  flex: 1;
  padding: 20px 24px;
  background:
    linear-gradient(to right, rgba(249, 130, 166, 0.18) 0 2px, transparent 2px),
    repeating-linear-gradient(
      to bottom,
      #fffafc 0,
      #fffafc 35px,
      rgba(249, 130, 166, 0.2) 35px,
      rgba(249, 130, 166, 0.2) 36px
    );
  overflow-y: auto;
}

.diary-entry-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.diary-entry {
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid #ffdbe8;
  border-radius: 14px;
  padding: 12px 14px;
  box-shadow: 0 4px 12px rgba(249, 130, 166, 0.12);
}

.diary-entry-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.diary-day {
  font-weight: bold;
  color: #f35f8d;
}

.diary-timestamp {
  color: #8b7a82;
  font-size: 12px;
}

.diary-summary {
  margin: 0;
  color: #5b4b52;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}

.no-history {
  text-align: center;
  color: #999;
  font-style: italic;
  padding: 40px 0;
}

:global(.modal-fade-enter-active),
:global(.modal-fade-leave-active) {
  transition: opacity 0.3s ease;
}

:global(.modal-fade-enter-from),
:global(.modal-fade-leave-to) {
  opacity: 0;
}

:global(.modal-fade-enter-from .diary-notebook-modal) {
  transform: scale(0.94) rotate(-0.5deg);
  transition: transform 0.3s ease;
}

:global(.modal-fade-enter-to .diary-notebook-modal) {
  transform: scale(1) rotate(0deg);
}

:global(.modal-fade-leave-from .diary-notebook-modal) {
  transform: scale(1) rotate(0deg);
}

:global(.modal-fade-leave-to .diary-notebook-modal) {
  transform: scale(0.94) rotate(0.5deg);
  transition: transform 0.3s ease;
}
</style>
