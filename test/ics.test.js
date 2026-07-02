import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, daysBetween } from '../ics.js';

test('addDays adds within a month', () => {
  assert.equal(addDays('2026-07-02', 10), '2026-07-12');
});

test('addDays crosses month boundary', () => {
  assert.equal(addDays('2026-07-28', 5), '2026-08-02');
});

test('addDays crosses year boundary', () => {
  assert.equal(addDays('2026-12-30', 3), '2027-01-02');
});

test('addDays handles leap day', () => {
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
});

test('addDays with 0 days is identity', () => {
  assert.equal(addDays('2026-07-02', 0), '2026-07-02');
});

test('daysBetween counts elapsed days', () => {
  assert.equal(daysBetween('2026-07-02', '2026-07-08'), 6);
});

test('daysBetween is zero for same day', () => {
  assert.equal(daysBetween('2026-07-02', '2026-07-02'), 0);
});

test('daysBetween is negative when to is before from', () => {
  assert.equal(daysBetween('2026-07-02', '2026-06-30'), -2);
});
