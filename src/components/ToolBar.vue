<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  tools: { id: string; label: string }[]
  enabled: Set<string>
}>()

const emit = defineEmits<{
  toggle: [id: string]
}>()

const TOOL_ICONS: Record<string, string> = {
  search_web: '🔍',
  run_bash: '⌨',
  browser: '🌐',
  memory_search: '🧠',
  memory_save: '💾',
}

const open = ref(false)
const rootRef = ref<HTMLElement>()

const enabledCount = computed(() => props.tools.filter(t => props.enabled.has(t.id)).length)
const allEnabled = computed(() => enabledCount.value === props.tools.length)

function onDocClick(e: MouseEvent) {
  if (rootRef.value && !rootRef.value.contains(e.target as Node)) {
    open.value = false
  }
}

onMounted(() => document.addEventListener('click', onDocClick, true))
onUnmounted(() => document.removeEventListener('click', onDocClick, true))
</script>

<template>
  <div v-if="tools.length > 0" ref="rootRef" class="tool-dropdown">
    <!-- 触发按钮：和附件按钮同款圆形样式 -->
    <button
      class="tool-trigger"
      :class="{ 'tool-trigger--partial': !allEnabled }"
      :title="open ? '关闭工具选择' : '选择本次可用工具'"
      @click.stop="open = !open"
    >
      <svg viewBox="0 0 24 24" fill="none" class="tool-icon" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"
          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
        />
      </svg>
      <!-- 部分禁用时显示小圆点提示 -->
      <span v-if="!allEnabled" class="tool-badge">{{ enabledCount }}</span>
    </button>

    <!-- 下拉面板：向上展开 -->
    <div v-if="open" class="tool-panel">
      <div class="tool-panel-header">TOOLS</div>
      <div
        v-for="tool in tools"
        :key="tool.id"
        class="tool-item"
        :class="{ 'tool-item--on': enabled.has(tool.id) }"
        @click="emit('toggle', tool.id)"
      >
        <span class="tool-item-check">{{ enabled.has(tool.id) ? '✓' : ' ' }}</span>
        <span class="tool-item-icon">{{ TOOL_ICONS[tool.id] ?? '🔧' }}</span>
        <span class="tool-item-label">{{ tool.label }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tool-dropdown {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
}

/* 圆形触发按钮 — 和 ChatInput 里的 attach-btn 同款 */
.tool-trigger {
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
  position: relative;
  transition: background 0.15s, transform 0.15s;
}

.tool-trigger:hover {
  background: #f0f0f0;
  transform: scale(1.08);
}

/* 部分工具被关闭时边框变虚线，提示用户 */
.tool-trigger--partial {
  border-style: dashed;
}

.tool-icon {
  width: 16px;
  height: 16px;
  display: block;
  flex-shrink: 0;
  overflow: visible;
}

/* 小角标：显示已启用数量 */
.tool-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 14px;
  height: 14px;
  background: #000;
  color: #fff;
  font-size: 0.5rem;
  font-family: 'Space Mono', 'Courier New', monospace;
  font-weight: 700;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  pointer-events: none;
}

/* 下拉面板：向上展开 */
.tool-panel {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  min-width: 155px;
  background: #fff;
  border: 3px solid #000;
  box-shadow: 4px -4px 0 #000;
  z-index: 50;
}

.tool-panel-header {
  padding: 0.3rem 0.7rem;
  font-size: 0.6rem;
  font-family: 'Space Mono', 'Courier New', monospace;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: #999;
  border-bottom: 2px solid #000;
  background: #f5f5f5;
}

/* 列表项 */
.tool-item {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.45rem 0.7rem;
  font-size: 0.72rem;
  font-family: 'Space Mono', 'Courier New', monospace;
  font-weight: 700;
  color: #999;
  cursor: pointer;
  transition: background 0.08s;
  border-bottom: 1px solid #eee;
  user-select: none;
}

.tool-item:last-child {
  border-bottom: none;
}

.tool-item:hover {
  background: #f0f0f0;
  color: #000;
}

.tool-item--on {
  color: #000;
}

.tool-item-check {
  width: 1em;
  text-align: center;
  flex-shrink: 0;
  font-size: 0.7rem;
}

.tool-item-icon {
  font-size: 0.85rem;
  line-height: 1;
  flex-shrink: 0;
}

.tool-item-label {
  flex: 1;
}
</style>
