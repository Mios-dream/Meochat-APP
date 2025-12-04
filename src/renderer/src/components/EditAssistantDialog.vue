<template>
  <BlurModal :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)">
    <div class="add-assistant-dialog">
      <div class="add-assistant-title">
        {{ isEditMode ? '编辑助手' : '聘用助手' }}
      </div>
      <div class="add-assistant-tips">和阁下的每一次相遇都是一个奇迹，因此我会无比珍惜</div>

      <!-- 选项卡导航 -->
      <div class="tabs">
        <button
          v-for="tab in tabs"
          :key="tab.value"
          :class="['tab-btn', { active: activeTab === tab.value }]"
          @click="activeTab = tab.value"
        >
          <font-awesome-icon :icon="tab.icon" />
          <span>{{ tab.label }}</span>
        </button>
      </div>

      <form class="add-assistant-form" @submit.prevent="handleSubmit">
        <!-- 基本信息选项卡 -->
        <div v-show="activeTab === 'basic'">
          <div class="form-row">
            <div class="avatar-upload-section">
              <label>角色头像</label>
              <div class="avatar-upload-container">
                <div
                  v-if="previewImage"
                  class="avatar-preview"
                  :style="{ backgroundImage: `url(${previewImage})` }"
                >
                  <button type="button" class="remove-avatar" @click="removeAvatar">×</button>
                </div>
                <div v-else class="avatar-placeholder" @click="triggerFileInput">
                  <font-awesome-icon icon="fa-solid fa-user" />
                  <p>点击上传头像</p>
                </div>
                <input
                  id="assistantAvatar"
                  ref="fileInput"
                  type="file"
                  accept="image/*"
                  style="display: none"
                  @change="handleAvatarFileSelect"
                />
              </div>
            </div>
            <div class="form-group">
              <div class="form-row">
                <div class="form-group">
                  <label for="assistantName">名字</label>
                  <input
                    id="assistantName"
                    v-model="formData.name"
                    type="text"
                    required
                    :disabled="isEditMode"
                    placeholder="给助手起一个名字吧"
                  />
                </div>
              </div>
              <div class="form-group">
                <div class="form-row">
                  <div class="form-group">
                    <label for="assistantHeight">身高(cm)</label>
                    <input
                      id="assistantHeight"
                      v-model.number="formData.height"
                      type="text"
                      required
                    />
                  </div>
                  <div class="form-group">
                    <label for="assistantWeight">体重(kg)</label>
                    <input
                      id="assistantWeight"
                      v-model.number="formData.weight"
                      type="text"
                      required
                    />
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label for="assistantBirthday">生日</label>
                    <input
                      id="assistantBirthday"
                      v-model="formData.birthday"
                      type="date"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="form-group">
            <label for="assistantPersonality">角色性格</label>
            <textarea
              id="assistantPersonality"
              v-model="formData.personality"
              type="text"
              placeholder="例如：活泼、内向等"
              rows="2"
            ></textarea>
          </div>

          <div class="form-group">
            <label for="assistantDescription">描述</label>
            <textarea
              id="assistantDescription"
              v-model="formData.description"
              placeholder="请输入助手的详细描述"
              rows="5"
            ></textarea>
          </div>

          <div class="form-group">
            <label for="assistantUser">对用户的称呼</label>
            <input
              id="assistantUser"
              v-model="formData.user"
              type="text"
              placeholder="例如：主人、阁下等"
            />
          </div>

          <div class="form-group">
            <label for="extraDescription">额外描述</label>
            <textarea
              id="extraDescription"
              v-model="formData.extraDescription"
              placeholder="可以添加一些额外的背景故事或特征描述"
              rows="4"
            ></textarea>
          </div>

          <div class="form-group">
            <label for="mask">用户设定</label>
            <textarea
              id="mask"
              v-model="formData.mask"
              placeholder="用于在提示词中填充用户的信息，让助手更了解用户"
              rows="3"
            ></textarea>
          </div>

          <div class="form-group">
            <label for="customPrompt">自定义提示词</label>
            <textarea
              id="customPrompt"
              v-model="formData.customPrompt"
              placeholder="可以添加自定义的提示词，将不使用模板创建助手"
              rows="4"
            ></textarea>
          </div>

          <div class="form-group">
            <label>对话案例</label>
            <div class="message-examples">
              <div
                v-for="(_example, index) in formData.messageExamples"
                :key="index"
                class="example-item"
              >
                <textarea
                  v-model="formData.messageExamples[index]"
                  placeholder="输入对话案例..."
                  rows="2"
                ></textarea>
                <button type="button" class="remove-example" @click="removeMessageExample(index)">
                  ×
                </button>
              </div>
              <button type="button" class="add-example" @click="addMessageExample">
                <font-awesome-icon icon="fa-solid fa-plus" /> 添加对话案例
              </button>
            </div>
          </div>

          <div class="form-group">
            <label>开场白（每行一个）</label>
            <div class="message-examples">
              <div
                v-for="(_example, index) in formData.startWith"
                :key="index"
                class="example-item"
              >
                <textarea
                  v-model="formData.startWith[index]"
                  placeholder="输入开场白..."
                  rows="2"
                ></textarea>
                <button type="button" class="remove-example" @click="removeStartWith(index)">
                  ×
                </button>
              </div>
              <button type="button" class="add-example" @click="addStartWith">
                <font-awesome-icon icon="fa-solid fa-plus" /> 添加开场白
              </button>
            </div>
          </div>
        </div>
        <div v-show="activeTab === 'advanced'">
          <div class="settings-section">
            <h4>系统设置</h4>
            <div class="setting-item">
              <form class="setting-from">
                <div class="title">
                  <label>启用长期记忆</label>
                  <div class="description">助手可以记住长期对话内容</div>
                </div>
                <ToggleSwitch
                  :model-value="formData.settings.enableLongMemory"
                  @update:model-value="formData.settings.enableLongMemory = $event"
                />
              </form>
              <div class="divider"></div>
              <form class="setting-from">
                <div class="title">
                  <label>启用核心记忆</label>
                  <div class="description">助手可以记住重要的关键信息</div>
                </div>
                <ToggleSwitch
                  :model-value="formData.settings.enableCoreMemory"
                  @update:model-value="formData.settings.enableCoreMemory = $event"
                />
              </form>
              <div class="divider"></div>
              <form class="setting-from">
                <div class="title">
                  <label>启用知识库</label>
                  <div class="description">助手可以访问预设的知识库内容</div>
                </div>
                <ToggleSwitch
                  :model-value="formData.settings.enableLoreBooks"
                  @update:model-value="formData.settings.enableLoreBooks = $event"
                />
              </form>
              <div class="divider"></div>
              <form class="setting-from">
                <div class="title">
                  <label>启用情绪系统</label>
                  <div class="description">助手可以表达和体验情绪变化</div>
                </div>
                <ToggleSwitch
                  :model-value="formData.settings.enableEmotionSystem"
                  @update:model-value="formData.settings.enableEmotionSystem = $event"
                />
              </form>
            </div>
          </div>
          <div class="settings-section">
            <h4>语音设置</h4>
            <div class="setting-item">
              <form class="setting-from">
                <div class="title">
                  <label for="textLang">输出语音语言</label>
                  <div class="description">设置助手的语音输出语言</div>
                </div>
                <select id="textLang" v-model="formData.gsvSetting.textLang" default-value="zh">
                  <option value="zh">中文</option>
                  <option value="en">英文</option>
                  <option value="ja">日文</option>
                </select>
              </form>
              <div class="divider"></div>

              <form class="setting-from">
                <div class="title">
                  <label for="seed">随机种子</label>
                  <div class="description">控制语音生成的随机性，-1表示随机</div>
                </div>
                <input
                  id="seed"
                  v-model.number="formData.gsvSetting.seed"
                  type="number"
                  min="-1"
                  placeholder="-1表示随机"
                />
              </form>
              <div class="divider"></div>

              <form class="setting-from">
                <div class="title">
                  <label for="topK">TopK值</label>
                  <div class="description">控制语音生成的多样性</div>
                </div>

                <input id="topK" v-model.number="formData.gsvSetting.topK" type="number" min="1" />
              </form>
              <div class="divider"></div>
              <form class="setting-from">
                <div class="title">
                  <label for="textLang">参考语音语言</label>
                  <div class="description">设置语音合成的参考语音的语言</div>
                </div>
                <select
                  id="refTextLang"
                  v-model="formData.gsvSetting.promptLang"
                  default-value="zh"
                >
                  <option value="zh">中文</option>
                  <option value="en">英文</option>
                  <option value="ja">日文</option>
                </select>
              </form>

              <div class="divider"></div>
              <form class="setting-from">
                <div class="title">
                  <label for="refAudioPath">参考音频</label>
                  <div class="description">用于合成语音的参考音频文件地址</div>
                </div>
                <input
                  id="refAudioPath"
                  v-model="formData.gsvSetting.refAudioPath"
                  type="text"
                  placeholder="输入参考音频文件地址..."
                  required
                />
              </form>
              <div class="divider"></div>

              <form class="setting-from">
                <div class="title">
                  <label for="promptText">参考文本</label>
                  <div class="description">对应参考音频的文本</div>
                </div>
                <input
                  id="promptText"
                  v-model="formData.gsvSetting.promptText"
                  type="text"
                  placeholder="输入参考文本..."
                  required
                />
              </form>
            </div>
          </div>
        </div>
        <!-- 资产管理选项卡 -->
        <div v-show="activeTab === 'assets'">
          <div class="settings-section">
            <h4>角色立绘管理</h4>
            <div class="asset-upload-section">
              <div class="asset-item">
                <label>角色立绘</label>
                <div class="upload-container">
                  <div
                    v-if="
                      assistantAssets.characterImages && assistantAssets.characterImages.length > 0
                    "
                    class="asset-preview-list"
                  >
                    <div v-if="assistantAssets.characterImages" class="image-preview-item">
                      <div
                        class="image-preview"
                        :style="{
                          backgroundImage: `url(${assistantAssets.characterImages})`
                        }"
                      ></div>

                      <button type="button" class="remove-asset" @click="removeCharacterImage()">
                        ×
                      </button>
                    </div>
                  </div>
                  <div v-else class="upload-placeholder" @click="triggerCharacterImageUpload">
                    <font-awesome-icon icon="fa-solid fa-image" />
                    <div>点击上传角色立绘</div>
                  </div>
                  <input
                    id="characterImages"
                    ref="characterImageInput"
                    type="file"
                    accept="image/*"
                    multiple
                    style="display: none"
                    @change="handleCharacterImageSelect"
                  />
                </div>
              </div>
            </div>
          </div>

          <div class="settings-section">
            <h4>Live2D模型管理</h4>
            <div class="asset-upload-section">
              <div class="asset-item">
                <label>Live2D模型（ZIP压缩包）</label>
                <div class="upload-container">
                  <!-- 修改这里的条件判断，只要name存在就显示文件信息 -->
                  <div v-if="live2dModelInfo.name" class="live2d-model-info">
                    <div class="model-icon-container">
                      <font-awesome-icon icon="fa-solid fa-box" />
                    </div>
                    <div class="model-info-container">
                      <div class="model-info-item">
                        <span class="info-label">文件名称:</span>
                        <span class="info-value">{{ live2dModelInfo.name }}</span>
                      </div>
                      <div class="model-info-item">
                        <span class="info-label">文件大小:</span>
                        <span class="info-value">{{ formatFileSize(live2dModelInfo.size) }}</span>
                      </div>
                      <div v-if="assistantAssets.live2d.modelJsonPath" class="model-info-item">
                        <span class="info-label">主JSON路径:</span>
                        <span class="info-value">{{ assistantAssets.live2d.modelJsonPath }}</span>
                      </div>
                    </div>
                    <div
                      v-if="live2dModelInfo.progress > 0 && live2dModelInfo.progress < 100"
                      class="upload-progress"
                    >
                      <div class="progress-bar">
                        <div
                          class="progress-fill"
                          :style="{ width: live2dModelInfo.progress + '%' }"
                        ></div>
                      </div>
                      <span class="progress-text">{{ live2dModelInfo.progress }}%</span>
                    </div>
                    <button type="button" class="remove-asset" @click="removeLive2dModel">×</button>
                  </div>
                  <!-- 添加一个类来显示文件已选择但未上传的状态 -->
                  <div v-else class="upload-placeholder" @click="triggerLive2dModelUpload">
                    <font-awesome-icon icon="fa-solid fa-box" />
                    <div>点击上传Live2D模型</div>
                  </div>
                  <input
                    id="live2dModel"
                    ref="live2dModelInput"
                    type="file"
                    accept=".zip"
                    style="display: none"
                    @change="handleLive2dModelSelect"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="form-actions">
          <button type="button" class="cancel-btn" @click="handleCancel">取消</button>
          <button type="submit" class="submit-btn">
            <span v-if="!isSubmitting">{{ isEditMode ? '保存修改' : '添加助手' }}</span>
            <span v-else class="loading-spinner">
              <font-awesome-icon icon="fa-solid fa-circle-notch" class="fa-spin" />
              处理中...
            </span>
          </button>
        </div>
      </form>
    </div>
  </BlurModal>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import BlurModal from './BlurModal.vue'
