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
