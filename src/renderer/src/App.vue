<template>
  <router-view></router-view>
  <Notification />
</template>

<script setup lang="ts">
import Notification from './components/Notification.vue'
import { AssistantManager } from './services/assistantManager'
import { logService } from './services/LogService'

logService.info('应用启动')

// 助手管理器实例
const assistantManager = AssistantManager.getInstance()
assistantManager.initialize()
assistantManager.loadAssistants()
// import { useConfigStore } from './stores/useConfigStore'
// import { watch } from 'vue'

// const configStore = useConfigStore()

// // 监听主题色变化并更新CSS变量
// watch(
//   () => configStore.config.themeColor,
//   (newColor) => {
//     updateThemeColor(newColor)
//   },
//   { immediate: true }
// )

// function updateThemeColor(color: string): void {
//   const root = document.documentElement
//   // root.style.setProperty('--theme-color', color)

//   // 根据主题色生成相应的变体
//   const themeColor = hexToRgb(color)
//   if (themeColor) {
//     // --theme-color: #fb7299;
//     // --theme-color-light: #fca5b9;
//     // 生成浅色变体 (增加亮度)
//     // const lightColor = lightenColor(themeColor)
//     // root.style.setProperty('--theme-color-light', rgbToHex(lightColor))
//     // // 生成深色变体 (降低亮度)
//     // const darkColor = darkenColor(themeColor, 20)
//     // root.style.setProperty('--theme-color-dark', rgbToHex(darkColor))
//     // // 生成禁用状态颜色 (降低饱和度和亮度)
//     // const disabledColor = desaturateColor(darkenColor(themeColor, 40), 30)
//     // root.style.setProperty('--theme-color-disabled', rgbToHex(disabledColor))
//     // // 生成悬停状态颜色
//     // const hoverColor = lightenColor(themeColor)
//     // root.style.setProperty('--theme-color-hover', rgbToHex(hoverColor))
//     // // 生成激活状态颜色
//     // const activeColor = darkenColor(themeColor, 15)
//     // root.style.setProperty('--theme-color-active', rgbToHex(activeColor))
//   }
// }

// // 辅助函数：十六进制转RGB
// function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
//   const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
//   return result
//     ? {
//         r: parseInt(result[1], 16),
//         g: parseInt(result[2], 16),
//         b: parseInt(result[3], 16)
//       }
//     : null
// }

// // 辅助函数：RGB转十六进制
// function rgbToHex({ r, g, b }: { r: number; g: number; b: number }): string {
//   return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)
// }

// // 辅助函数：增加亮度
// function lightenColor(color: { r: number; g: number; b: number }): {
//   r: number
//   g: number
//   b: number
// } {
//   return {
//     r: Math.min(255, color.r),
//     g: Math.min(255, color.g + 53),
//     b: Math.min(255, color.b + 38)
//   }
// }

// // 辅助函数：降低亮度
// function darkenColor(
//   color: { r: number; g: number; b: number },
//   amount: number
// ): { r: number; g: number; b: number } {
//   return {
//     r: Math.max(0, color.r - amount),
//     g: Math.max(0, color.g - amount),
//     b: Math.max(0, color.b - amount)
//   }
// }

// // 辅助函数：降低饱和度
// function desaturateColor(
//   color: { r: number; g: number; b: number },
//   amount: number
// ): { r: number; g: number; b: number } {
//   const gray = 0.2989 * color.r + 0.587 * color.g + 0.114 * color.b
//   return {
//     r: Math.round(color.r + (gray - color.r) * (amount / 100)),
//     g: Math.round(color.g + (gray - color.g) * (amount / 100)),
//     b: Math.round(color.b + (gray - color.b) * (amount / 100))
//   }
// }
</script>
