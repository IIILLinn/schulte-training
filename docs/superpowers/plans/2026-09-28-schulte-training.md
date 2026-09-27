# 可配置舒尔特训练网页 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 构建一个单文件浏览器舒尔特训练器，支持 3×3 至 6×6、正序/倒序、随机/顺序、方形/圆形棋盘，以及成绩记录。

**Architecture:** 纯逻辑放在可被 Node 单元测试导入的 `core.js` 中；浏览器界面由 `index.html`、`styles.css`、`app.js` 组成；`build.mjs` 将三份资源内联为最终单文件 `outputs/schulte-training.html`。这样既能遵循 TDD，也能交付无需构建即可打开的单文件。

**Tech Stack:** 原生 HTML/CSS/JavaScript、Node.js 内置 `node:test`、Playwright CLI 浏览器验收。

---

## File Structure

- Create: `work/schulte-training/src/core.js` — 数字生成、洗牌、圆形坐标、规格 key、时间格式化。
- Create: `work/schulte-training/src/index.html` — 页面结构、设置区和结果区。
- Create: `work/schulte-training/src/styles.css` — 响应式样式、方形/圆形棋盘、动效。
- Create: `work/schulte-training/src/app.js` — 状态机、计时、点击判定、localStorage、渲染。
- Create: `work/schulte-training/build.mjs` — 将 CSS/JS 内联到 HTML。
- Create: `work/schulte-training/tests/core.test.mjs` — 核心逻辑单元测试。
- Create: `work/schulte-training/tests/browser-smoke.mjs` — 通过 Playwright CLI 的浏览器验收测试。
- Create: `outputs/schulte-training.html` — 最终交付文件。

实现完成后将源码、测试、设计文档和最终单文件成品统一提交到本地 Git 仓库。

---

### Task 1: 核心逻辑与单元测试

**Files:**
- Create: `work/schulte-training/tests/core.test.mjs`
- Create: `work/schulte-training/src/core.js`

- [x] **Step 1: 写失败测试**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const core = require('../src/core.js');

