<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { uploadAttachment, validateFile, MAX_ATTACHMENTS } from '@/services'
import type { AttachmentResult } from '@/services'

const emit = defineEmits<{
  send: [message: string, images: string[], attachments: AttachmentResult[]]
}>()

const editorRef = ref<HTMLDivElement>()
const fileInputRef = ref<HTMLInputElement>()
const composing = ref(false)
const isEmpty = ref(true)

/** 已粘贴的图片列表（base64 data URL） */
const pastedImages = ref<string[]>([])

/** 通过附件按钮上传的附件列表 */
const attachments = ref<AttachmentResult[]>([])

/** 正在上传中的文件名列表 */
const uploadingFiles = ref<string[]>([])

/** 发送按钮禁用状态 */
const sendDisabled = computed(
  () => (isEmpty.value && pastedImages.value.length === 0 && attachments.value.length === 0) || uploadingFiles.value.length > 0
)

/** 从 contenteditable 读取纯文本（保留换行） */
function getPlainText(): string {
  const el = editorRef.value
  if (!el) return ''
  return el.innerText.replace(/\n$/, '')
}

/** 清空编辑器 */
function clearEditor() {
  const el = editorRef.value
  if (!el) return
  el.innerHTML = ''
  isEmpty.value = true
}

/** 同步 isEmpty 状态 */
function syncEmpty() {
  const el = editorRef.value
  if (!el) return
  isEmpty.value = el.innerText.replace(/\n/g, '').trim() === ''
}

function handleSend() {
  const text = getPlainText().trim()
  if (!text && pastedImages.value.length === 0 && attachments.value.length === 0) return
  emit('send', text, [...pastedImages.value], [...attachments.value])
  clearEditor()
  pastedImages.value = []
  attachments.value = []
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !composing.value) {
    e.preventDefault()
    handleSend()
  }
}

function handleInput() {
  syncEmpty()
}

/**
 * 处理粘贴事件：
 * - 图片 → 压缩后加入预览列表
 * - 文本 → 阻止默认粘贴（带格式），改为插入纯文本
 */
function handlePaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items
  if (!items) return

  let hasImage = false
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      hasImage = true
      e.preventDefault()
      const file = item.getAsFile()
      if (file) compressAndAdd(file)
    }
  }

  if (!hasImage) {
    e.preventDefault()
    const text = e.clipboardData?.getData('text/plain') ?? ''
    if (text) insertPlainText(text)
  }
}

/** 在光标位置插入纯文本（保留换行） */
function insertPlainText(text: string) {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return

  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const range = selection.getRangeAt(0)
  range.deleteContents()

  const frag = document.createDocumentFragment()
  lines.forEach((line, i) => {
    if (i > 0) frag.appendChild(document.createElement('br'))
    if (line) frag.appendChild(document.createTextNode(line))
  })

  range.insertNode(frag)
  range.collapse(false)
  selection.removeAllRanges()
  selection.addRange(range)

  syncEmpty()
}

/** 压缩图片：限制最大尺寸 1200px，JPEG 质量 0.7 */
function compressAndAdd(file: File) {
  const img = new Image()
  const url = URL.createObjectURL(file)
  img.onload = () => {
    URL.revokeObjectURL(url)

    const MAX_SIZE = 1200
    let { width, height } = img

    if (width > MAX_SIZE || height > MAX_SIZE) {
      if (width > height) {
        height = Math.round(height * (MAX_SIZE / width))
        width = MAX_SIZE
      } else {
        width = Math.round(width * (MAX_SIZE / height))
        height = MAX_SIZE
      }
    }

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
    pastedImages.value.push(canvas.toDataURL('image/jpeg', 0.7))
  }
  img.src = url
}

/** 移除某张已粘贴的图片 */
function removeImage(index: number) {
  pastedImages.value.splice(index, 1)
}

/** 移除某个附件 */
function removeAttachment(index: number) {
  attachments.value.splice(index, 1)
}

