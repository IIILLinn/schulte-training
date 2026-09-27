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

try {
  await cli(['open', outputUrl]);
  assert.equal(Number(await evaluate('document.querySelectorAll(".cell").length')), 25);
  await evaluate(`document.querySelector('[data-setting="size"][data-value="3"]').click()`);
  await evaluate(`document.querySelector('[data-setting="shape"][data-value="circle"]').click()`);
  await evaluate('document.querySelector("#startBtn").click()');
  assert.equal(Number(await evaluate('document.querySelectorAll(".cell").length')), 9);
  assert.equal(await evaluate('document.querySelector("#board").dataset.shape'), 'circle');
  await evaluate('[...document.querySelectorAll(".cell")].find((cell) => cell.dataset.value !== "1").click()');
  assert.equal(Number(await evaluate('document.querySelector("#errors").textContent')), 1);
  await evaluate('[...document.querySelectorAll(".cell")].sort((a,b)=>Number(a.dataset.value)-Number(b.dataset.value)).forEach((cell)=>cell.click())');
  assert.equal(await evaluate('document.querySelector("#resultPanel").hidden'), false);
  assert.match(await evaluate('document.querySelector("#historyList").textContent'), /3×3/);
  assert.match(await evaluate('localStorage.getItem("schulte-training-v1")'), /"size":3/);
  await cli(['reload']);
  assert.match(await evaluate('document.querySelector("#historyList").textContent'), /3×3/);

  await evaluate(`document.querySelector('[data-setting="size"][data-value="4"]').click()`);
  await evaluate(`document.querySelector('[data-setting="order"][data-value="desc"]').click()`);
  await evaluate(`document.querySelector('[data-setting="arrangement"][data-value="sequential"]').click()`);
  await evaluate('document.querySelector("#startBtn").click()');
  assert.equal(await evaluate('[...document.querySelectorAll(".cell")].map((cell) => cell.textContent).join(",")'), '16,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1');
  await evaluate('[...document.querySelectorAll(".cell")].sort((a,b)=>Number(b.dataset.value)-Number(a.dataset.value)).forEach((cell)=>cell.click())');
  assert.equal(await evaluate('document.querySelector("#resultPanel").hidden'), false);
  assert.match(await evaluate('document.querySelector("#historyList").textContent'), /4×4/);

  await cli(['reload']);
  await cli(['resize', '390', '844']);
  await evaluate(`document.querySelector('[data-setting="size"][data-value="6"]').click()`);
  await evaluate(`document.querySelector('[data-setting="shape"][data-value="circle"]').click()`);
  await evaluate('document.querySelector("#startBtn").click()');
  const overlapCount = await evaluate('(() => { const boxes=[...document.querySelectorAll(".cell")].map((el)=>el.getBoundingClientRect()); let overlaps=0; for(let i=0;i<boxes.length;i+=1){ for(let j=i+1;j<boxes.length;j+=1){ const a=boxes[i], b=boxes[j]; const w=Math.min(a.right,b.right)-Math.max(a.left,b.left); const h=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top); if(w>0.5&&h>0.5) overlaps+=1; } } return overlaps; })()');
  assert.equal(Number(overlapCount), 0);
  assert.equal(Number(await evaluate('document.documentElement.scrollWidth')), 390);
  console.log('browser smoke passed');
} finally {
  await execFileAsync(pwcli, ['--session', session, 'close'], { encoding: 'utf8' }).catch(() => {});
  await new Promise((resolve) => server.close(resolve));
}