test('buildValues returns ascending values in sequential mode', () => {
  assert.deepEqual(core.buildValues(3, 'asc', 'sequential'), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
});

test('buildValues returns descending values in reverse mode', () => {
  assert.deepEqual(core.buildValues(3, 'desc', 'sequential'), [9, 8, 7, 6, 5, 4, 3, 2, 1]);
});

test('buildValues keeps the full value set when shuffled', () => {
  const values = core.buildValues(5, 'asc', 'random', () => 0.25);
  assert.deepEqual([...values].sort((a, b) => a - b), Array.from({ length: 25 }, (_, i) => i + 1));
});

test('createCircularSlots returns one slot per value for every supported size', () => {
  for (let size = 3; size <= 6; size += 1) {
    const slots = core.createCircularSlots(size);
    assert.equal(slots.length, size * size);
    assert.ok(slots.every(({ x, y }) => x >= 0.08 && x <= 0.92 && y >= 0.08 && y <= 0.92));
    for (let i = 0; i < slots.length; i += 1) {
      for (let j = i + 1; j < slots.length; j += 1) {
        const distance = Math.hypot(slots[i].x - slots[j].x, slots[i].y - slots[j].y);
        assert.ok(distance >= 0.09, `slots ${i} and ${j} overlap`);
      }
    }
  }
});

test('specKey and formatTime are stable', () => {
  assert.equal(core.specKey({ size: 5, order: 'asc', arrangement: 'random', shape: 'circle' }), '5-asc-random-circle');
  assert.equal(core.formatTime(65432), '01:05.4');
});
```

- [x] **Step 2: 运行测试，确认因模块缺失而失败**

Run:

```bash
node --test work/schulte-training/tests/core.test.mjs
```

Expected: `Cannot find module .../src/core.js`.

- [x] **Step 3: 实现最小核心逻辑**

```js
(function (global) {
  function shuffle(items, random = Math.random) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function buildValues(size, order = 'asc', arrangement = 'random', random = Math.random) {
    const total = size * size;
    const values = Array.from({ length: total }, (_, index) => index + 1);
    const ordered = order === 'desc' ? values.reverse() : values;
    return arrangement === 'random' ? shuffle(ordered, random) : ordered;
  }

  function ringCounts(size) {
    if (size % 2 === 1) {
      const rings = Math.floor(size / 2);
      return [1, ...Array.from({ length: rings }, (_, index) => 8 * (index + 1))];
    }
    const rings = size / 2 - 1;
    return [4, ...Array.from({ length: rings }, (_, index) => 12 + index * 8)];
  }

  function createCircularSlots(size) {
    const counts = ringCounts(size);
    const slots = [];
    const centerOffset = 0.095;
    slots.push(
      ...(counts[0] === 1
        ? [{ x: 0.5, y: 0.5 }]
        : [
            { x: 0.5 - centerOffset, y: 0.5 - centerOffset },
            { x: 0.5 + centerOffset, y: 0.5 - centerOffset },
            { x: 0.5 - centerOffset, y: 0.5 + centerOffset },
            { x: 0.5 + centerOffset, y: 0.5 + centerOffset },
          ]),
    );
    const ringTotal = counts.length - 1;
    for (let ring = 1; ring <= ringTotal; ring += 1) {
      const radius = ringTotal === 1 ? 0.42 : 0.21 + (ring - 1) * 0.21;
      const count = counts[ring];
      const angleOffset = ring % 2 === 0 ? Math.PI / count : 0;
      for (let index = 0; index < count; index += 1) {
        const angle = -Math.PI / 2 + angleOffset + (index * Math.PI * 2) / count;
        slots.push({ x: 0.5 + Math.cos(angle) * radius, y: 0.5 + Math.sin(angle) * radius });
      }
    }
    return slots;
  }

  function specKey(settings) {
    return [settings.size, settings.order, settings.arrangement, settings.shape].join('-');
  }

  function formatTime(ms) {
    const totalSeconds = Math.max(0, ms) / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const tenths = Math.floor((totalSeconds * 10) % 10);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths}`;
  }

  const api = { buildValues, createCircularSlots, formatTime, shuffle, specKey };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.SchulteCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
```

- [x] **Step 4: 运行测试，确认通过**

Run:

```bash
node --test work/schulte-training/tests/core.test.mjs
```

Expected: all tests pass, exit code 0.

---

### Task 2: 浏览器验收测试

**Files:**
- Create: `work/schulte-training/tests/browser-smoke.mjs`

- [x] **Step 1: 写浏览器失败测试**

浏览器测试启动一个临时 HTTP 服务，通过 Playwright CLI 验证：

- 默认加载 5×5、共 25 个格子。
- 切换到 3×3 圆形后格子数正确。
- 错误点击会累计错误次数。
- 按正确顺序点击后会显示结果并写入 `localStorage`。
- 页面刷新后最近记录仍保留。
- 4×4 倒序顺序排列会按 16→1 点击。
- 390px 宽度下 6×6 圆形格子无点击区域重叠，且没有横向溢出。

- [x] **Step 2: 运行测试，确认初始因交付文件不存在而失败**

Run:

```bash
node work/schulte-training/tests/browser-smoke.mjs
```

Expected: `.cell` 数量为 0，断言失败。

---

### Task 3: 单文件页面实现与构建

**Files:**
- Create: `work/schulte-training/src/index.html`
- Create: `work/schulte-training/src/styles.css`
- Create: `work/schulte-training/src/app.js`
- Create: `work/schulte-training/build.mjs`
- Create: `outputs/schulte-training.html`

- [x] **Step 1: 写页面模板**

`index.html` 必须包含以下稳定选择器，供测试和逻辑使用：

- `#settings` 设置区，包含 `[data-setting="size"][data-value="3|4|5|6"]`
- `[data-setting="order"][data-value="asc|desc"]`
- `[data-setting="arrangement"][data-value="random|sequential"]`
- `[data-setting="shape"][data-value="square|circle"]`
- `#startBtn`、`#restartBtn`、`#settingsBtn`、`#clearBtn`
- `#timer`、`#target`、`#errors`、`#progressText`、`#progressBar`
- `#board[data-shape]`
- `#resultPanel[hidden]`、`#bestTime`、`#lastTime`、`#lastErrors`
- `#historyList`

模板使用 `/* __STYLES__ */`、`/* __CORE__ */`、`/* __APP__ */` 三个内联占位符。

- [x] **Step 2: 写样式**

样式要求：

- 米白背景 `#f4f0e8`，深色棋盘 `#202522`，强调色 `#e66b3d`。
- `.board[data-shape="square"]` 使用 `grid-template-columns: repeat(var(--size), 1fr)`。
- `.board[data-shape="circle"]` 使用 `position: relative; aspect-ratio: 1`，`.cell` 使用 `--x`、`--y` 绝对定位并 `translate(-50%, -50%)`。
- `.cell.done` 变为浅绿色；`.cell.wrong` 使用红色和轻微抖动；`@media (prefers-reduced-motion: reduce)` 关闭动画。
- 手机宽度下压缩间距、状态栏换行、棋盘宽度保持 `min(92vw, 560px)`。

- [x] **Step 3: 写应用状态机**

`app.js` 必须实现：

```js
const state = {
  settings: { size: 5, order: 'asc', arrangement: 'random', shape: 'square' },
  phase: 'idle',
  values: [],
  current: 1,
  errors: 0,
  startedAt: 0,
  timerId: null,
  elapsed: 0,
};
```

- `renderSettings()` 更新按钮的 `aria-pressed` 和选中样式。
- `startGame()` 按当前设置创建数字与格子，重置计时、错误、目标，`state.phase = 'running'`。
- `handleCellClick(value)` 判断当前目标；正确则标记 `.done` 并推进，错误则添加 `.wrong` 并累计错误。
- 最后一个目标点击完成后调用 `finishGame()`；停止计时、显示结果、写入统计。
- `saveResult()` 使用 `localStorage` key `schulte-training-v1`；最佳成绩按 `specKey(settings)` 分开，最近记录全局最多保留 5 条。
- `renderHistory()` 显示“3×3 圆形 · 正序 · 随机 · 12.4 秒 · 2 错”。
- 页面加载后调用 `renderSettings()`、`renderStats()`，并使用 `requestAnimationFrame` 或 `setInterval(100)` 刷新计时。

- [x] **Step 4: 写构建脚本并生成交付文件**

```js
import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('./', import.meta.url);
const template = await readFile(new URL('./src/index.html', root), 'utf8');
const styles = await readFile(new URL('./src/styles.css', root), 'utf8');
const core = await readFile(new URL('./src/core.js', root), 'utf8');
const app = await readFile(new URL('./src/app.js', root), 'utf8');
const html = template
  .replace('/* __STYLES__ */', styles)
  .replace('/* __CORE__ */', core)
  .replace('/* __APP__ */', app);
await writeFile(new URL('../../outputs/schulte-training.html', root), html);
```

Run:

```bash
node work/schulte-training/build.mjs
```

Expected: `outputs/schulte-training.html` is created and contains no `__STYLES__`, `__CORE__`, or `__APP__` placeholders.

- [x] **Step 5: 运行浏览器验收测试**

Run:

```bash
node work/schulte-training/tests/browser-smoke.mjs
```

Expected: `browser smoke passed`.

---

### Task 4: 视觉与边界验收

**Files:**
- Verify: `outputs/schulte-training.html`

- [x] **Step 1: 用 Playwright 截图检查桌面布局**

Run:

```bash
cd /Users/apple/Documents/Codex/2026-09-28/zo/outputs
python3 -m http.server 8765 --bind 127.0.0.1
# 在另一个终端中执行：
export CODEX_HOME="$HOME/.codex"
export PWCLI="$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh"
"$PWCLI" --session schulte-visual open "http://127.0.0.1:8765/schulte-training.html"
"$PWCLI" --session schulte-visual resize 1280 900
"$PWCLI" --session schulte-visual screenshot
```

Expected: 方形 5×5 棋盘完整可见，设置区、状态栏、控制区和成绩区无重叠。

- [x] **Step 2: 检查圆形 6×6 和手机宽度**

Run:

```bash
"$PWCLI" --session schulte-visual eval 'document.querySelector("[data-setting=size][data-value=6]").click()'
"$PWCLI" --session schulte-visual eval 'document.querySelector("[data-setting=shape][data-value=circle]").click()'
"$PWCLI" --session schulte-visual eval 'document.querySelector("#startBtn").click()'
"$PWCLI" --session schulte-visual resize 390 844
"$PWCLI" --session schulte-visual screenshot
"$PWCLI" --session schulte-visual close
```

Expected: 6×6 圆形棋盘数字不重叠，手机宽度下仍能区分并点击全部格子。

- [x] **Step 3: 最终验证**

Run:

```bash
node --test work/schulte-training/tests/core.test.mjs
node work/schulte-training/tests/browser-smoke.mjs
rg -n '__STYLES__|__CORE__|__APP__' outputs/schulte-training.html
```

Expected: 单元测试和浏览器测试通过；`rg` 没有输出。