import type { AssistantAssets, AssistantInfo } from '../services/assistantManager'
import { AssistantManager } from '../services/assistantManager'
import ToggleSwitch from './ToggleSwitch.vue'
import { NotificationService } from '../services/NotificationService'

interface Props {
  modelValue: boolean
  editingAssistant?: AssistantInfo | null
  isImportFromCard?: boolean
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'cancel'): void
  (e: 'success'): void
}

const props = withDefaults(defineProps<Props>(), {
  isImportFromCard: false
})
const emit = defineEmits<Emits>()

const assistantManager = AssistantManager.getInstance()
const notificationService = NotificationService.getInstance()

// 选项卡配置
const tabs = [
  { label: '基本信息', value: 'basic', icon: 'fa-solid fa-user' },
  { label: '高级选项', value: 'advanced', icon: 'fa-solid fa-sliders' },
  { label: '资产管理', value: 'assets', icon: 'fa-solid fa-box-open' }
]

// 当前活动选项卡
const activeTab = ref('basic')

// 是否为编辑模式
const isEditMode = computed(() => !!props.editingAssistant)

// 加载状态
const isSubmitting = ref(false)

// 文件上传相关
const fileInput = ref<HTMLInputElement>()
const previewImage = ref('')
const uploadedFilePath = ref('')
const selectedFile = ref<File | null>(null)
// 助手资产配置
const assistantAssets = ref<AssistantAssets>({
  assistantName: '',
  characterImages: '',
  live2d: {
    modelPath: '',
    modelJsonPath: ''
  }
})