// ── 附件上传 ──────────────────────────────────────────────────────────

/** 点击附件按钮，触发文件选择 */
function triggerFileInput() {
  fileInputRef.value?.click()
}

/** 处理文件选择 */
async function handleFileSelect(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files || [])
  input.value = ''  // 重置，允许重复选同一文件

  for (const file of files) {
    // 数量限制
    if (attachments.value.length >= MAX_ATTACHMENTS) {
      showToast(`最多附加 ${MAX_ATTACHMENTS} 个文件`, 'warn')
      break
    }

    // 大小/格式校验
    const error = validateFile(file)
    if (error) {
      showToast(error, 'error')
      continue
    }

    // 上传
    uploadingFiles.value.push(file.name)
    try {
      const result = await uploadAttachment(file)
      attachments.value.push(result)
    } catch (err: any) {
      showToast(`"${file.name}" 上传失败: ${err.message}`, 'error')
    } finally {
      const idx = uploadingFiles.value.indexOf(file.name)
      if (idx !== -1) uploadingFiles.value.splice(idx, 1)
    }
  }
}

// ── Toast 通知 ────────────────────────────────────────────────────────

interface ToastItem {
  id: number
  message: string
  kind: 'error' | 'warn'
}
const toasts = ref<ToastItem[]>([])
let toastId = 0

function showToast(message: string, kind: 'error' | 'warn' = 'error') {
  const id = ++toastId
  toasts.value.push({ id, message, kind })
  setTimeout(() => {
    const idx = toasts.value.findIndex(t => t.id === id)
    if (idx !== -1) toasts.value.splice(idx, 1)
  }, 4000)
}

onMounted(() => {
  editorRef.value?.focus()
})

// 暴露 clear 方法供父组件调用
function clearAll() {
  clearEditor()
  pastedImages.value = []
  attachments.value = []
  uploadingFiles.value = []
}

defineExpose({ clearAll })

// ── 文件信息辅助 ──────────────────────────────────────────────────────

