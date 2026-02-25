import OpenAI from 'openai'

// 从环境变量获取配置
const API_KEY = import.meta.env.VITE_OPENAI_API_KEY || ''
const BASE_URL = import.meta.env.VITE_OPENAI_API_BASE_URL || '/api/ppinfra/v3/openai'

// OpenAI 客户端配置
// 在浏览器环境使用 baseURL 时，需要提供完整的 http/https 地址
// 对于相对路径，我们需要使用默认的 baseURL 并通过 fetch 拦截器处理
const getBaseURL = () => {
  // 如果是完整 URL，直接使用
  if (BASE_URL.startsWith('http://') || BASE_URL.startsWith('https://')) {
    return BASE_URL
  }
  // 相对路径：使用 window.location.origin 构建完整 URL
  return `${window.location.origin}${BASE_URL.startsWith('/') ? '' : '/'}${BASE_URL}`
}

console.log(getBaseURL())

const openai = new OpenAI({
  apiKey: API_KEY,
  baseURL: getBaseURL(),
  dangerouslyAllowBrowser: true,
  // 添加默认超时
  timeout: 60000,
  // 添加默认 headers
  defaultHeaders: {
    'Content-Type': 'application/json'
  }
})

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatResponse {
  success: true
  content: string
  usage?: unknown
}

export interface ChatError {
  success: false
  error: string
}

/**
 * 发送聊天请求到 OpenAI
 */
export async function sendChatMessage(
  messages: ChatMessage[],
  options?: {
    model?: string
    temperature?: number
    maxTokens?: number
  }
): Promise<ChatResponse | ChatError> {
  try {
    const response = await openai.chat.completions.create({
      model: options?.model || 'gpt-4o-mini',
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 1000
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      return {
        success: false,
        error: 'No response content from AI'
      }
    }

    return {
      success: true,
      content,
      usage: response.usage
    }
  } catch (error) {
    console.error('OpenAI API Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

export interface StreamChatOptions {
  model?: string
  temperature?: number
  maxTokens?: number
  onChunk?: (chunk: string) => void      // 答案内容回调
  onReasoning?: (chunk: string) => void  // 思考内容回调（GLM-5 reasoning_content）
  onError?: (error: string) => void
  onComplete?: () => void
}

/**
 * 发送流式聊天请求到 OpenAI
 * 返回一个 Promise，在流结束时解析为完整响应
 */
export async function sendStreamChatMessage(
  messages: ChatMessage[],
  options: StreamChatOptions = {}
): Promise<ChatResponse | ChatError> {
  const { onChunk, onReasoning, onError, onComplete, ...modelOptions } = options

  try {
    const stream = await openai.chat.completions.create({
      model: modelOptions.model || 'gpt-4o-mini',
      messages,
      temperature: modelOptions.temperature ?? 0.7,
      max_tokens: modelOptions.maxTokens ?? 1000,
      stream: true
    })

    let fullContent = ''
    let fullReasoning = ''
    console.log(stream);

    for await (const chunk of stream) {
      console.log(chunk);

      // 获取答案内容（标准字段）
      const content = chunk.choices[0]?.delta?.content

      // 获取推理内容，暂时断言为 any
      const reasoning = (chunk.choices[0] as any)?.delta?.reasoning_content

      if (reasoning) {
        fullReasoning += reasoning
        onReasoning?.(reasoning)  // 触发思考回调
      } else if (content) {
        fullContent += content
        onChunk?.(content)
      }
    }

    onComplete?.()

    if (!fullContent) {
      return {
        success: false,
        error: 'No response content from AI'
      }
    }

    return {
      success: true,
      content: fullContent
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('OpenAI Stream API Error:', error)
    onError?.(errorMessage)
    return {
      success: false,
      error: errorMessage
    }
  }
}

export default openai
