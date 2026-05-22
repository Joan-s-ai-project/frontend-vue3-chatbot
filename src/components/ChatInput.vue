<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

const emit = defineEmits<{
  send: [message: string, images: string[]]
}>()

const editorRef = ref<HTMLDivElement>()
const composing = ref(false)
const isEmpty = ref(true)

/** 已粘贴的图片列表（base64 data URL） */
const pastedImages = ref<string[]>([])

/** 发送按钮禁用状态 */
const sendDisabled = computed(() => isEmpty.value && pastedImages.value.length === 0)

/** 从 contenteditable 读取纯文本（保留换行） */
function getPlainText(): string {
  const el = editorRef.value
  if (!el) return ''
  // 将 <br> 和块级元素换行还原为 \n
  return el.innerText.replace(/\n$/, '') // 浏览器末尾会多一个 \n
}

/** 清空编辑器 */
function clearEditor() {
  const el = editorRef.value
  if (!el) return
  el.innerHTML = ''
  isEmpty.value = true
}

/** 同步 isEmpty 状态（用于按钮禁用判断） */
function syncEmpty() {
  const el = editorRef.value
  if (!el) return
  // innerText 为空或只有换行符时视为空
  isEmpty.value = el.innerText.replace(/\n/g, '').trim() === ''
}

function handleSend() {
  const text = getPlainText().trim()
  if (!text && pastedImages.value.length === 0) return
  emit('send', text, [...pastedImages.value])
  clearEditor()
  pastedImages.value = []
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

  // 没有图片时，阻止富文本粘贴，改为纯文本插入
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

  // 将 \r\n / \r 统一为 \n，然后按行分割插入
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const range = selection.getRangeAt(0)
  range.deleteContents()

  const frag = document.createDocumentFragment()
  lines.forEach((line, i) => {
    if (i > 0) frag.appendChild(document.createElement('br'))
    if (line) frag.appendChild(document.createTextNode(line))
  })

  range.insertNode(frag)
  // 光标移到末尾
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

onMounted(() => {
  // 初始聚焦
  editorRef.value?.focus()
})
</script>

<template>
  <div class="chat-input">
    <div class="input-box">
      <!-- 图片预览区 -->
      <div class="image-previews" v-if="pastedImages.length">
        <div class="image-preview" v-for="(img, i) in pastedImages" :key="i">
          <img :src="img" alt="粘贴的图片" />
          <button class="remove-btn" @click="removeImage(i)" title="移除图片">×</button>
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
        <!-- placeholder（用伪元素实现，不影响 DOM 结构） -->
        <div v-if="isEmpty" class="placeholder" aria-hidden="true">
          输入消息... (Enter 发送, Shift+Enter 换行, 可粘贴图片)
        </div>
      </div>

      <div class="input-bottom">
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
  /* 隔离重排范围，输入框内部变化不影响外部布局 */
  contain: layout style;
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

/* 图片预览 */
.image-previews {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.4rem 0;
}

.image-preview {
  position: relative;
  width: 80px;
  height: 80px;
  border: 2px solid #000;
  overflow: hidden;
}

.image-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-preview .remove-btn {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
  color: #fff;
  border: none;
  border-radius: 50%;
  font-size: 0.75rem;
  cursor: pointer;
  line-height: 1;
  padding: 0;
}

.image-preview .remove-btn:hover {
  background: #c00;
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
  /* 滚动条样式 */
  scrollbar-width: thin;
  scrollbar-color: #000 #e8e8e8;
}

.editor::-webkit-scrollbar {
  width: 4px;
}
.editor::-webkit-scrollbar-track {
  background: #e8e8e8;
}
.editor::-webkit-scrollbar-thumb {
  background: #000;
}

/* placeholder 覆盖在编辑区上方，不占布局空间 */
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
  justify-content: flex-end;
  padding-top: 0.3rem;
}

button {
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

button:hover:not(:disabled) {
  background: #333;
  transform: scale(1.08);
}

button:disabled {
  opacity: 0.25;
  cursor: not-allowed;
}

.send-icon {
  width: 18px;
  height: 18px;
}
</style>