function formatFileSize(bytes?: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function getFileExt(name: string): string {
  return name.split('.').pop()?.toUpperCase() ?? 'FILE'
}
</script>

<template>
  <div class="chat-input">
    <!-- Toast 通知 -->
    <div class="toast-container">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        :class="['toast', `toast--${toast.kind}`]"
      >
        {{ toast.message }}
      </div>
    </div>

    <div class="input-box">
      <!-- 图片预览区（粘贴的图片） -->
      <div class="image-previews" v-if="pastedImages.length">
        <div class="image-preview" v-for="(img, i) in pastedImages" :key="'img-' + i">
          <img :src="img" alt="粘贴的图片" />
          <button class="remove-btn" @click="removeImage(i)" title="移除图片">×</button>
        </div>
      </div>

      <!-- 附件预览区 -->
      <div class="attachment-previews" v-if="attachments.length || uploadingFiles.length">
        <!-- 已上传的附件 -->
        <div
          v-for="(att, i) in attachments"
          :key="'att-' + i"
          class="attachment-item"
        >
          <!-- 图片附件：显示缩略图 -->
          <template v-if="att.type === 'image' && att.dataUrl">
            <img :src="att.dataUrl" :alt="att.name" class="attachment-thumb" />
            <div class="attachment-info">
              <span class="attachment-name" :title="att.name">{{ att.name }}</span>
              <span class="attachment-sub">IMAGE{{ att.size ? ' · ' + formatFileSize(att.size) : '' }}</span>
            </div>
          </template>
          <!-- 文档附件：文件 SVG 图标 + 文件名 -->
          <template v-else>
            <div class="attachment-icon-block">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
            </div>
            <div class="attachment-info">
              <span class="attachment-name" :title="att.name">{{ att.name }}</span>
              <span class="attachment-sub">{{ getFileExt(att.name) }}{{ att.size ? ' · ' + formatFileSize(att.size) : '' }}</span>
            </div>
          </template>
          <button class="remove-btn" @click="removeAttachment(i)" title="移除附件">×</button>
        </div>

        <!-- 上传中的文件 -->
        <div
          v-for="name in uploadingFiles"
          :key="'uploading-' + name"
          class="attachment-item attachment-item--loading"
        >
          <div class="attachment-icon-block">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <div class="attachment-info">
            <span class="attachment-name">{{ name }}</span>
            <span class="attachment-sub">上传中...</span>
          </div>
        </div>
      </div>

      <!-- contenteditable 编辑区 -->
      <div class="editor-wrap">
        <div
          ref="editorRef"
          class="editor"
          contenteditable="true"
          role="textbox"
          aria-multiline="true"
          aria-label="消息输入框"
          spellcheck="false"
          autocorrect="off"
          autocapitalize="off"
          @input="handleInput"
          @keydown="handleKeydown"
          @paste="handlePaste"
          @compositionstart="composing = true"
          @compositionend="composing = false; syncEmpty()"
        />
        <div v-if="isEmpty" class="placeholder" aria-hidden="true">
          输入消息... (Enter 发送, Shift+Enter 换行, 可粘贴图片)
        </div>
      </div>

      <div class="input-bottom">
        <!-- 附件按钮 -->
        <button
          class="attach-btn"
          @click="triggerFileInput"
          :disabled="uploadingFiles.length > 0"
          title="添加附件（图片/文档）"
          aria-label="添加附件"
        >
          <svg viewBox="0 0 24 24" fill="none" class="attach-icon">
            <path
              d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
            />
          </svg>
        </button>

        <!-- 隐藏的文件输入 -->
        <input
          ref="fileInputRef"
          type="file"
          multiple
          accept=".png,.jpg,.jpeg,.gif,.webp,.pdf,.doc,.docx,.xlsx,.xls,.pptx,.odt,.odp,.ods,.txt,.md,.json,.csv,.xml,.html,.js,.ts,.jsx,.tsx,.py,.java,.c,.cpp,.cs,.go,.rs,.rb,.php,.sh,.yaml,.yml,.toml,.sql"
          style="display: none"
          @change="handleFileSelect"
          aria-hidden="true"
        />

        <!-- 发送按钮 -->
        <button @click="handleSend" :disabled="sendDisabled" title="发送">
          <svg viewBox="0 0 24 24" fill="none" class="send-icon">
            <path d="M3.478 2.405a.75.75 0 0 0-.926.94l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94l18.06-7.65a.75.75 0 0 0 0-1.39L3.478 2.405z" fill="currentColor"/>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-input {
  padding: 0.8rem 1rem;
  background: #fff;
  contain: layout style;
  position: relative;
}

/* Toast */
.toast-container {
  position: absolute;
  bottom: calc(100% + 0.5rem);
  left: 1rem;
  right: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  pointer-events: none;
  z-index: 10;
}

.toast {
  padding: 0.6rem 1rem;
  font-size: 0.8rem;
  font-family: 'Space Mono', 'Courier New', monospace;
  border: 2px solid #000;
  animation: toast-in 0.15s ease;
}

.toast--error {
  background: #ff4444;
  color: #fff;
  border-color: #cc0000;
}

.toast--warn {
  background: #ffaa00;
  color: #000;
  border-color: #cc8800;
}

@keyframes toast-in {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}

.input-box {
  position: relative;
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 3px solid #000;
  padding: 0.5rem 1rem;
}

.input-box:focus-within {
  box-shadow: 4px 4px 0 #000;
  transform: translate(-2px, -2px);
}

/* 粘贴图片预览 */
.image-previews {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.5rem 0 0.2rem;
}

.image-preview {
  position: relative;
  width: 80px;
  height: 80px;
  border: 3px solid #000;
  overflow: hidden;
  flex-shrink: 0;
}

.image-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 附件预览区 */
.attachment-previews {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.5rem 0 0.2rem;
}

.attachment-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0;
  border: 3px solid #000;
  background: #fff;
  max-width: 280px;
  flex-shrink: 0;
  overflow: hidden;
}

