<template>
  <div class="widget-preview" :class="{ enabled: enabled }">
    <!-- 预览头部 -->
    <div class="preview-header">
      <div class="preview-icon">
        <font-awesome-icon :icon="icon" />
      </div>
      <div class="preview-info">
        <h3 class="preview-name">{{ name }}</h3>
        <p class="preview-description">{{ description }}</p>
      </div>
    </div>

    <!-- 预览内容 -->
    <div class="preview-content">
      <slot />
    </div>

    <!-- 预览操作 -->
    <div class="preview-actions">
      <button class="action-btn preview-btn" @click="$emit('preview')" title="预览">
        <font-awesome-icon icon="fa-solid fa-eye" />
        <span>预览</span>
      </button>
      <button
        class="action-btn desktop-btn"
        :class="{ active: enabled }"
        @click="$emit('toggle-desktop')"
        title="桌面显示"
      >
        <font-awesome-icon :icon="enabled ? 'fa-solid fa-desktop' : 'fa-solid fa-desktop'" />
        <span>{{ enabled ? '已开启' : '开启' }}</span>
      </button>
      <button class="action-btn add-btn" @click="$emit('add')" title="添加实例">
        <font-awesome-icon icon="fa-solid fa-plus" />
        <span>添加</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  name: string
  description: string
  icon: string | string[]
  enabled?: boolean
}

defineProps<Props>()

defineEmits<{
  (e: 'preview'): void
  (e: 'toggle-desktop'): void
  (e: 'add'): void
}>()
</script>

<style scoped>
.widget-preview {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
  border: 2px solid transparent;
}

.widget-preview:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  transform: translateY(-2px);
}

.widget-preview.enabled {
  border-color: var(--theme-color-light);
  box-shadow: 0 4px 16px rgba(251, 114, 153, 0.2);
}

.preview-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.preview-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--theme-color-light), var(--theme-color));
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 18px;
  flex-shrink: 0;
}

.preview-info {
  flex: 1;
  min-width: 0;
}

.preview-name {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--theme-text-color-dark);
}

.preview-description {
  margin: 4px 0 0;
  font-size: 12px;
  color: #999;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.preview-content {
  margin-bottom: 12px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.02);
  border-radius: 12px;
  min-height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  flex: 1;
  height: 36px;
  border: none;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.04);
  color: var(--theme-text-color-dark);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.action-btn:hover {
  background: rgba(0, 0, 0, 0.08);
}

.preview-btn:hover {
  background: rgba(251, 114, 153, 0.1);
  color: var(--theme-color);
}

.desktop-btn.active {
  background: var(--theme-color);
  color: white;
}

.desktop-btn.active:hover {
  background: var(--theme-color-dark);
}

.add-btn:hover {
  background: rgba(251, 114, 153, 0.1);
  color: var(--theme-color);
}
</style>
