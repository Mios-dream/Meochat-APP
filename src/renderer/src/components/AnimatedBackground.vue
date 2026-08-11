<template>
  <!-- 动态背景画布：铺满窗口、置于内容层之下、不拦截任何鼠标事件 -->
  <canvas ref="canvasRef" class="animated-background"></canvas>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { BackgroundScene } from '../services/background/BackgroundScene'
import { registerBackgroundScene } from '../services/background/backgroundController'
import type { BackgroundLayerConfig } from '../services/background/BackgroundScene'

// 拆分后的背景图层素材（与原始 app_background.png 同设计空间 4800x1600）
import bgFar from '../assets/images/background/app_background_背景.png'
import bgBody from '../assets/images/background/app_background_角色主体.png'
import bgHair from '../assets/images/background/app_background_后长发.png'
import bgEar1 from '../assets/images/background/app_background_耳朵1.png'
import bgEar2 from '../assets/images/background/app_background_耳朵2.png'
import bgSkirt from '../assets/images/background/app_background_裙子.png'
import bgHand from '../assets/images/background/app_background_手.png'
import bgBangs from '../assets/images/background/app_background_前发刘海.png'
import bgRibbon from '../assets/images/background/app_background_头发飘带.png'

const canvasRef = ref<HTMLCanvasElement>()
let scene: BackgroundScene | null = null

/**
 * 图层配置。
 *
 * 定位说明（设计空间 4800x1600，以左上角为原点）：
 * - 背景层为整幅画布，特殊处理：锚点设为中心 (0.5, 0.5)、坐标 (2400, 800)，
 *   scale=1.1 做"过扫描"，四周留出缓冲，防止视差位移露出画布边缘下的空白。
 * - 其余图层为裁剪到内容边界的小图，x/y 为该层左上角在设计空间中的坐标（已按画面定位）。
 * - pivotX / pivotY：锚点即"根部"，动画时该点保持不动、末端随变形摆动。
 *   发丝根部在右上 → (1, 0)；竖立兔耳：ear-1 根部在右下 → (1, 1)，ear-2 根部在右侧 → (1, 0.5)；
 *   裙子锚点在腰部顶端 → (0.5, 0)，变形效果中腰线固定、裙摆底部飘动；
 *   刘海根部在顶部发际线 → (0.5, 0)；飘带根部在系带端 → (1, 0.5)（可改为 0 换端）。
 * - parallax：鼠标视差系数（设计像素）。当前全部为 0（已取消视差），
 *   角色各层与背景层如需重新启用，必须保持角色各层系数一致，仅背景层可略大。
 * - sway：旋转摆动动画（耳朵使用；后长发为旋转 + 拖尾变形叠加），rotation 单位为
 *   弧度（1 度约 0.0175 弧度），translateX/Y 保持 0，避免整体平移拉扯根部导致分离。
 * - flutter：布料飘动动画，配置后图层渲染为可变形网格平面，叠加"飘动"（整片左右
 *   摆动）与"扩张收缩"（底边以中线为轴张合）两种位移，真实改变轮廓；用于裙子与刘海。
 * - trail：拖尾扭曲变形动画，配置后图层渲染为可变形网格平面，自由端随主体运动滞后
 *   扭曲，模拟摇曳拖尾感。axis=vertical 用于后长发（尾部左右摆动，配 sway 旋转）；
 *   axis=horizontal 用于头发飘带（尾部上下扇动，根端由 pivotX 决定）。
 *
 * 图层叠放顺序（z 由小到大）：
 * 背景 → 后长发 → 角色主体（盖住耳根，隐藏接缝）→ 耳朵1/耳朵2 → 刘海/飘带 → 裙子/手部。
 * 说明：各部件坐标当前按估算值放置（按需微调，不影响动态逻辑）。
 */
