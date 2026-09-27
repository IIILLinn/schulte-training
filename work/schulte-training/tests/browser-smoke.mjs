import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const outputPath = fileURLToPath(new URL('../../../outputs/schulte-training.html', import.meta.url));
const pwcli = process.env.PWCLI || `${process.env.HOME}/.codex/skills/playwright/scripts/playwright_cli.sh`;
const session = `schulte-smoke-${process.pid}`;
const server = createServer(async (_request, response) => {
  try {
    const body = await readFile(outputPath);
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(body);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('not found');
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const outputUrl = `http://127.0.0.1:${server.address().port}/schulte-training.html`;

const overlapExpression = `(() => {
  const boxes = [...document.querySelectorAll('.cell')].map((el) => el.getBoundingClientRect());
  let overlaps = 0;
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i];
      const b = boxes[j];
      const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (width > 0.5 && height > 0.5) overlaps += 1;
    }
  }
  return overlaps;
})()`;

const consecutiveExpression = `(() => {
  const cells = [...document.querySelectorAll('.cell')];
  const byValue = new Map(cells.map((cell) => [Number(cell.dataset.value), cell]));
  let minimum = Infinity;
  for (let value = 1; value < cells.length; value += 1) {
    const a = byValue.get(value).getBoundingClientRect();
    const b = byValue.get(value + 1).getBoundingClientRect();
    minimum = Math.min(minimum, Math.hypot(
      (a.left + a.width / 2) - (b.left + b.width / 2),
      (a.top + a.height / 2) - (b.top + b.height / 2),
    ));
  }
  return minimum;
})()`;

const layoutExpression = `[...document.querySelectorAll('.cell')]
  .map((cell) => [cell.style.getPropertyValue('--x'), cell.style.getPropertyValue('--y')].join(','))
  .join('|')`;

async function cli(args) {
  const { stdout } = await execFileAsync(pwcli, ['--session', session, '--json', ...args], { encoding: 'utf8' });
  const payload = JSON.parse(stdout);
  if (payload.result?.isError) throw new Error(payload.result.error || payload.result);
  return payload.result;
}

function normalizeResult(value) {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

async function evaluate(expression) {
  return normalizeResult(await cli(['eval', expression]));
}

async function select(setting, value) {
  await evaluate(`document.querySelector('[data-setting="${setting}"][data-value="${value}"]').click()`);
}

try {
  await cli(['open', outputUrl]);
  assert.equal(Number(await evaluate('document.querySelectorAll(".cell").length')), 25);
  assert.equal(await evaluate('document.querySelector(\'[data-setting="order"]\') === null'), true);
  assert.equal(await evaluate('document.querySelector(\'[data-setting="arrangement"]\') === null'), true);
  assert.equal(await evaluate('document.querySelector(\'[data-setting="size"][data-value="7"]\').textContent'), '7×7');
  assert.equal(await evaluate('document.querySelector(\'[data-setting="shape"][data-value="irregular"]\') === null'), true);

  await select('size', 7);
  await evaluate('document.querySelector("#startBtn").click()');
  assert.equal(Number(await evaluate('document.querySelectorAll(".cell").length')), 49);
  assert.equal(await evaluate('[...document.querySelectorAll(".cell")].map((cell) => Number(cell.dataset.value)).sort((a, b) => a - b).every((value, index) => value === index + 1)'), true);

  await evaluate('document.querySelector("#settingsBtn").click()');
  await select('shape', 'circle');
  await select('size', 15);
  await evaluate('document.querySelector("#startBtn").click()');
  assert.equal(Number(await evaluate('document.querySelectorAll(".cell").length')), 15);
  assert.equal(await evaluate('document.querySelector("#board").dataset.shape'), 'circle');
  assert.equal(await evaluate('document.querySelector(".shape-outline circle") !== null'), true);

  const circleLayoutFirst = await evaluate(layoutExpression);
  await evaluate('document.querySelector("#restartBtn").click()');
  const circleLayoutSecond = await evaluate(layoutExpression);
  assert.notEqual(circleLayoutFirst, circleLayoutSecond);
  assert.equal(Number(await evaluate(overlapExpression)), 0);

  const circleCellWidth = Number(await evaluate('Math.min(...[...document.querySelectorAll(".cell")].map((cell) => cell.getBoundingClientRect().width))'));
  const circleConsecutive = Number(await evaluate(consecutiveExpression));
  assert.ok(circleConsecutive >= circleCellWidth * 1.2, `circle consecutive distance ${circleConsecutive} < ${circleCellWidth * 1.2}`);

  await evaluate('[...document.querySelectorAll(".cell")].find((cell) => cell.dataset.value !== "1").click()');
  assert.equal(Number(await evaluate('document.querySelector("#errors").textContent')), 1);

  const immediateCorrectFeedback = await evaluate(`(() => { const cell = document.querySelector('.cell[data-value="1"]'); cell.click(); return cell.classList.contains('correct'); })()`);
  assert.equal(immediateCorrectFeedback, true);
  await new Promise((resolve) => setTimeout(resolve, 500));
  assert.equal(await evaluate('document.querySelector(\'.cell[data-value="1"]\').classList.contains("correct")'), false);
  assert.equal(await evaluate('document.querySelector(\'.cell[data-value="1"]\').disabled'), true);

  await evaluate('[...document.querySelectorAll(".cell")].sort((a, b) => Number(a.dataset.value) - Number(b.dataset.value)).filter((cell) => Number(cell.dataset.value) > 1).forEach((cell) => cell.click())');
  assert.equal(await evaluate('document.querySelector("#resultPanel").hidden'), false);
  assert.equal(await evaluate('localStorage.getItem("schulte-training-v1").includes("circle-15")'), true);
  assert.match(await evaluate('document.querySelector("#historyList").textContent'), /15 个数字/);

  await cli(['reload']);
  assert.match(await evaluate('document.querySelector("#historyList").textContent'), /15 个数字/);

  await select('shape', 'circle');
  await select('size', 50);
  await evaluate('document.querySelector("#startBtn").click()');
  assert.equal(Number(await evaluate('document.querySelectorAll(".cell").length')), 50);
  assert.equal(await evaluate('document.querySelector("#board").dataset.shape'), 'circle');
  assert.equal(await evaluate('document.querySelector(".shape-outline circle") !== null'), true);
  const circle50LayoutFirst = await evaluate(layoutExpression);
  await evaluate('document.querySelector("#restartBtn").click()');
  const circle50LayoutSecond = await evaluate(layoutExpression);
  assert.notEqual(circle50LayoutFirst, circle50LayoutSecond);
  assert.equal(Number(await evaluate(overlapExpression)), 0);

  const circle50CellWidth = Number(await evaluate('Math.min(...[...document.querySelectorAll(".cell")].map((cell) => cell.getBoundingClientRect().width))'));
  const circle50Consecutive = Number(await evaluate(consecutiveExpression));
  assert.ok(circle50Consecutive >= circle50CellWidth * 1.2, `circle 50 consecutive distance ${circle50Consecutive} < ${circle50CellWidth * 1.2}`);

  await cli(['resize', '390', '844']);
  assert.equal(Number(await evaluate(overlapExpression)), 0);
  assert.equal(Number(await evaluate('document.documentElement.scrollWidth')), 390);

  const consoleErrors = await cli(['console', 'error']);
  assert.match(consoleErrors, /Errors: 0/);
  console.log('browser smoke passed');
} finally {
  await execFileAsync(pwcli, ['--session', session, 'close'], { encoding: 'utf8' }).catch(() => {});
  await new Promise((resolve) => server.close(resolve));
}
