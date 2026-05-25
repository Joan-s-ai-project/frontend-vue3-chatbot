# 输入框性能优化：从 textarea 到 contenteditable

## 背景

在 AI Chat 项目中，用户反馈输入长文本时出现明显卡顿。经分析，根本原因在于使用了 `<textarea>` + JS 动态调整高度的方案。本文档记录问题根因和最终优化方案。

---

## 一、textarea 的问题

### 1. 高度自适应必须依赖 JS

`<textarea>` 的高度是固定的，无法随内容自动伸展。为了实现"随内容增高"的效果，必须在每次输入后用 JS 手动测量并设置高度：

```js
function autoResize() {
  el.style.height = 'auto'        // 写：使布局失效
  el.style.height = el.scrollHeight + 'px'  // 读+写：强制立即重排
}
```

这是典型的 **Layout Thrashing（强制同步布局）**：先写 DOM 使布局失效，再立刻读 `scrollHeight` 迫使浏览器同步完成重排，才能返回准确的值。文本越长，这次重排越贵。

### 2. 每个字符都触发完整的响应式链路

使用 `v-model` 双向绑定时，每次按键都会走完整的框架调度链路：

```
按键 → v-model 更新 ref → Vue 调度器 → watch effect → nextTick 微任务 → DOM 操作
```

这条链路在短文本下感知不到，但文本越长，每一步的开销越大（字符串复制、响应式 diff、DOM 测量），叠加起来就是卡顿。

### 3. 拼写检查的隐性开销

`<textarea>` 默认开启 `spellcheck`。浏览器在每次输入后都会对全文跑拼写检查，文本越长耗时越久，且这个过程在主线程上同步执行。

### 4. 重排范围无法隔离

`<textarea>` 高度变化时，父容器（flex 布局）需要重新计算所有子元素的位置，整个页面的消息列表、侧边栏都可能被牵连进重排。

### 5. 问题叠加示意

```
用户按键
  └─ v-model 触发响应式更新
       └─ watch 回调
            └─ nextTick（等待 DOM 更新）
                 └─ autoResize()
                      ├─ el.style.height = 'auto'     ← 写，layout dirty
                      └─ el.scrollHeight              ← 读，强制同步重排 ⚠️
                           └─ 文本越长，重排越慢
```

---

## 二、contenteditable 的优势

### 1. 高度天然随内容自适应

`contenteditable` 的 div 是普通块级元素，高度由内容撑开，这是浏览器的默认行为。**不需要任何 JS 参与高度计算**，彻底消除了 Layout Thrashing。

```
用户按键
  └─ 浏览器原生处理文本插入（结束）
       └─ 高度自动更新，无 JS 介入 ✅
```

### 2. DOM 是唯一数据源，框架不参与输入过程

输入过程中完全不更新 Vue 响应式状态，只在发送时读一次 `innerText`：

```js
// 发送时才读取，输入过程零框架开销
function getPlainText(): string {
  return editorRef.value?.innerText.replace(/\n$/, '') ?? ''
}
```

框架的响应式系统完全退出输入路径，无论文本多长，按键延迟都是恒定的。

### 3. 浏览器增量更新 DOM

`<textarea>` 内部是一个整体的 LayoutText 节点，每次输入都要重建整个文本布局。`contenteditable` 的 div 走标准 DOM 流，浏览器只需更新光标附近的 text node，其余部分不受影响。

### 4. 可配合 CSS Containment 隔离重排

在输入框容器上加 `contain: layout style`，明确告知浏览器内部变化不影响外部，将重排范围锁定在输入框子树内：

```css
.chat-input {
  contain: layout style;
}
```

### 5. 关闭拼写检查

```html
<div contenteditable="true" spellcheck="false" autocorrect="off" autocapitalize="off">
```

彻底关闭拼写检查和自动纠正，消除长文本下的隐性主线程开销。

---

## 三、需要额外处理的细节

`contenteditable` 不是银弹，相比 `<textarea>` 需要手动处理以下问题：

| 问题 | 处理方式 |
|---|---|
| placeholder | 用绝对定位的 div 模拟，`isEmpty` ref 控制显隐 |
| 富文本粘贴 | 拦截 `paste` 事件，手动插入纯文本 + `<br>` 换行 |
| 读取文本内容 | 用 `innerText`（自动处理 `<br>` → `\n`） |
| 清空内容 | `el.innerHTML = ''` |
| Enter 发送 | 监听 `keydown`，阻止默认换行行为 |
| IME 中文输入 | `compositionstart/end` 保护，避免提前触发发送 |

---

## 四、性能对比

| 指标 | textarea 方案 | contenteditable 方案 |
|---|---|---|
| 高度自适应 | JS 测量，每次按键触发重排 | 浏览器原生，零 JS |
| 框架介入 | 每次按键更新响应式状态 | 仅发送时读取一次 |
| 重排范围 | 影响整个 flex 父容器 | `contain` 隔离在子树内 |
| 拼写检查 | 默认开启 | 显式关闭 |
| 长文本表现 | 随文本增长线性变慢 | 恒定，不受文本长度影响 |

---

## 五、参考

- [MDN: contenteditable](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/contenteditable)
- [MDN: CSS contain](https://developer.mozilla.org/en-US/docs/Web/CSS/contain)
- [Web.dev: Avoid large, complex layouts and layout thrashing](https://web.dev/articles/avoid-large-complex-layouts-and-layout-thrashing)