const layerConfigs: BackgroundLayerConfig[] = [
  {
    key: 'background',
    source: bgFar,
    z: 0,
    // 中心锚 + 过扫描：四周留 5% 缓冲，视差不会露白
    x: 2400,
    y: 800,
    pivotX: 0.5,
    pivotY: 0.5,
    scale: 1.1,
    // 视差已取消，背景保持静态（保留过扫描与系数，便于日后启用视差）
    parallax: 0
  },

  {
    key: 'ear-2',
    source: bgEar2,
    z: 4,
    x: 2115,
    y: 600,
    // 根部在右侧，锚定此处保持固定
    pivotX: 1,
    pivotY: 0.5,
    parallax: 0,
    sway: {
      // 反向约 2.3°，与 ear-1 错开相位形成不对称晃动；速度与裙子(2.2)保持一致
      rotation: -0.06,
      speed: 2.2,
      phase: 2.4,
      translateX: 0,
      translateY: 0
    }
  },
  {
    key: 'ear-1',
    source: bgEar1,
    z: 4,
    x: 2140,
    y: 630,
    // 根部在右下角，锚定此处保持固定
    pivotX: 1,
    pivotY: 1,
    parallax: 0,
    sway: {
      // 约 2.3° 轻微耳尖晃动；速度与裙子(2.2)保持一致
      rotation: 0.06,
      speed: 2.2,
      phase: 1.2,
      translateX: 0,
      translateY: 0
    }
  },
  {
    key: 'body',
    source: bgBody,
    z: 3,
    x: 2160,
    y: 592,
    pivotX: 0.5,
    pivotY: 0,
    parallax: 0
  },
  {
    key: 'bangs',
    source: bgBangs,
    z: 5,
    // 前发刘海：根部在顶部发际线，底部发梢随布料飘动轻微张合（坐标估算，可微调）
    x: 2106,
    y: 635,
    pivotX: 0.5,
    pivotY: 0,
    parallax: 0,
    flutter: {
      // 飘动幅度：刘海整体左右摆动时发梢的最大位移（设计像素，刘海较短、幅度宜小）
      sway: 12,
      // 扩张收缩幅度：发梢相对中线张合的量（设计像素）
      breathe: 10,
      // 动画速度（弧度/秒），与整体节奏一致
      speed: 2.1,
      // 初始相位，与裙子/发丝错开节奏
      phase: 1.2,
      segmentsX: 6,
      segmentsY: 8
    }
  },
  {
    key: 'ribbon',
    source: bgRibbon,
    z: 4,
    // 头发飘带：根部在系带端（默认右侧），自由端随拖尾上下扇动（坐标估算，可微调）
    x: 2120,
    y: 660,
    pivotX: 1,
    pivotY: 0.5,
    parallax: 0,
    trail: {
      // 自由端最大滞后位移（设计像素），根部为 0
      amplitude: 20,
      // 从根到自由端的总相位滞后（弧度，沿横向二次方累积）
      lag: 2,
      // 与整体节奏一致的动画速度（弧度/秒）
      speed: 2.2,
      // 初始相位，与其它部件错开
      phase: 2,
      // 沿横向（长度方向）累积拖尾，自由端上下扇动；根端由 pivotX 决定（1=右侧）
      axis: 'horizontal',
      segmentsX: 10,
      segmentsY: 4
    }
  },
  {
    key: 'skirt',
    source: bgSkirt,
    z: 5,
    // 裙子为腰部到裙摆的独立部件：顶端正中为腰部锚点（估算值，可微调）
    x: 1995,
    y: 880,
    pivotX: 0.5,
    pivotY: 0,
    parallax: 0,
    // 布料飘动动画：腰线固定，裙摆"左右飘动 + 底边张合"（替代刚性旋转摆动）
    flutter: {
      // 飘动幅度：裙摆整体左右摆动时底边的最大位移（设计像素）
      sway: 30,
      // 扩张收缩幅度：裙摆底边相对中线张合的量（左右各外扩/内收，设计像素）
      breathe: 20,
      // 动画速度（弧度/秒）
      speed: 1.9,
      // 初始相位，与发丝/耳朵错开节奏
      phase: 0,
      segmentsX: 10,
      segmentsY: 20
    }
  },
  {
    key: 'hand',
    source: bgHand,
    z: 6,
    // 手部静态部件：不参与任何动态，坐标为中心锚定的估算值（可微调）
    x: 2169,
    y: 962,
    pivotX: 0.5,
    pivotY: 0.5,
    parallax: 0
  },
  {
    key: 'back-hair',
    source: bgHair,
    z: 2,
    x: 2035,
    y: 677,
    // 发根锚点固定在右上，底部发梢随网格变形飘动
    pivotX: 1,
    pivotY: 0,
    // 与角色其余层保持一致，避免与身体分离
    parallax: 0,
    // 整体旋转摆动：发梢绕根部摆动（弧度），是发丝飘动的主体运动
    sway: {
      rotation: 0.06,
      speed: 2.2,
      phase: 0,
      translateX: 0,
      translateY: 0
    },
    // 叠加拖尾扭曲变形：尾部随旋转滞后扭曲，模拟摇曳拖尾感（与旋转同相位同步）
    trail: {
      // 尾部最大滞后位移（设计像素），根部为 0
      amplitude: 22,
      // 从根到尾部的总相位滞后（弧度，沿纵向二次方累积），越大拖尾越明显
      lag: 2.4,
      // 与 sway 旋转速度一致，保证拖尾与摆动同步
      speed: 2.2,
      // 与 sway 旋转相位一致，尾部紧贴主体运动
      phase: 0,
      segmentsX: 6,
      segmentsY: 16
    }
  }
]

onMounted(async () => {
  if (!canvasRef.value) return
  scene = new BackgroundScene()
  await scene.init(canvasRef.value, layerConfigs)
  // 注册到全局控制器门面，供外部（各页面）直接调用控制方法；
  // 注册时会自动应用此前缓存的控制请求，避免"先调用后初始化"导致请求丢失
  registerBackgroundScene(scene)
})

onBeforeUnmount(() => {
  registerBackgroundScene(null)
  scene?.destroy()
  scene = null
})
</script>

<style scoped>
.animated-background {
  /* 铺满窗口，位于内容层之下，不拦截交互事件 */
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
</style>
