import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SETTINGS,
  startBatch,
  bottleBatch,
  finishBatch,
  updateBatch,
  deleteBatch,
  validateImport,
} from '../store.js';

function fresh() {
  return { batches: [], settings: { ...DEFAULT_SETTINGS } };
}

test('startBatch adds an f1 batch with defaults and bumps the counter', () => {
  const s0 = fresh();
  const s1 = startBatch(s0, { id: 'a1', name: '', f1Start: '2026-07-02', f1Days: 10 });
  assert.equal(s1.batches.length, 1);
  const b = s1.batches[0];
  assert.equal(b.name, 'Batch #1');
  assert.equal(b.stage, 'f1');
  assert.equal(b.f1Start, '2026-07-02');
  assert.equal(b.f1Days, 10);
  assert.equal(b.f2Start, null);
  assert.equal(b.f2Days, DEFAULT_SETTINGS.defaultF2Days);
  assert.equal(b.flavorings, '');
  assert.equal(b.rating, null);
  assert.equal(b.finishedAt, null);
  assert.equal(s1.settings.batchCounter, 1);
  assert.equal(s0.batches.length, 0, 'input state must not be mutated');
});

test('startBatch keeps a custom name but still bumps the counter', () => {
  const s1 = startBatch(fresh(), { id: 'a1', name: 'Ginger dragon', f1Start: '2026-07-02', f1Days: 12 });
  assert.equal(s1.batches[0].name, 'Ginger dragon');
  assert.equal(s1.settings.batchCounter, 1);
});

test('bottleBatch moves the batch to f2 with flavorings', () => {
  const s1 = startBatch(fresh(), { id: 'a1', name: '', f1Start: '2026-07-02', f1Days: 10 });
  const s2 = bottleBatch(s1, 'a1', { flavorings: 'ginger, lemon', f2Start: '2026-07-12', f2Days: 3 });
  const b = s2.batches[0];
  assert.equal(b.stage, 'f2');
  assert.equal(b.flavorings, 'ginger, lemon');
  assert.equal(b.f2Start, '2026-07-12');
  assert.equal(b.f2Days, 3);
  assert.equal(s1.batches[0].stage, 'f1', 'input state must not be mutated');
});

test('finishBatch records rating, notes and finish date', () => {
  let s = startBatch(fresh(), { id: 'a1', name: '', f1Start: '2026-07-02', f1Days: 10 });
  s = bottleBatch(s, 'a1', { flavorings: 'raspberry', f2Start: '2026-07-12', f2Days: 3 });
  s = finishBatch(s, 'a1', { rating: 4, notes: 'nice fizz', finishedAt: '2026-07-15' });
  const b = s.batches[0];
  assert.equal(b.stage, 'done');
  assert.equal(b.rating, 4);
  assert.equal(b.notes, 'nice fizz');
  assert.equal(b.finishedAt, '2026-07-15');
});

test('updateBatch merges fields', () => {
  const s1 = startBatch(fresh(), { id: 'a1', name: '', f1Start: '2026-07-02', f1Days: 10 });
  const s2 = updateBatch(s1, 'a1', { name: 'Renamed', f1Days: 14 });
  assert.equal(s2.batches[0].name, 'Renamed');
  assert.equal(s2.batches[0].f1Days, 14);
  assert.equal(s2.batches[0].stage, 'f1');
});

test('deleteBatch removes only the given id', () => {
  let s = startBatch(fresh(), { id: 'a1', name: '', f1Start: '2026-07-02', f1Days: 10 });
  s = startBatch(s, { id: 'a2', name: '', f1Start: '2026-07-03', f1Days: 10 });
  s = deleteBatch(s, 'a1');
  assert.equal(s.batches.length, 1);
  assert.equal(s.batches[0].id, 'a2');
});

test('validateImport accepts a round-tripped state', () => {
  const s = startBatch(fresh(), { id: 'a1', name: '', f1Start: '2026-07-02', f1Days: 10 });
  assert.ok(validateImport(JSON.parse(JSON.stringify(s))));
});

test('validateImport accepts missing settings', () => {
  assert.ok(validateImport({ batches: [] }));
});

test('validateImport rejects junk', () => {
  assert.ok(!validateImport(null));
  assert.ok(!validateImport('hello'));
  assert.ok(!validateImport([]));
  assert.ok(!validateImport({ batches: 'nope' }));
  assert.ok(!validateImport({ batches: [{ id: 1 }] }));
  assert.ok(!validateImport({ batches: [], settings: [] }));
  assert.ok(!validateImport({
    batches: [{ id: 'a', name: 'x', stage: 'weird', f1Start: '2026-07-02', f1Days: 10 }],
  }));
});

test('validateImport rejects f2 batch with missing f2 fields', () => {
  assert.ok(!validateImport({
    batches: [{ id: 'a', name: 'x', stage: 'f2', f1Start: '2026-07-02', f1Days: 10 }],
  }));
  assert.ok(!validateImport({
    batches: [{
      id: 'a',
      name: 'x',
      stage: 'done',
      f1Start: '2026-07-02',
      f1Days: 10,
      f2Start: null,
      f2Days: 3,
    }],
  }));
});

test('validateImport accepts f2 batch with valid f2 fields', () => {
  assert.ok(validateImport({
    batches: [{
      id: 'a',
      name: 'x',
      stage: 'f2',
      f1Start: '2026-07-02',
      f1Days: 10,
      f2Start: '2026-07-12',
      f2Days: 3,
    }],
  }));
});

test('validateImport rejects malicious or malformed ids', () => {
  assert.ok(!validateImport({
    batches: [{ id: '"><img src=x>', name: 'x', stage: 'f1', f1Start: '2026-07-02', f1Days: 10 }],
  }));
  assert.ok(!validateImport({
    batches: [{ id: '', name: 'x', stage: 'f1', f1Start: '2026-07-02', f1Days: 10 }],
  }));
});
