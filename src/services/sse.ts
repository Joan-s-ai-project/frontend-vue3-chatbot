/**
 * SSE Stream Parser
 * 负责解析后端返回的 SSE 流，与具体业务回调解耦
 */

export interface StreamCallbacks {
  onReasoning?: (text: string) => void
  onContent?: (text: string) => void
  onContentEnd?: () => void
  onSearching?: (query: string) => void
  onBashRunning?: (command: string) => void
  onMemorySearching?: (query: string) => void
  onMemorySaving?: (conversationId: string) => void
  onBrowserAction?: (data: { action: string; url?: string; selector?: string }) => void
  onMcpToolRunning?: (data: { name: string; serverId: string; toolName: string; args: Record<string, any> }) => void
  onToolResult?: (data: { name: string; query?: string; command?: string; result: string }) => void
  onDone?: (data: { usage?: any; cost?: any; model?: string; toolCallsCount?: number; messageCount?: number; duration?: number; stopped?: boolean; error?: string }) => void
  onError?: (message: string, code?: number | string) => void
}

/**
 * 解析单条 SSE 事件数据
 */
function parseSseEvent(raw: string): { type: string;[key: string]: any } | null {
  const line = raw.trim()
  if (!line.startsWith('data: ')) return null

  try {
    return JSON.parse(line.slice(6))
  } catch {
    console.warn('[SSE] Failed to parse event:', line)
    return null
  }
}

/**
 * 消费 SSE Response，按事件类型触发对应回调
 */
export async function consumeSseStream(res: Response, callbacks: StreamCallbacks): Promise<void> {
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    // 按 \n\n 分割 SSE 事件，最后一段可能不完整，留到下次
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''

    for (const part of parts) {
      const data = parseSseEvent(part)
      if (!data) continue

      switch (data.type) {
        case 'reasoning':
          callbacks.onReasoning?.(data.content)
          break
        case 'content':
          callbacks.onContent?.(data.content)
          break
        case 'content_end':
          callbacks.onContentEnd?.()
          break
        case 'searching':
          callbacks.onSearching?.(data.query)
          break
        case 'bash_running':
          callbacks.onBashRunning?.(data.command)
          break
        case 'memory_searching':
          callbacks.onMemorySearching?.(data.query)
          break
        case 'memory_saving':
          callbacks.onMemorySaving?.(data.conversation_id)
          break
        case 'browser_action':
          callbacks.onBrowserAction?.({ action: data.action, url: data.url, selector: data.selector })
          break
        case 'mcp_tool_running':
          callbacks.onMcpToolRunning?.({
            name: data.name,
            serverId: data.serverId,
            toolName: data.toolName,
            args: data.args || {},
          })
          break
        case 'tool_result':
          callbacks.onToolResult?.({ name: data.name, query: data.query, command: data.command, result: data.result })
          break
        case 'done':
          callbacks.onDone?.({
            usage: data.usage,
            cost: data.cost,
            model: data.model,
            toolCallsCount: data.toolCallsCount,
            messageCount: data.messageCount,
            duration: data.duration,
            stopped: data.stopped,
            error: data.error,
          })
          break
        case 'error':
          callbacks.onError?.(data.message, data.code)
          break
      }
    }
  }
}
