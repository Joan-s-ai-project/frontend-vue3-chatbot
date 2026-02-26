/**
 * Chat API Service
 * 封装与后端 /api/chat 和 /api/chat/stream 的通信
 */

// 每次页面加载生成一个新的 sessionId
export const sessionId = crypto.randomUUID()

console.log('[Chat] sessionId:', sessionId)

/**
 * 非流式聊天
 */
export async function sendMessage(message: string) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, message })
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || '请求失败')
  }

  return res.json()
}

/**
 * SSE 流式聊天回调类型
 */
export interface StreamCallbacks {
  onReasoning?: (text: string) => void
  onContent?: (text: string) => void
  onDone?: (usage: any) => void
  onError?: (message: string) => void
}

/**
 * 流式聊天（SSE）
 */
export async function sendStreamMessage(message: string, callbacks: StreamCallbacks) {
  const res = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, message })
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || '请求失败')
  }

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    // 按 \n\n 分割 SSE 事件
    const parts = buffer.split('\n\n')
    buffer = parts.pop() || ''  // 最后一段可能不完整，留到下次

    for (const part of parts) {
      const line = part.trim()
      if (!line.startsWith('data: ')) continue

      const data = JSON.parse(line.slice(6))

      switch (data.type) {
        case 'reasoning':
          callbacks.onReasoning?.(data.content)
          break
        case 'content':
          callbacks.onContent?.(data.content)
          break
        case 'done':
          callbacks.onDone?.(data.usage)
          break
        case 'error':
          callbacks.onError?.(data.message)
          break
      }
    }
  }
}
