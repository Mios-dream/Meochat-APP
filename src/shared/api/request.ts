import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios'

let baseUrl = 'http://127.0.0.1:8001'

export interface ExtendedAxiosInstance extends AxiosInstance {
  stream: <T = unknown>(
    url: string,
    body: unknown,
    onChunk: (chunk: T) => void,
    options?: { signal?: AbortSignal }
  ) => Promise<void>
}

/**
 * 更新请求基地址
 * @param url - 新的基地址
 */
export function setBaseUrl(url: string): void {
  baseUrl = url || baseUrl
}

/**
 * 获取当前请求基地址
 */
export function getBaseUrl(): string {
  return baseUrl
}

/**
 * 创建配置好的 axios 实例
 * @param config - 额外的 axios 配置
 */
export function createRequest(config?: AxiosRequestConfig): ExtendedAxiosInstance {
  const instance = axios.create({
    timeout: 30000,
    headers: { 'Content-Type': 'application/json' },
    ...config
  }) as ExtendedAxiosInstance

  // 请求拦截器：自动注入 baseURL
  instance.interceptors.request.use(
    (config) => {
      config.baseURL = baseUrl
      return config
    },
    (error) => Promise.reject(error)
  )

  // 响应拦截器：统一错误处理
  instance.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      return Promise.reject(error)
    }
  )

  /** 发起 SSE 流式请求，自动注入 baseURL 并解析 data: 格式的 JSON 行 */
  instance.stream = async <T>(
    url: string,
    body: unknown,
    onChunk: (chunk: T) => void,
    options?: { signal?: AbortSignal }
  ): Promise<void> => {
    const response = await fetch(new URL(url, baseUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: options?.signal
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split(/\r?\n/)
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed === '[DONE]') continue
          if (!trimmed.startsWith('data:') && !trimmed.startsWith('{')) continue

          const jsonStr = trimmed.startsWith('data:') ? trimmed.replace(/^data:\s*/, '') : trimmed

          try {
            onChunk(JSON.parse(jsonStr) as T)
          } catch {
            // 跳过格式异常的行
          }
        }
      }

      // 刷新缓冲区末尾可能残留的完整行
      const pending = buffer.trim()
      if (pending && pending !== '[DONE]') {
        const jsonStr = pending.startsWith('data:') ? pending.replace(/^data:\s*/, '') : pending
        try {
          onChunk(JSON.parse(jsonStr) as T)
        } catch {
          // 跳过格式异常的行
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  return instance
}

/** 默认请求实例 */
export const request = createRequest()
