<template>
  <BlurModal
    :model-value="modelValue"
    :modal-class="'server-config-modal'"
    :close-on-click-outside="!isSaving"
    :show-close-button="true"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="server-config-dialog">
      <div class="dialog-header">
        <div>
          <div class="dialog-title">服务器配置</div>
          <div class="dialog-subtitle">可视化编辑服务端配置项</div>
        </div>
      </div>

      <div class="dialog-body">
        <section class="config-section">
          <div class="section-header">
            <h3>SV</h3>
            <span class="section-badge">声纹识别</span>
          </div>
          <div class="section-grid">
            <div class="field-card">
              <label class="field-label">服务运行状态</label>
              <div class="field-description">是否启用声纹识别</div>
              <ToggleSwitch
                :model-value="localConfig.SV.enable"
                @update:model-value="localConfig.SV.enable = $event"
              />
            </div>

            <div class="field-card">
              <label class="field-label">音频文件</label>
              <div class="field-description">用于声纹识别的音频文件路径</div>
              <SimpleInput
                v-model="localConfig.SV.master_audio"
                class="input-container"
                placeholder="test.wav"
              />
            </div>

            <div class="field-card">
              <label class="field-label">阈值 thr</label>
              <div class="field-description">留空表示不启用阈值</div>
              <SimpleInput
                type="number"
                class="input-container"
                :model-value="localConfig.SV.thr ?? ''"
                placeholder="留空表示 null"
                @update:model-value="updateNullableNumber((value) => (localConfig.SV.thr = value))"
              />
            </div>
          </div>
        </section>

        <section class="config-section">
          <div class="section-header">
            <h3>LLM</h3>
            <span class="section-badge">通用任务模型</span>
          </div>
          <div class="section-grid two-column">
            <div class="field-card">
              <label class="field-label">API 地址</label>
              <div class="field-description">用于 LLM 请求的接口地址</div>
              <SimpleInput
                v-model="localConfig.LLM.api"
                class="input-container"
                placeholder="https://.../v1"
              />
            </div>

            <div class="field-card">
              <label class="field-label">模型名称</label>
              <div class="field-description">例如 qwen3.5-plus</div>
              <SimpleInput
                v-model="localConfig.LLM.model"
                class="input-container"
                placeholder="qwen3.5-plus"
              />
            </div>

            <div class="field-card">
              <label class="field-label">API Key</label>
              <div class="field-description">大模型服务密钥</div>
              <SimpleInput
                v-model="localConfig.LLM.key"
                class="input-container"
                placeholder="输入密钥"
              />
            </div>

            <div class="field-card">
              <label class="field-label">思考模式</label>
              <div class="field-description">启用后会开启 enable_thinking</div>
              <ToggleSwitch
                :model-value="localConfig.LLM.extra_config.enable_thinking"
                @update:model-value="localConfig.LLM.extra_config.enable_thinking = $event"
              />
            </div>
          </div>
        </section>

        <section class="config-section">
          <div class="section-header">
            <h3>ChatLLM</h3>
            <span class="section-badge">对话模型</span>
          </div>
          <div class="section-grid two-column">
            <div class="field-card">
              <label class="field-label">API 地址</label>
              <div class="field-description">用于对话场景的接口地址</div>
              <SimpleInput
                v-model="localConfig.ChatLLM.api"
                class="input-container"
                placeholder="https://.../v1"
              />
            </div>

            <div class="field-card">
              <label class="field-label">模型名称</label>
              <div class="field-description">例如 qwen-flash-character</div>
              <SimpleInput
                v-model="localConfig.ChatLLM.model"
                class="input-container"
                placeholder="qwen-flash-character"
              />
            </div>

            <div class="field-card">
              <label class="field-label">API Key</label>
              <div class="field-description">对话模型密钥</div>
              <SimpleInput
                v-model="localConfig.ChatLLM.key"
                class="input-container"
                placeholder="输入密钥"
              />
            </div>

            <div class="field-card">
              <label class="field-label">思考模式</label>
              <div class="field-description">启用后会开启 enable_thinking</div>
              <ToggleSwitch
                :model-value="localConfig.ChatLLM.extra_config.enable_thinking"
                @update:model-value="localConfig.ChatLLM.extra_config.enable_thinking = $event"
              />
            </div>
          </div>
        </section>

        <section class="config-section">
          <div class="section-header">
            <h3>TTS</h3>
            <span class="section-badge">语音合成</span>
          </div>
          <div class="section-grid two-column">
            <div class="field-card">
              <label class="field-label">模式</label>
              <div class="field-description">例如 local</div>
              <SimpleInput
                v-model="localConfig.TTS.mode"
                class="input-container"
                placeholder="local"
              />
            </div>

            <div class="field-card">
              <label class="field-label">GPT-SoVITS Lite</label>
              <div class="field-description">保持当前开关状态</div>
              <div class="inline-toggle-group">
                <div class="inline-toggle-item">
                  <span>use_bert</span>
                  <ToggleSwitch
                    :model-value="localConfig.TTS.gptsovits_lite.use_bert"
                    @update:model-value="localConfig.TTS.gptsovits_lite.use_bert = $event"
                  />
                </div>
                <div class="inline-toggle-item">
                  <span>use_flash_attn</span>
                  <ToggleSwitch
                    :model-value="localConfig.TTS.gptsovits_lite.use_flash_attn"
                    @update:model-value="localConfig.TTS.gptsovits_lite.use_flash_attn = $event"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="config-section">
          <div class="section-header">
            <h3>GSV</h3>
            <span class="section-badge">语音接口</span>
          </div>
          <div class="section-grid">
            <div class="field-card">
              <label class="field-label">API 地址</label>
              <div class="field-description">GSV 语音接口地址</div>
              <SimpleInput
                v-model="localConfig.TTS.gptsovits.api"
                class="input-container"
                placeholder="http://127.0.0.1:9880/tts"
              />
            </div>
          </div>
        </section>
      </div>

      <div class="dialog-footer">
        <button
          class="footer-button secondary"
          type="button"
          :disabled="isSaving"
          @click="closeDialog"
        >
          取消
        </button>
        <button
          class="footer-button primary"
          type="button"
          :disabled="isSaving"
          @click="submitConfig"
        >
          {{ isSaving ? '保存中...' : '保存配置' }}
        </button>
      </div>
    </div>
  </BlurModal>
