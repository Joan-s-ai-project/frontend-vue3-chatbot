/**
 * Services 统一入口
 * 组合 API 请求层与数据解析层，对外暴露业务方法
 */

export { sessionId, isHistorySession } from './chat'
export type { StreamCallbacks } from './sse'

import { fetchChat, fetchChatStream, fetchHistory } from './chat'
import { consumeSseStream } from './sse'
import type { StreamCallbacks } from './sse'

/**
 * 非流式聊天，返回解析后的 JSON
 */
export async function sendMessage(message: string) {
  const res = await fetchChat(message)
  return res.json()
}

/**
 * 流式聊天（SSE）
 * 内置打字机效果：把收到的 chunk 放入队列，逐字输出
 */
export async function sendStreamMessage(message: string, images: string[], callbacks: StreamCallbacks) {
  const res = await fetchChatStream(message, images)

  // // 打字机队列
  // let contentQueue = ''
  // let reasoningQueue = ''
  // let streamDone = false
  // let typingInterval: ReturnType<typeof setInterval> | null = null

  // function startTyping() {
  //   if (typingInterval) return
  //   typingInterval = setInterval(() => {
  //     // 优先输出 reasoning
  //     if (reasoningQueue.length > 0) {
  //       callbacks.onReasoning?.(reasoningQueue[0])
  //       reasoningQueue = reasoningQueue.slice(1)
  //     } else if (contentQueue.length > 0) {
  //       callbacks.onContent?.(contentQueue[0])
  //       contentQueue = contentQueue.slice(1)
  //     } else if (streamDone) {
  //       clearInterval(typingInterval!)
  //       typingInterval = null
  //       callbacks.onDone?.(undefined)
  //     }
  //   }, 15) // 每 15ms 输出一个字符，约 66 字/秒
  // }

  // await consumeSseStream(res, {
  //   onReasoning(chunk) {
  //     reasoningQueue += chunk
  //     startTyping()
  //   },
  //   onContent(chunk) {
  //     contentQueue += chunk
  //     startTyping()
  //   },
  //   onDone(_usage) {
  //     streamDone = true
  //     // 不立即调用 callbacks.onDone，等队列清空后再调用
  //   },
  //   onError(msg) {
  //     if (typingInterval) {
  //       clearInterval(typingInterval)
  //       typingInterval = null
  //     }
  //     callbacks.onError?.(msg)
  //   },
  // })

  await consumeSseStream(res, callbacks)
}

/**
 * 加载历史会话消息
 */
export async function loadHistory(id: string) {
  return fetchHistory(id)
}
