/**
 * Services 统一入口
 * 组合 API 请求层与数据解析层，对外暴露业务方法
 */

export { sessionId, isHistorySession } from './chat'
export type { StreamCallbacks } from './sse'

import { fetchChat, fetchChatStream, fetchHistory, fetchHistoryList, fetchModels, fetchDeleteHistory } from './chat'
import { consumeSseStream } from './sse'
import type { StreamCallbacks } from './sse'
import type { AttachmentResult } from './upload'

export type { AttachmentResult } from './upload'
export { uploadAttachment, validateFile, MAX_FILE_SIZE, MAX_ATTACHMENTS } from './upload'

/**
 * 非流式聊天，返回解析后的 JSON
 */
export async function sendMessage(message: string) {
  const res = await fetchChat(message)
  return res.json()
}

/**
 * 流式聊天（SSE）
 */
export async function sendStreamMessage(
  message: string,
  images: string[],
  callbacks: StreamCallbacks,
  model?: string,
  attachments?: AttachmentResult[],
) {
  const res = await fetchChatStream(message, images, model, attachments)
  await consumeSseStream(res, callbacks)
}

/**
 * 加载历史会话消息
 */
export async function loadHistory(id: string) {
  return fetchHistory(id)
}

/**
 * 加载历史会话列表
 */
export async function loadHistoryList() {
  return fetchHistoryList()
}

/**
 * 获取可用模型列表
 */
export async function loadModels() {
  return fetchModels()
}

/**
 * 删除历史会话
 */
export async function deleteSession(id: string) {
  return fetchDeleteHistory(id)
}
