import { request } from '@shared/api/request'

export interface DiaryRecord {
  day: string
  summary: string
  facts: string
  dayLastTimestamp: string
  dayLastTimestampSec: number
}

interface DiaryApiResponse {
  msg?: string
  assistant?: string
  limit?: number
  offset?: number
  startDay?: string | null
  endDay?: string | null
  count?: number
  total?: number
  data?: Array<{
    day?: string
    summary?: string
    facts?: string
    dayLastTimestamp?: string
    dayLastTimestampSec?: number
  }>
}

export class DiarySystem {
  /**
   * 从后端拉取助手日记
   */
  async fetchDiaryRecords(params?: {
    limit?: number
    offset?: number
    startDay?: string
    endDay?: string
  }): Promise<{
    assistant: string
    limit: number
    offset: number
    startDay: string | null
    endDay: string | null
    count: number
    total: number
    data: DiaryRecord[]
  }> {
    const limitInput = Number(params?.limit)
    const offsetInput = Number(params?.offset)
    const normalizedLimit = Number.isFinite(limitInput)
      ? Math.min(100, Math.max(1, Math.trunc(limitInput)))
      : 20
    const normalizedOffset = Number.isFinite(offsetInput) ? Math.max(0, Math.trunc(offsetInput)) : 0

    const searchParams = new URLSearchParams({
      limit: String(normalizedLimit),
      offset: String(normalizedOffset)
    })

    const startDay = params?.startDay?.trim()
    const endDay = params?.endDay?.trim()
    if (startDay) {
      searchParams.set('start_day', startDay)
    }
    if (endDay) {
      searchParams.set('end_day', endDay)
    }

    const response = await request.get<DiaryApiResponse>(
      `/api/chat/diary?${searchParams.toString()}`
    )

    const result = response.data
    const normalizedData = Array.isArray(result.data)
      ? result.data.map((item) => ({
          day: typeof item.day === 'string' ? item.day : '',
          summary: typeof item.summary === 'string' ? item.summary : '',
          facts: typeof item.facts === 'string' ? item.facts : '',
          dayLastTimestamp: typeof item.dayLastTimestamp === 'string' ? item.dayLastTimestamp : '',
          dayLastTimestampSec: Number.isFinite(item.dayLastTimestampSec)
            ? Number(item.dayLastTimestampSec)
            : 0
        }))
      : []

    return {
      assistant: typeof result.assistant === 'string' ? result.assistant : '',
      limit: Number.isFinite(result.limit) ? Number(result.limit) : normalizedLimit,
      offset: Number.isFinite(result.offset) ? Number(result.offset) : normalizedOffset,
      startDay: typeof result.startDay === 'string' ? result.startDay : null,
      endDay: typeof result.endDay === 'string' ? result.endDay : null,
      count: Number.isFinite(result.count) ? Number(result.count) : normalizedData.length,
      total: Number.isFinite(result.total) ? Number(result.total) : normalizedData.length,
      data: normalizedData
    }
  }
}