// 文件上传相关引用
const characterImageInput = ref<HTMLInputElement>()
const live2dModelInput = ref<HTMLInputElement>()
const selectedCharacterImages = ref<File[]>([])
const selectedLive2dModel = ref<File | null>(null)

// 表单数据
const formData = ref<AssistantInfo>(createNullAssistant())

// Live2D模型信息
const live2dModelInfo = ref({
  name: '',
  path: '',
  size: 0,
  progress: 0
})

/**
 * 创建一个空的助手信息对象
 * @returns 空的助手信息对象
 */
function createNullAssistant(): AssistantInfo {
  return {
    name: '',
    user: '',
    avatar: '',
    birthday: new Date().toISOString().split('T')[0],
    height: 0,
    weight: 0,
    description: '',
    firstMeetTime: 0,
    love: 0,
    personality: '',
    messageExamples: [],
    extraDescription: '',
    updatedAt: 0,
    assetsLastModified: 0,
    mask: '',
    customPrompt: '',
    startWith: [],
    settings: {
      enableLongMemory: true,
      enableLongMemorySearchEnhance: true,
      enableCoreMemory: true,
      longMemoryThreshold: 0.38,
      enableLoreBooks: true,
      loreBooksThreshold: 0.5,
      loreBooksDepth: 3,
      enableEmotionSystem: false,
      enableEmotionPersist: false,
      contextLength: 40
    },
    gsvSetting: {
      textLang: '',
      gptModelPath: '',
      sovitsModelPath: '',
      refAudioPath: '',
      promptText: '',
      promptLang: '',
      seed: -1,
      topK: 30,
      batchSize: 20,
      extra: {
        text_split_method: 'cut0'
      },
      extraRefAudio: {}
    },
    emotionSetting: {}
  }
}

