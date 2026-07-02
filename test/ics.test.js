import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, daysBetween, escapeText, foldLine } from '../ics.js';

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

test('escapeText escapes commas, semicolons, backslashes, newlines', () => {
  assert.equal(escapeText('a,b;c\\d\ne'), 'a\\,b\\;c\\\\d\\ne');
});

test('escapeText leaves plain text alone', () => {
  assert.equal(escapeText('Batch #1'), 'Batch #1');
});

test('foldLine leaves short lines alone', () => {
  assert.equal(foldLine('SUMMARY:short'), 'SUMMARY:short');
});

test('foldLine folds long lines at 75 octets with space continuation', () => {
  const line = 'SUMMARY:' + 'x'.repeat(100);
  const physical = foldLine(line).split('\r\n');
  assert.equal(physical.length, 2);
  assert.equal(physical[0].length, 75);
  assert.ok(physical[1].startsWith(' '));
  // unfolding (drop the leading space of continuations) restores the line
  const unfolded = physical.map((l, i) => (i === 0 ? l : l.slice(1))).join('');
  assert.equal(unfolded, line);
});

test('foldLine counts octets, not characters', () => {
  const line = 'SUMMARY:' + '\u{1FAE7}'.repeat(30); // 🫧 is 4 octets in UTF-8
  const enc = new TextEncoder();
  for (const physical of foldLine(line).split('\r\n')) {
    assert.ok(enc.encode(physical).length <= 75);
  }
});
