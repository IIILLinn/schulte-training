import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const core = require('../src/core.js');

const COUNTS = [15, 20, 25, 30, 35, 40, 45, 50];

function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function pairwiseMinDistance(slots) {
  let minimum = Infinity;
  for (let i = 0; i < slots.length; i += 1) {
    for (let j = i + 1; j < slots.length; j += 1) {
      minimum = Math.min(minimum, Math.hypot(slots[i].x - slots[j].x, slots[i].y - slots[j].y));
    }
  }
  return minimum;
}

function consecutiveMinDistance(values, slots) {
  const slotByValue = new Map();
  slots.forEach((slot, index) => slotByValue.set(values[index], slot));
  let minimum = Infinity;
  for (let value = 1; value < values.length; value += 1) {
    const a = slotByValue.get(value);
    const b = slotByValue.get(value + 1);
    minimum = Math.min(minimum, Math.hypot(a.x - b.x, a.y - b.y));
  }
  return minimum;
}

test('buildValues returns the full shuffled range for arbitrary counts', () => {
  for (const count of COUNTS) {
    const values = core.buildValues(count, seeded(count));
    assert.equal(values.length, count);
    assert.deepEqual([...values].sort((a, b) => a - b), Array.from({ length: count }, (_, index) => index + 1));
  }
});

test('createCircularLayout supports every configured count without overlaps', () => {
  for (const count of COUNTS) {
    const { slots, cellRatio } = core.createCircularLayout(count, seeded(count));
    assert.equal(slots.length, count);
    assert.ok(slots.every(({ x, y }) => x >= 0.04 && x <= 0.96 && y >= 0.04 && y <= 0.96));
    assert.ok(pairwiseMinDistance(slots) >= cellRatio, `circle ${count} overlaps`);
  }
});

test('circle layout exposes a stable circular outline', () => {
  const circle = core.createCircularLayout(50, seeded(1));
  assert.ok(circle.outline.length >= 32);
  const radii = circle.outline.map((point) => Math.hypot(point.x - 0.5, point.y - 0.5));
  assert.ok(Math.max(...radii) - Math.min(...radii) < 0.02);
});

test('createCircularLayout changes between random seeds', () => {
  const first = core.createCircularLayout(50, seeded(1));
  const second = core.createCircularLayout(50, seeded(2));
  assert.notDeepEqual(first.slots.map(({ x, y }) => [x, y]), second.slots.map(({ x, y }) => [x, y]));
});

test('assignValuesToSlots spreads consecutive numbers apart', () => {
  for (const count of COUNTS) {
    const circular = core.createCircularLayout(count, seeded(count));
    const values = core.assignValuesToSlots(circular.slots, seeded(count + 100));
    assert.deepEqual([...values].sort((a, b) => a - b), Array.from({ length: count }, (_, index) => index + 1));
    assert.ok(consecutiveMinDistance(values, circular.slots) >= circular.cellRatio * 1.35, `circle ${count} keeps consecutive numbers too close`);
  }
});

test('irregular layout API is removed', () => {
  assert.equal(core.createIrregularLayout, undefined);
});

test('specKey follows the simplified shape-size model', () => {
  assert.equal(core.specKey({ shape: 'square', squareSize: 7 }), 'square-7x7');
  assert.equal(core.specKey({ shape: 'circle', count: 30 }), 'circle-30');
});

test('formatTime is stable', () => {
  assert.equal(core.formatTime(65432), '01:05.4');
});