// 重置表单
function resetForm(): void {
  formData.value = createNullAssistant()
  // 扩展资产管理相关字段
  assistantAssets.value = {
    assistantName: '',
    characterImages: '',
    live2d: {
      modelPath: '',
      modelJsonPath: ''
    }
  }

  previewImage.value = ''
  uploadedFilePath.value = ''
  selectedFile.value = null
  selectedCharacterImages.value = []
  selectedLive2dModel.value = null
  live2dModelInfo.value = {
    name: '',
    path: '',
    size: 0,
    progress: 0
  }
  if (fileInput.value) {
    fileInput.value.value = ''
  }
  if (characterImageInput.value) {
    characterImageInput.value.value = ''
  }
  if (live2dModelInput.value) {
    live2dModelInput.value.value = ''
  }
}

// 监听编辑助手数据变化
watch(
  () => props.editingAssistant,
  async (newAssistant) => {
    if (newAssistant) {
      // 设置表单数据为编辑的助手信息
      formData.value = {
        ...newAssistant,
        // 确保嵌套对象正确初始化
        settings: { ...newAssistant.settings },
        gsvSetting: { ...newAssistant.gsvSetting },
        startWith: [...(newAssistant.startWith || [])],
        messageExamples: [...(newAssistant.messageExamples || [])]
      }

      // 如果有头像，设置预览
      if (newAssistant.avatar) {
        // 尝试使用 app-resource 协议加载头像
        previewImage.value = `app-resource://${newAssistant.avatar}`
      } else {
        previewImage.value = ''
      }

      // 加载助手资产配置
      const assets = await assistantManager.getAssistantAssetsByName(newAssistant.name)

      if (assets) {
        assistantAssets.value = assets
        // 更新Live2D模型信息
        if (assets.live2d) {
          const modelName = assets.live2d.modelPath.split('/').pop() || ''
          live2dModelInfo.value = {
            name: modelName,
            path: assets.live2d.modelPath,
            size: 0,
            progress: 100
          }
        }
      } else {
        // 设置默认值
        assistantAssets.value = {
          assistantName: newAssistant.name,
          characterImages: '',
          live2d: {
            modelPath: '',
            modelJsonPath: ''
          }
        }
        live2dModelInfo.value = {
          name: '',
          path: '',
          size: 0,
          progress: 0
        }
      }
    } else {
      resetForm()
    }
  },
  { immediate: true, deep: true }
)

// 监听导入角色卡状态变化
watch(
  () => props.isImportFromCard,
  (isImport) => {
    if (isImport && !props.editingAssistant) {
      // 当从角色卡导入时，自动触发文件选择
      setTimeout(() => {
        triggerCharacterCardImport()
      }, 100)
    }
  },
  { immediate: true }
)

// 工具函数
// 添加开场白
const addStartWith = (): void => {
  formData.value.startWith.push('')
}

