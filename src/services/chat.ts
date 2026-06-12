/**
 * Chat API Service
 * 只负责发起 HTTP 请求，返回原始 Response
 */

// 兼容非安全上下文（通过 IP/HTTP 访问时 crypto.randomUUID 不可用）
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // fallback: 使用 crypto.getRandomValues 手动生成 UUID v4
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40 // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // variant 1
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

// 从 URL 路径中提取 UUID，如 /xxxx-xxxx-xxxx 则使用该 UUID 作为 sessionId
function getSessionIdFromUrl(): string | null {
  const path = window.location.pathname.replace(/^\//, '').replace(/\/$/, '')
  // UUID v4 格式
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(path) ? path : null
}

// 识别 /replay/:uuid 路径
function getReplayIdFromUrl(): string | null {
  const match = window.location.pathname.match(
    /^\/replay\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i
  )
  return match ? match[1] : null
}

// 如果 URL 中有 UUID 则复用，否则生成新的
export const sessionId = getSessionIdFromUrl() || getReplayIdFromUrl() || generateUUID()
export const isHistorySession = !!getSessionIdFromUrl()
export const isReplaySession = !!getReplayIdFromUrl()

console.log('[Chat] sessionId:', sessionId, isHistorySession ? '(from URL)' : '(new)')

/**
 * 非流式聊天
 */
export async function fetchChat(message: string): Promise<Response> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, message })
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || '请求失败')
  }

  return res
}

import type { AttachmentResult } from './upload'

/**
 * 流式聊天（SSE）
 */
export async function fetchChatStream(
  message: string,
  images?: string[],
  model?: string,
  attachments?: AttachmentResult[],
): Promise<Response> {
  const body: any = { sessionId, message, temperature: 0.1 }
  if (images && images.length > 0) {
    body.images = images
  }
  if (model) {
    body.model = model
  }
  if (attachments && attachments.length > 0) {
    body.attachments = attachments
  }

  const res = await fetch('/api/v1/chat/completion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })

  if (!res.ok) {
    let errMsg = `请求失败 (${res.status})`
    try {
      const err = await res.json()
      errMsg = err.error?.message || errMsg
    } catch {
      // 无法解析 JSON，使用默认错误信息
    }
    throw new Error(errMsg)
  }

  return res
}

/**
 * 中止当前会话的生成
 */
export async function fetchStopChat(): Promise<{ stopped: boolean }> {
  const res = await fetch('/api/v1/chat/stop', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId })
  })
  if (!res.ok) {
    throw new Error(`停止请求失败 (${res.status})`)
  }
  return res.json()
}

/**
 * 获取可用模型列表
 */
export async function fetchModels(): Promise<{ id: string; label: string; provider: string }[]> {
  const res = await fetch('/api/models')
  if (!res.ok) throw new Error('获取模型列表失败')
  return res.json()
}


/**
 * 获取历史会话消息
 */
export async function fetchHistory(id: string): Promise<any[]> {
  const res = await fetch(`/api/history/${id}`)
  if (!res.ok) {
    if (res.status === 404) {
      const err = new Error('会话不存在或已被删除')
        ; (err as any).status = 404
      throw err
    }
    throw new Error('获取历史记录失败')
  }
  return res.json()
}

/**
 * 获取历史会话列表
 */
export async function fetchHistoryList(): Promise<{ id: string; title: string; createdAt: number; messageCount: number }[]> {
  const res = await fetch('/api/history')
  if (!res.ok) throw new Error('获取会话列表失败')
  return res.json()
}

/**
 * 删除历史会话
 */
export async function fetchDeleteHistory(id: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`/api/history/${id}`, {
    method: 'DELETE'
  })
  if (!res.ok) {
    throw new Error('删除会话失败')
  }
  return res.json()
}
