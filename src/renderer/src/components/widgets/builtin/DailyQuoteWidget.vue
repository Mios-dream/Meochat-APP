<template>
  <div class="daily-quote-widget">
    <!-- 引言内容 -->
    <div class="quote-content">
      <div class="quote-mark">"</div>
      <p class="quote-text" :class="{ 'fade-in': isAnimating }">{{ currentQuote.text }}</p>
      <div class="quote-mark closing">"</div>
    </div>

    <!-- 出处 -->
    <div class="quote-source">
      <span class="source-dash">——</span>
      <span class="source-author">{{ currentQuote.author }}</span>
      <span v-if="currentQuote.source" class="source-book">《{{ currentQuote.source }}》</span>
    </div>

    <!-- 操作按钮 -->
    <div class="quote-actions">
      <button class="action-btn refresh-btn" @click="refreshQuote" title="换一句">
        <font-awesome-icon icon="fa-solid fa-rotate" :class="{ spinning: isRefreshing }" />
        <span>换一句</span>
      </button>
      <button class="action-btn copy-btn" @click="copyQuote" title="复制">
        <font-awesome-icon :icon="copied ? 'fa-solid fa-check' : 'fa-solid fa-copy'" />
        <span>{{ copied ? '已复制' : '复制' }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

/** 引言接口 */
interface Quote {
  text: string
  author: string
  source?: string
}

/** 内置经典语录 */
const QUOTES: Quote[] = [
  { text: '人生如逆旅，我亦是行人。', author: '苏轼', source: '临江仙·送钱穆父' },
  { text: '世界上最宽阔的是海洋，比海洋更宽阔的是天空，比天空更宽阔的是人的心灵。', author: '雨果', source: '悲惨世界' },
  { text: '生活不是等待风暴过去，而是学会在雨中翩翩起舞。', author: '未知' },
  { text: '人生天地之间，若白驹过隙，忽然而已。', author: '庄子', source: '知北游' },
  { text: '我们听过无数的道理，却仍旧过不好这一生。', author: '韩寒', source: '后会无期' },
  { text: '醉后不知天在水，满船清梦压星河。', author: '唐温如', source: '题龙阳县青草湖' },
  { text: '山有木兮木有枝，心悦君兮君不知。', author: '佚名', source: '越人歌' },
  { text: '落霞与孤鹜齐飞，秋水共长天一色。', author: '王勃', source: '滕王阁序' },
  { text: '人生自是有情痴，此恨不关风与月。', author: '欧阳修', source: '玉楼春' },
  { text: '世间安得双全法，不负如来不负卿。', author: '仓央嘉措' },
  { text: '黑夜给了我黑色的眼睛，我却用它寻找光明。', author: '顾城', source: '一代人' },
  { text: '你站在桥上看风景，看风景的人在楼上看你。', author: '卞之琳', source: '断章' },
  { text: '宠辱不惊，看庭前花开花落；去留无意，望天上云卷云舒。', author: '洪应明', source: '菜根谭' },
  { text: '春水初生，春林初盛，春风十里，不如你。', author: '冯唐', source: '三十六大' },
  { text: '愿你出走半生，归来仍是少年。', author: '苏轼' },
  { text: '浮世三千，吾爱有三：日月与卿。日为朝，月为暮，卿为朝朝暮暮。', author: '佚名' },
  { text: '玲珑骰子安红豆，入骨相思知不知。', author: '温庭筠', source: '南歌子词二首' },
  { text: '人生若只如初见，何事秋风悲画扇。', author: '纳兰性德', source: '木兰花·拟古决绝词柬友' },
  { text: '我见青山多妩媚，料青山见我应如是。', author: '辛弃疾', source: '贺新郎' },
  { text: '众里寻他千百度，蓦然回首，那人却在，灯火阑珊处。', author: '辛弃疾', source: '青玉案·元夕' }
]

interface Emits {
  (e: 'refresh'): void
  (e: 'copy', text: string): void
}

const emit = defineEmits<Emits>()

/** 当前引言 */
const currentQuote = ref<Quote>(QUOTES[0])

/** 上一个引言索引 */
const lastIndex = ref(-1)

/** 是否正在刷新 */
const isRefreshing = ref(false)

/** 是否正在动画 */
const isAnimating = ref(false)

/** 是否已复制 */
const copied = ref(false)

/** 复制定时器 */
let copyTimer: ReturnType<typeof setTimeout> | null = null

/** 获取随机引言 */
function getRandomQuote(): Quote {
  let index: number
  do {
    index = Math.floor(Math.random() * QUOTES.length)
  } while (index === lastIndex.value && QUOTES.length > 1)

  lastIndex.value = index
  return QUOTES[index]
}

/** 刷新引言 */
async function refreshQuote(): Promise<void> {
  if (isRefreshing.value) return

  isRefreshing.value = true
  isAnimating.value = true

  // 动画延迟
  await new Promise(resolve => setTimeout(resolve, 300))

  currentQuote.value = getRandomQuote()
  emit('refresh')

  // 重置动画状态
  setTimeout(() => {
    isAnimating.value = false
    isRefreshing.value = false
  }, 500)
}

/** 复制引言 */
async function copyQuote(): Promise<void> {
  const text = `"${currentQuote.value.text}" —— ${currentQuote.value.author}${
    currentQuote.value.source ? `《${currentQuote.value.source}》` : ''
  }`

  try {
    await navigator.clipboard.writeText(text)
    copied.value = true
    emit('copy', text)

    // 重置复制状态
    if (copyTimer) clearTimeout(copyTimer)
    copyTimer = setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch (err) {
    console.error('复制失败:', err)
  }
}

/** 组件挂载 */
onMounted(() => {
  currentQuote.value = getRandomQuote()
})

/** 暴露方法 */
defineExpose({
  getCurrentQuote: () => currentQuote.value,
  refresh: refreshQuote
})
</script>

<style scoped>
.daily-quote-widget {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 16px;
  backdrop-filter: blur(10px);
}

.quote-content {
  position: relative;
  padding: 8px 16px;
}

.quote-mark {
  font-size: 48px;
  line-height: 1;
  color: var(--theme-color-light, #ffd1e8);
  font-family: Georgia, serif;
  user-select: none;
}

.quote-mark.closing {
  text-align: right;
  margin-top: -16px;
}

.quote-text {
  font-size: 16px;
  line-height: 1.8;
  color: var(--theme-text-color-dark, #333);
  margin: 0;
  padding: 0 8px;
  text-align: justify;
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.quote-text.fade-in {
  animation: fadeIn 0.5s ease forwards;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.quote-source {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 0 16px;
  font-size: 14px;
  color: #888;
}

.source-dash {
  color: var(--theme-color-light, #ffd1e8);
}

.source-author {
  font-weight: 500;
  color: #666;
}

.source-book {
  color: #999;
}

.quote-actions {
  display: flex;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
}

.action-btn {
  flex: 1;
  height: 36px;
  border: none;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.04);
  color: #666;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.action-btn:hover {
  background: rgba(251, 114, 153, 0.1);
  color: var(--theme-color, #fb7299);
}

.action-btn:active {
  transform: scale(0.98);
}

.refresh-btn .spinning {
  animation: spin 0.5s ease;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.copy-btn:hover {
  background: rgba(251, 114, 153, 0.1);
  color: var(--theme-color, #fb7299);
}
</style>
