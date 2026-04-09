export interface ServerConfig {
  SV: {
    enable: boolean
    master_audio: string
    thr: number | null
  }
  LLM: {
    api: string
    key: string
    model: string
    extra_config: {
      enable_thinking: boolean
    }
  }
  ChatLLM: {
    api: string
    key: string
    model: string
    extra_config: {
      enable_thinking: boolean
    }
  }
  SLM: {
    api: string
    key: string | null
    model: string
    extra_config: {
      temperature: number
      stream: boolean
    }
  }
  TTS: {
    mode: string
    gptsovits_lite: {
      use_bert: boolean
      use_flash_attn: boolean
    }
    gptsovits: {
      api: string
    }
  }
  WakeWord: {
    enable: boolean
    provider: string
    keywords_score: number
    keywords_threshold: number
  }
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export const createDefaultServerConfig = (): ServerConfig => ({
  SV: {
    enable: false,
    master_audio: '',
    thr: null
  },
  LLM: {
    api: '',
    key: '',
    model: '',
    extra_config: {
      enable_thinking: false
    }
  },
  ChatLLM: {
    api: '',
    key: '',
    model: '',
    extra_config: {
      enable_thinking: false
    }
  },
  SLM: {
    api: '',
    key: null,
    model: '',
    extra_config: {
      temperature: 0,
      stream: false
    }
  },
  TTS: {
    mode: '',
    gptsovits_lite: {
      use_bert: false,
      use_flash_attn: false
    },
    gptsovits: {
      api: ''
    }
  },
  WakeWord: {
    enable: false,
    provider: '',
    keywords_score: 0,
    keywords_threshold: 0
  }
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mergeServerConfig<T extends Record<string, any>>(
  baseConfig: T,
  patchConfig: Record<string, unknown>
): T {
  const mergedConfig: Record<string, unknown> = { ...baseConfig }

  for (const [key, value] of Object.entries(patchConfig)) {
    if (value === undefined) {
      continue
    }

    const existingValue = mergedConfig[key]
    if (isPlainObject(existingValue) && isPlainObject(value)) {
      mergedConfig[key] = mergeServerConfig(existingValue, value)
      continue
    }

    mergedConfig[key] = value
  }

  return mergedConfig as T
}

export function normalizeServerConfig(config: unknown): ServerConfig {
  if (!isPlainObject(config)) {
    return createDefaultServerConfig()
  }

  return mergeServerConfig(createDefaultServerConfig(), config)
}
