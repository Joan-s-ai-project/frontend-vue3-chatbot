/**
 * Services 统一入口
 * 组合 API 请求层与数据解析层，对外暴露业务方法
 */

export { sessionId, isHistorySession, isReplaySession } from './chat'
export type { StreamCallbacks } from './sse'

import { fetchChat, fetchChatStream, fetchStopChat, fetchHistory, fetchHistoryList, fetchModels, fetchDeleteHistory, fetchTools } from './chat'
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
  enabledToolIds?: string[],
) {
  const res = await fetchChatStream(message, images, model, attachments, enabledToolIds)
  await consumeSseStream(res, callbacks)
}

/**
 * 获取当前已注册工具列表（前端开关控件用）
 */
export async function loadTools(): Promise<{ id: string; label: string }[]> {
  return fetchTools()
}

/**
 * 中止当前会话的生成
 * 后端会把已生成的半成品内容落盘，并通过 done(stopped:true) 事件收尾
 */
export async function stopGeneration() {
  return fetchStopChat()
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

/**
 * 回放历史会话（SSE 流式，模拟真实对话流）
 * 用于前端调试，无需消耗 API 费用
 */
export async function replaySession(id: string, callbacks: StreamCallbacks) {
  const res = await fetch(`/api/replay/${id}`)
  if (!res.ok) {
    throw new Error(`Replay failed (${res.status})`)
  }
  await consumeSseStream(res, callbacks)
}