// 移除开场白
const removeStartWith = (index: number): void => {
  formData.value.startWith.splice(index, 1)
}

// 添加对话案例
const addMessageExample = (): void => {
  formData.value.messageExamples.push('')
}

// 移除对话案例
const removeMessageExample = (index: number): void => {
  formData.value.messageExamples.splice(index, 1)
}

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 读取文件为 ArrayBuffer
function readFileAsBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (event) => {
      const arrayBuffer = event.target?.result as ArrayBuffer
      resolve(arrayBuffer)
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}
// 具体逻辑
// 触发头像文件选择
const triggerFileInput = (): void => {
  if (!isSubmitting.value) {
    fileInput.value?.click()
  }
}

// 处理头像文件选择 - 只保存文件信息
const handleAvatarFileSelect = async (event: Event): Promise<void> => {
  const input = event.target as HTMLInputElement
  if (input.files && input.files[0]) {
    const file = input.files[0]

    // 创建预览
    const reader = new FileReader()
    reader.onload = (e) => {
      previewImage.value = e.target?.result as string
    }
    reader.readAsDataURL(file)

    // 仅保存文件信息，不立即上传
    selectedFile.value = file
  }
}

// 移除头像
const removeAvatar = (): void => {
  previewImage.value = ''
  uploadedFilePath.value = ''
  formData.value.avatar = ''
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

// 触发角色立绘上传
const triggerCharacterImageUpload = (): void => {
  if (!isSubmitting.value) {
    characterImageInput.value?.click()
  }
}

// 处理角色立绘选择 - 只保存文件信息
const handleCharacterImageSelect = async (event: Event): Promise<void> => {
  const input = event.target as HTMLInputElement
  if (input.files && input.files.length > 0) {
    const files = Array.from(input.files)
    selectedCharacterImages.value = [...files]

    // 只创建预览，不立即上传
    if (files.length > 0) {
      const reader = new FileReader()
      reader.onload = (e) => {
        // 这里可以设置预览，但不上传
        assistantAssets.value.characterImages = e.target?.result as string
      }
      reader.readAsDataURL(files[0])
    }
  }
}

// 移除角色立绘
const removeCharacterImage = (): void => {
  assistantAssets.value.characterImages = ''
}

// 触发Live2D模型上传
const triggerLive2dModelUpload = (): void => {
  if (!isSubmitting.value) {
    live2dModelInput.value?.click()
  }
}

// 处理Live2D模型选择 - 只保存文件信息
const handleLive2dModelSelect = async (event: Event): Promise<void> => {
  const input = event.target as HTMLInputElement
  if (input.files && input.files[0]) {
    const file = input.files[0]
    selectedLive2dModel.value = file

    // 更新模型信息，但不立即上传
    live2dModelInfo.value = {
      name: file.name,
      path: 'selected', // 设置一个临时路径值，表示已选择但未上传
      size: file.size,
      progress: 0
    }
  }
}

// 移除Live2D模型
const removeLive2dModel = (): void => {
  assistantAssets.value.live2d = {
    modelPath: '',
    modelJsonPath: ''
  }

  live2dModelInfo.value = {
    name: '',
    path: '',
    size: 0,
    progress: 0
  }

  selectedLive2dModel.value = null
}

// 上传头像
const uploadAvatar = async (): Promise<boolean> => {
  if (!selectedFile.value || !formData.value.name) {
    return true // 如果没有选择文件，认为上传成功
  }

  try {
    const fileBuffer = await readFileAsBuffer(selectedFile.value)

    // 调用IPC保存文件
    const saveResult = await window.api.saveAssistantImageFile(
      fileBuffer,
      formData.value.name,
      'avatar'
    )

    if (saveResult.success) {
      uploadedFilePath.value = saveResult.path
      formData.value.avatar = saveResult.path
      return true
    } else {
      console.error('头像上传失败:', saveResult.error)
      return false
    }
  } catch (error) {
    // 获取详细的错误信息
    const errorMessage = error instanceof Error ? error.message : '操作失败'
    console.error('头像上传异常:', errorMessage)
    return false
  }
}

// 上传角色立绘
const uploadCharacterImages = async (): Promise<boolean> => {
  if (!selectedCharacterImages.value.length) {
    return true // 如果没有选择文件，认为上传成功
  }

  try {
    for (const file of selectedCharacterImages.value) {
      const arrayBuffer = await readFileAsBuffer(file)
      const fileName = `illustration`

      const result = await window.api.saveAssistantImageFile(
        arrayBuffer,
        formData.value.name,
        fileName
      )

      if (result.success) {
        assistantAssets.value.characterImages = 'app-resource://' + result.path
      } else {
        console.error('角色立绘上传失败:', result.error)
        return false
      }
    }
    return true
  } catch (error) {
    // 获取详细的错误信息
    const errorMessage = error instanceof Error ? error.message : '操作失败'
    console.error('角色立绘上传异常:', errorMessage)
    return false
  }
}

// 上传Live2D模型
const uploadLive2dModel = async (): Promise<boolean> => {
  if (!selectedLive2dModel.value) {
    return true // 如果没有选择文件，认为上传成功
  }

  try {
    const file = selectedLive2dModel.value
    const arrayBuffer = await readFileAsBuffer(file)

    // 设置进度监听
    window.api.ipcRenderer.on('assistant:live2d-extract-progress', (progress: number) => {
      live2dModelInfo.value.progress = progress
    })

    try {
      // 上传并解压模型
      const result = await window.api.saveAndExtractLive2DModel(
        arrayBuffer,
        formData.value.name || assistantAssets.value.assistantName
      )

      if (result.success) {
        // 更新资产配置
        assistantAssets.value.live2d = {
          modelPath: result.path || '',
          modelJsonPath: result.mainJsonPath || ''
        }

        live2dModelInfo.value.path = result.path || ''
        live2dModelInfo.value.progress = 100
        return true
      } else {
        console.error('Live2D模型上传失败:', result.error)
        live2dModelInfo.value.progress = 0
        return false
      }
    } finally {
      // 移除进度监听
      window.api.ipcRenderer.removeAllListeners('assistant:live2d-extract-progress')
    }
  } catch (error) {
    // 获取详细的错误信息
    const errorMessage = error instanceof Error ? error.message : '操作失败'
    console.error('Live2D模型上传异常:', errorMessage)
    live2dModelInfo.value.progress = 0
    return false
  }
}

// 保存助手资产配置
const saveAssistantAssets = async (): Promise<boolean> => {
  if (formData.value.name) {
    assistantAssets.value.assistantName = formData.value.name
    const assets = JSON.parse(JSON.stringify(assistantAssets.value))
    const saveResult = await assistantManager.saveAssistantAssets(assets)
    return saveResult
  }
  return false
}

// 从角色卡片导入助手信息
const handleCharacterCardFileSelected = async (event: Event): Promise<void> => {
  try {
    const input = event.target as HTMLInputElement
    if (!input.files || input.files.length === 0) {
      return
    }

    const file = input.files[0]

    // 调用API从图片中提取信息
    const importResult = await window.api.importAssistantFromCard(await file.arrayBuffer())

    if (importResult.success) {
      const importData = importResult.data.data
      // 填充表单数据
      formData.value.name = importData.name || formData.value.name
      formData.value.extraDescription =
        importData.extraDescription || formData.value.extraDescription

      formData.value.messageExamples = importData.messageExamples || formData.value.messageExamples
      formData.value.startWith = importData.startWith || formData.value.startWith
      // 将事件传递给头像文件选择处理函数
      handleAvatarFileSelect(event)

      notificationService.success('角色信息导入成功！')
    } else {
      console.error(`导入失败: ${importResult.error || '未知错误'}`)
    }
  } catch (error) {
    console.error('导入角色卡片失败:', error)
  }
}

// 触发角色卡导入
function triggerCharacterCardImport(): void {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.png,.jpg,.jpeg'
  input.onchange = async (event) => {
    await handleCharacterCardFileSelected(event)
  }
  input.click()
}

// 表单验证函数
const validateForm = (): boolean => {
  const missingFields: string[] = []

  // 检查基本信息中的必填字段
  if (!formData.value.name?.trim()) {
    missingFields.push('名字')
  }
  if (!formData.value.height) {
    missingFields.push('身高')
  }
  if (!formData.value.weight) {
    missingFields.push('体重')
  }
  if (!formData.value.birthday) {
    missingFields.push('生日')
  }

  // 检查语音设置中的必填字段
  if (!formData.value.gsvSetting.refAudioPath?.trim()) {
    missingFields.push('参考音频')
  }
  if (!formData.value.gsvSetting.promptText?.trim()) {
    missingFields.push('参考文本')
  }

  if (!formData.value.gsvSetting.textLang?.trim()) {
    missingFields.push('输出语音语言')
  }

  // 检查文本设置中的必填字段
  if (!formData.value.gsvSetting.textLang?.trim()) {
    missingFields.push('参考语音语言')
  }

  // 如果有未填写的必填字段，显示提示
  if (missingFields.length > 0) {
    notificationService.error(`请填写以下必填字段：\n${missingFields.join('、')}`)
    return false
  }

  return true
}

// 提交表单
const handleSubmit = async (): Promise<void> => {
  // 检查助手名称是否为空或提交状态为true
  if (!formData.value.name || isSubmitting.value) {
    return
  }

  // 调用表单验证函数
  if (!validateForm()) {
    return
  }

  try {
    // 设置提交状态为true，显示加载动画
    isSubmitting.value = true

    // 按顺序上传所有资源，如果任何上传失败则中断
    console.log('开始上传资源...')

    // 1. 上传头像
    if (!(await uploadAvatar())) {
      console.error('头像上传失败，取消提交')
      return
    }

    // 2. 上传角色立绘
    if (!(await uploadCharacterImages())) {
      console.error('角色立绘上传失败，取消提交')
      return
    }

    // 3. 上传Live2D模型
    if (!(await uploadLive2dModel())) {
      console.error('Live2D模型上传失败，取消提交')
      return
    }

    // 4. 保存资产配置
    if (!(await saveAssistantAssets())) {
      console.error('保存资产配置失败，取消提交')
      return
    }

    // 处理日期格式
    const processedFormData = {
      ...formData.value,
      birthday: new Date(formData.value.birthday).toISOString().split('T')[0]
    }
    // 将响应式数据转换为普通JavaScript对象
    const plainProcessedFormData = JSON.parse(JSON.stringify(processedFormData))

    if (isEditMode.value && props.editingAssistant) {
      // 编辑模式：更新助手信息
      const updatedAssistant: AssistantInfo = {
        ...props.editingAssistant,
        ...plainProcessedFormData,
        updatedAt: Date.now()
      }

      // 更新助手信息
      const updateResult = await assistantManager.updateAssistant(updatedAssistant)
      if (updateResult.success) {
        notificationService.success('助手信息更新成功')
        emit('success')
        // 关闭对话框并重置表单
        emit('update:modelValue', false)
      } else {
        notificationService.error(`更新助手失败: ${updateResult.error}`)
      }
    } else {
      // 添加模式：创建新助手
      const assistantInfo: AssistantInfo = {
        ...plainProcessedFormData,
        firstMeetTime: new Date().getTime(),
        love: 0,
        updatedAt: Date.now(),
        assetsLastModified: Date.now()
      }

      // 添加新助手
      const addStatus = await assistantManager.addAssistant(assistantInfo)
      if (addStatus) {
        notificationService.success('助手添加成功')
        emit('success')
        // 关闭对话框并重置表单
        emit('update:modelValue', false)
      }
    }
  } catch (error) {
    // 获取详细的错误信息
    const errorMessage = error instanceof Error ? error.message : '操作失败'
    console.error(isEditMode.value ? '更新助手失败:' : '添加助手失败:', errorMessage)
  } finally {
    // 无论成功或失败，都将提交状态设为false
    isSubmitting.value = false
  }
}

// 取消操作
const handleCancel = (): void => {
  if (!isSubmitting.value) {
    emit('cancel')
    emit('update:modelValue', false)
  }
}
</script>

<style scoped>
/* 保持原有的样式不变 */
.add-assistant-dialog {
  width: 600px;
  height: 80vh;
  padding: 30px;
  border-radius: 15px;
  overflow-y: auto;
  scrollbar-width: none;
}

.add-assistant-title {
  font-size: 27px;
  font-weight: bold;
  color: #fb7299;
  text-align: start;
  margin-bottom: 5px;
}

.add-assistant-tips {
  font-size: 16px;
  color: #666;
  text-align: start;
  margin-bottom: 20px;
}

/* 选项卡样式 */
.tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  border-bottom: 2px solid #e0e0e0;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 10px 20px;
  background: none;
  border: none;
  border-bottom: 3px solid transparent;
  font-size: 14px;
  color: #666;
  cursor: pointer;
  transition: all 0.3s;
}

