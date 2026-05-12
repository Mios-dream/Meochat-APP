import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * UI状态共享Store
 * 用于跨组件共享UI状态（如面板展开/收起、背景模糊等）
 */
export const useUIStore = defineStore('ui', () => {
  /** HomeView侧面板是否展开 */
  const isHomePanelOpen = ref(false)

  return {
    isHomePanelOpen
  }
})