.attachment-item:hover {
  box-shadow: 3px 3px 0 #000;
  transform: translate(-1px, -1px);
}

.attachment-item--loading {
  opacity: 0.6;
  border-style: dashed;
}

/* 左侧彩色图标块 */
.attachment-icon-block {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-right: 3px solid #000;
  background: #f0f0f0;
  color: #000;
}

.attachment-icon-block svg {
  width: 22px;
  height: 22px;
}

.attachment-thumb {
  width: 48px;
  height: 48px;
  object-fit: cover;
  display: block;
  flex-shrink: 0;
  border-right: 3px solid #000;
}

/* 右侧文字区 */
.attachment-info {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.1rem;
  padding: 0 0.55rem;
  min-width: 0;
  flex: 1;
}

/* 文件名 */
.attachment-name {
  font-size: 0.75rem;
  font-family: 'Space Mono', 'Courier New', monospace;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #000;
  line-height: 1.3;
}

.attachment-sub {
  font-size: 0.65rem;
  font-family: 'Space Mono', 'Courier New', monospace;
  color: #666;
  white-space: nowrap;
  line-height: 1.2;
}

/* 移除按钮：默认隐藏，hover 时显示 */
.remove-btn {
  position: absolute;
  top: -7px;
  right: -7px;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
  color: #fff;
  border: 2px solid #fff;
  border-radius: 50%;
  font-size: 0.75rem;
  cursor: pointer;
  line-height: 1;
  padding: 0;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.15s, background 0.15s;
  z-index: 1;
}

.attachment-item:hover .remove-btn,
.image-preview:hover .remove-btn {
  opacity: 1;
}

.remove-btn:hover {
  background: #333;
}

/* contenteditable 编辑区 */
.editor-wrap {
  position: relative;
}

.editor {
  width: 100%;
  padding: 0.5rem 0;
  min-height: 1.6em;
  max-height: 240px;
  overflow-y: auto;
  font-size: 0.9rem;
  font-family: 'Space Mono', 'Courier New', monospace;
  line-height: 1.6;
  color: #000;
  outline: none;
  white-space: pre-wrap;
  word-break: break-word;
  scrollbar-width: thin;
  scrollbar-color: #000 #e8e8e8;
}

.editor::-webkit-scrollbar { width: 4px; }
.editor::-webkit-scrollbar-track { background: #e8e8e8; }
.editor::-webkit-scrollbar-thumb { background: #000; }

.placeholder {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  padding: 0.5rem 0;
  font-size: 0.9rem;
  font-family: 'Space Mono', 'Courier New', monospace;
  line-height: 1.6;
  color: #999;
  pointer-events: none;
  user-select: none;
}

.input-bottom {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  padding-top: 0.3rem;
}

/* 附件按钮 */
.attach-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  color: #000;
  border: 2px solid #000;
  border-radius: 50%;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s;
}

.attach-btn:hover:not(:disabled) {
  background: #f0f0f0;
  transform: scale(1.08);
}

.attach-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.attach-icon {
  width: 16px;
  height: 16px;
}

/* 发送按钮 */
button:not(.attach-btn):not(.remove-btn) {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
  color: #fff;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  flex-shrink: 0;
  font-size: 0.9rem;
  font-family: inherit;
  transition: all 0.15s;
}

button:not(.attach-btn):not(.remove-btn):hover:not(:disabled) {
  background: #333;
  transform: scale(1.08);
}

button:not(.attach-btn):not(.remove-btn):disabled {
  opacity: 0.25;
  cursor: not-allowed;
}

.send-icon {
  width: 18px;
  height: 18px;
}
</style>
