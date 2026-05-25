/**
 * 文件上传服务
 * 负责校验、上传文件，返回结构化的附件数据
 */

export interface AttachmentResult {
  type: 'image' | 'document'
  name: string
  mimeType: string
  size?: number      // 文件字节大小（前端上传时附加）
  dataUrl?: string   // 图片 base64 data URL
  content?: string   // 文档提取的纯文本
  charCount?: number
}

// 支持的图片扩展名
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp'])

// 支持的文档扩展名
const DOC_EXTS = new Set([
  '.pdf', '.doc', '.docx', '.xlsx', '.xls', '.pptx',
  '.odt', '.odp', '.ods',
  '.txt', '.md', '.json', '.csv', '.xml', '.html', '.htm',
  '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.c', '.cpp',
  '.cs', '.go', '.rs', '.rb', '.php', '.sh', '.yaml', '.yml',
  '.toml', '.ini', '.sql',
])

export const MAX_FILE_SIZE = 100 * 1024 * 1024  // 100MB
export const MAX_ATTACHMENTS = 5

/**
 * 校验文件，返回错误信息字符串；通过则返回 null
 */
export function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) {
    return `文件 "${file.name}" 超过 100MB 限制，已跳过`
  }
  const ext = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '')
  if (!IMAGE_EXTS.has(ext) && !DOC_EXTS.has(ext)) {
    return `不支持的文件格式 "${ext}"，已跳过`
  }
  return null
}

/**
 * 上传单个文件到后端，返回解析结果
 */
export async function uploadAttachment(file: File): Promise<AttachmentResult> {
  const formData = new FormData()
  formData.append('file', file)

  const res = await fetch('/api/v1/upload', {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) {
    let message = `上传失败 (${res.status})`
    try {
      const err = await res.json()
      message = err.error?.message || message
    } catch { /* 非 JSON */ }
    throw new Error(message)
  }

  const result: AttachmentResult = await res.json()
  // 后端不返回 size，前端补充
  result.size = file.size
  return result
}
