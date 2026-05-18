<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'

const emit = defineEmits<{
  send: [message: string, images: string[]]
}>()

const input = ref('')
const composing = ref(false)
const textareaRef = ref<HTMLTextAreaElement>()

/** 已粘贴的图片列表（base64 data URL） */
const pastedImages = ref<string[]>([])

function handleSend() {
  const text = input.value.trim()
  if (!text && pastedImages.value.length === 0) return
  emit('send', text, [...pastedImages.value])
  input.value = ''
  pastedImages.value = []
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !composing.value) {
    e.preventDefault()
    handleSend()
  }
}

/** 处理粘贴事件 — 提取图片并转为 base64 */
function handlePaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items
  if (!items) return

  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault()
      const file = item.getAsFile()
      if (!file) continue
      compressAndAdd(file)
    }
  }
}

/** 压缩图片：限制最大尺寸 1200px，JPEG 质量 0.7，控制 base64 体积 */
function compressAndAdd(file: File) {
  const img = new Image()
  const url = URL.createObjectURL(file)
  img.onload = () => {
    URL.revokeObjectURL(url)

    const MAX_SIZE = 1200
    let { width, height } = img

    // 等比缩放
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
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0, width, height)

    // 输出为 JPEG，质量 0.7（通常能把截图从几 MB 压到几百 KB）
    const dataUrl = canvas.toDataURL('image/jpeg', 0.7)
    pastedImages.value.push(dataUrl)
  }
  img.src = url
}

/** 移除某张已粘贴的图片 */
function removeImage(index: number) {
  pastedImages.value.splice(index, 1)
}

// 自动调整 textarea 高度
function autoResize() {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 240) + 'px'
}

watch(input, () => {
  nextTick(autoResize)
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
      <textarea
        ref="textareaRef"
        v-model="input"
        placeholder="输入消息... (Enter 发送, Shift+Enter 换行, 可粘贴图片)"
        @keydown="handleKeydown"
        @paste="handlePaste"
        @compositionstart="composing = true"
        @compositionend="composing = false"
        rows="1"
      />
      <div class="input-bottom">
        <button @click="handleSend" :disabled="!input.trim() && !pastedImages.length" title="发送">
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
}

.input-box {
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

textarea {
  width: 100%;
  padding: 0.5rem 0;
  border: none;
  background: transparent;
  font-size: 0.9rem;
  font-family: 'Space Mono', 'Courier New', monospace;
  resize: none;
  outline: none;
  line-height: 1.6;
  min-height: 1.6em;
  max-height: 240px;
  overflow-y: auto;
  color: #000;
}

textarea::placeholder {
  color: #999;
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