</template>

<script setup lang="ts">
import BlurModal from './BlurModal.vue'
import SimpleInput from './SimpleInput.vue'
import ToggleSwitch from './ToggleSwitch.vue'
import { computed, ref, watch } from 'vue'
import { normalizeServerConfig } from '../types/serverConfig'
import type { ServerConfig } from '../types/serverConfig'

interface Props {
  modelValue: boolean
  config: ServerConfig | null
  isSaving?: boolean
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'close'): void
  (e: 'submit', value: ServerConfig): void
}

const props = withDefaults(defineProps<Props>(), {
  isSaving: false
})

const emit = defineEmits<Emits>()

const localConfig = ref<ServerConfig>(normalizeServerConfig(props.config))

watch(
  () => props.config,
  (value) => {
    localConfig.value = normalizeServerConfig(value)
  },
  { immediate: true, deep: true }
)

const isSaving = computed(() => props.isSaving)

const closeDialog = (): void => {
  emit('update:modelValue', false)
  emit('close')
}

const submitConfig = (): void => {
  emit('submit', localConfig.value)
}

// const updateNullableString = (setter: (value: string | null) => void) => {
//   return (value: string | number): void => {
//     const text = String(value).trim()
//     setter(text ? text : null)
//   }
// }

const updateNullableNumber = (setter: (value: number | null) => void) => {
  return (value: string | number): void => {
    const text = String(value).trim()
    if (!text) {
      setter(null)
      return
    }

    const parsedValue = Number(text)
    if (Number.isFinite(parsedValue)) {
      setter(parsedValue)
    }
  }
}

// const updateNumber = (setter: (value: number) => void) => {
//   return (value: string | number): void => {
//     const parsedValue = Number(String(value))
//     if (Number.isFinite(parsedValue)) {
//       setter(parsedValue)
//     }
//   }
// }
</script>

<style scoped>
.input-container {
  max-width: 200px;
}

.server-config-dialog {
  width: min(960px, 88vw);
  max-height: 82vh;
  display: flex;
  flex-direction: column;
  padding: 20px;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 18px;
}

.dialog-title {
  font-size: 26px;
  font-weight: 700;
  color: #fb7299;
}

.dialog-subtitle {
  margin-top: 6px;
  color: #7b7b7b;
  font-size: 13px;
}

.header-close-button {
  border: 0;
  border-radius: 999px;
  padding: 8px 16px;
  background: rgba(251, 114, 153, 0.12);
  color: #fb7299;
  cursor: pointer;
  transition: all 0.2s ease;
}

.header-close-button:hover:not(:disabled) {
  background: rgba(251, 114, 153, 0.2);
}

.header-close-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.dialog-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  padding-right: 8px;
  scrollbar-width: none;
}

.config-section {
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(251, 114, 153, 0.12);
  border-radius: 20px;
  padding: 18px;
  box-shadow: 0 10px 24px rgba(251, 114, 153, 0.05);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.section-header h3 {
  margin: 0;
  font-size: 18px;
  color: #333;
}

.section-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 5px 10px;
  border-radius: 999px;
  background: rgba(251, 114, 153, 0.12);
  color: #fb7299;
  font-size: 12px;
}

.section-grid {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 14px;
}

.section-grid.two-column {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.field-card {
  background: #fff;
  border-radius: 16px;
  padding: 14px;
  border: 1px solid rgba(0, 0, 0, 0.06);
}

.field-label {
  display: block;
  font-size: 15px;
  font-weight: 600;
  color: #4a4a4a;
  margin-bottom: 6px;
}

.field-description {
  color: #8a8a8a;
  font-size: 12px;
  margin-bottom: 10px;
}

.readonly-value {
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(251, 114, 153, 0.08);
  color: #7a7a7a;
  font-size: 13px;
}

.inline-toggle-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.inline-toggle-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: #4a4a4a;
  font-size: 14px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin: 18px;
}

.footer-button {
  border: 0;
  border-radius: 999px;
  padding: 10px 18px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s ease;
}

.footer-button.secondary {
  background: rgba(251, 114, 153, 0.08);
  color: #fb7299;
}

.footer-button.secondary:hover:not(:disabled) {
  background: rgba(251, 114, 153, 0.14);
}

.footer-button.primary {
  background: linear-gradient(90deg, #fca9c2, #fb7299);
  color: white;
}

.footer-button.primary:hover:not(:disabled) {
  transform: translateY(-1px);
}

.footer-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  transform: none;
}

@media (max-width: 900px) {
  .server-config-dialog {
    width: min(96vw, 960px);
  }

  .section-grid.two-column {
    grid-template-columns: 1fr;
  }

  .dialog-footer {
    flex-direction: column-reverse;
  }

  .footer-button {
    width: 100%;
  }
}
</style>
