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

test('createIrregularLayout creates chaotic layouts that change by seed', () => {
  const first = core.createIrregularLayout(50, seeded(1));
  const second = core.createIrregularLayout(50, seeded(2));
  assert.equal(first.slots.length, 50);
  assert.equal(second.slots.length, 50);
  assert.notDeepEqual(first.slots.map(({ x, y }) => [x, y]), second.slots.map(({ x, y }) => [x, y]));
  assert.ok(first.slots.every(({ x, y }) => x >= 0.03 && x <= 0.97 && y >= 0.03 && y <= 0.97));
  assert.ok(pairwiseMinDistance(first.slots) >= first.cellRatio, 'irregular 50 overlaps');
  assert.ok(first.cellRatio > 0 && first.cellRatio < 0.2);
});

test('specKey follows the simplified shape-size model', () => {
  assert.equal(core.specKey({ shape: 'square', squareSize: 7 }), 'square-7x7');
  assert.equal(core.specKey({ shape: 'circle', count: 30 }), 'circle-30');
  assert.equal(core.specKey({ shape: 'irregular', count: 50 }), 'irregular-50');
});


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

test('createCircularLayout changes between random seeds', () => {
  const first = core.createCircularLayout(50, seeded(1));
  const second = core.createCircularLayout(50, seeded(2));
  assert.notDeepEqual(first.slots.map(({ x, y }) => [x, y]), second.slots.map(({ x, y }) => [x, y]));
});

test('assignValuesToSlots spreads consecutive numbers apart', () => {
  for (const count of COUNTS) {
    const circular = core.createCircularLayout(count, seeded(count));
    const circularValues = core.assignValuesToSlots(circular.slots, seeded(count + 100));
    assert.deepEqual([...circularValues].sort((a, b) => a - b), Array.from({ length: count }, (_, index) => index + 1));
    assert.ok(consecutiveMinDistance(circularValues, circular.slots) >= circular.cellRatio * 1.35, `circle ${count} keeps consecutive numbers too close`);

    const irregular = core.createIrregularLayout(count, seeded(count + 200));
    const irregularValues = core.assignValuesToSlots(irregular.slots, seeded(count + 300));
    assert.ok(consecutiveMinDistance(irregularValues, irregular.slots) >= irregular.cellRatio * 1.35, `irregular ${count} keeps consecutive numbers too close`);
  }
});

test('formatTime is stable', () => {
  assert.equal(core.formatTime(65432), '01:05.4');
});