.tab-btn:hover {
  color: #fb7299;
}

.tab-btn.active {
  color: #fb7299;
  border-bottom-color: #fb7299;
  font-weight: 500;
}

.add-assistant-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* 添加SettingView风格的设置项样式 */
.divider {
  width: 100%;
  height: 1px;
  background-color: #e0e0e0;
  margin-top: 10px;
  margin-bottom: 10px;
}

.setting-item {
  display: flex;
  background-color: white;
  border-radius: 15px;
  padding: 20px;
  flex-direction: column;
  margin-bottom: 20px;
  margin-top: 10px;
}

.setting-item h4 {
  margin: 0 0 15px 0;
  color: #333;
  font-size: 16px;
}

.setting-from {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.setting-from .title {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  flex: 1;
  margin-right: 20px;
}

.setting-from .title label {
  font-weight: 500;
  color: #333;
  font-size: 14px;
}

.setting-from .title .description {
  font-size: 12px;
  color: gray;
  margin-top: 4px;
}

.setting-from input,
.setting-from select {
  width: auto;
  max-width: 200px;
  padding: 10px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.setting-from input:focus,
.setting-from select:focus {
  outline: none;
  border-color: #fb7299;
}

/* 头像上传区域样式 */
.avatar-upload-section {
  width: 150px;
  height: auto;
}

.avatar-upload-section label {
  font-weight: 500;
  color: #333;
  font-size: 14px;
}

.avatar-upload-container {
  display: flex;
  align-items: center;
}

.avatar-preview,
.avatar-placeholder {
  width: 150px;
  height: 200px;
  border-radius: 20px;
  border: 2px solid rgb(218, 218, 218);
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  background-size: cover;
  background-position: center;
  cursor: pointer;
}

.avatar-placeholder {
  background-color: #f9f9f9;
  color: #999;
  flex-direction: column;
  gap: 10px;
}

.avatar-placeholder font-awesome-icon {
  font-size: 36px;
}

.avatar-placeholder p {
  margin: 0;
  font-size: 14px;
}

.remove-avatar {
  position: absolute;
  top: -10px;
  right: -10px;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background-color: #ff4757;
  color: white;
  border: none;
  font-size: 20px;
  cursor: pointer;
  display: flex;
  justify-content: center;
  align-items: center;
}

.form-group {
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
}

.form-group label {
  margin-top: 20px;
  margin-bottom: 4px;
  font-weight: 500;
  color: #333;
  font-size: 14px;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #fb7299;
}

.form-group textarea {
  resize: vertical;
}

.form-row {
  display: flex;
  gap: 15px;
  margin: 0;
}

.form-row label {
  margin: 0;
}

.half-width {
  flex: 1;
}

.settings-section h4 {
  margin: 0 0 15px 0;
  color: #333;
  font-size: 16px;
}

/* 开场白样式 */
.message-examples {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.example-item {
  position: relative;
}

.example-item textarea {
  padding-right: 30px;
}

.remove-example {
  position: absolute;
  top: 5px;
  right: 5px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background-color: #ff4757;
  color: white;
  border: none;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  justify-content: center;
  align-items: center;
}

.add-example {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px;
  background: none;
  border: 2px dashed #e0e0e0;
  border-radius: 8px;
  color: #666;
  cursor: pointer;
  transition: all 0.3s;
}

.add-example:hover {
  border-color: #fb7299;
  color: #fb7299;
}

.form-actions {
  display: flex;
  gap: 15px;
  justify-content: flex-end;
  margin-top: 20px;
}

.cancel-btn,
.submit-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.cancel-btn {
  background: #f5f5f5;
  color: #666;
}

.cancel-btn:hover {
  background: #e0e0e0;
}

.submit-btn {
  background: var(--theme-color, #fb7299);
  color: white;
}

.submit-btn:hover {
  background: var(--theme-color-light, #ff97b3);
}

.submit-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

/* 加载动画样式 */
.loading-spinner {
  display: flex;
  align-items: center;
  gap: 8px;
}

.loading-spinner font-awesome-icon {
  animation: spin 1s linear infinite;
  font-size: 16px;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

/* 资产管理相关样式 */
.asset-upload-section {
  margin-bottom: 24px;
}

.asset-item {
  margin-bottom: 16px;
}

.upload-container {
  position: relative;
  margin-top: 8px;
}

.upload-placeholder {
  color: #626262;
  border: 2px dashed #ccc;
  border-radius: 8px;
  padding: 32px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
}

.upload-placeholder:hover {
  border-color: #90caf9;
  background-color: #f5f5f5;
}

.upload-placeholder i {
  font-size: 32px;
  margin-bottom: 8px;
  color: #999;
}

.upload-placeholder p {
  margin: 0;
  color: #666;
}

.upload-placeholder small {
  display: block;
  margin-top: 8px;
  color: #999;
  font-size: 12px;
}

.asset-preview-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px;
}

.image-preview-item {
  position: relative;
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
}

.image-preview {
  width: 100%;
  height: 120px;
  background-size: cover;
  background-position: center;
}

.image-info {
  padding: 8px;
  font-size: 12px;
  text-align: center;
  background-color: #f5f5f5;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-info-item {
  display: flex;
  margin-bottom: 8px;
}

.info-label {
  font-size: 16px;
  font-weight: bold;
  margin-right: 8px;
  min-width: 100px;
}

.info-value {
  font-size: 15px;
}

.upload-progress {
  margin: 12px 0;
}

.progress-bar {
  height: 8px;
  background-color: #f0f0f0;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 4px;
}

.progress-fill {
  height: 100%;
  background-color: #4caf50;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 12px;
  color: #666;
  text-align: right;
}

.live2d-model-info {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: row;
  gap: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 12px;
  background-color: #f9f9f9;
  transition: all 0.3s ease;
}

.live2d-model-info:hover {
  border: 1px solid var(--theme-color-light);
  box-shadow: 0 2px 10px var(--theme-color-shadow);
}

.model-icon-container {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: #f0f0f0;
  margin: 30px 20px;
}

.upload-placeholder {
  border: 2px dashed #d9d9d9;
  border-radius: 4px;
  padding: 24px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  background-color: #fafafa;
}

.upload-placeholder:hover {
  color: var(--theme-color-light);
  border-color: var(--theme-color-light);
  background-color: white;
}

.remove-asset {
  flex-shrink: 0;
  background-color: #ff4d4f;
  color: white;
  border: none;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: auto;
  transition: background-color 0.3s ease;
}

.remove-asset:hover {
  background-color: #ff7875;
}
</style>
