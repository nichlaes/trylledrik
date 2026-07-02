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

import { f1Calendar, f2Calendar } from '../ics.js';

const batch = {
  id: 'abc123',
  name: 'Batch #1',
  stage: 'f1',
  f1Start: '2026-07-02',
  f1Days: 10,
  f2Start: null,
  f2Days: 3,
  flavorings: '',
  rating: null,
  notes: '',
  finishedAt: null,
};
const settings = {
  defaultF1Days: 10,
  defaultF2Days: 3,
  reminderTime: '18:00',
  batchCounter: 1,
};
const DTSTAMP = '20260702T090000Z';

test('f1Calendar contains one bottle event on the target day', () => {
  const ics = f1Calendar(batch, settings, DTSTAMP);
  assert.ok(ics.includes('UID:abc123-bottle@trylledrik'));
  assert.ok(ics.includes('DTSTART:20260712T180000'));
  assert.ok(ics.includes('DTEND:20260712T183000'));
  assert.ok(ics.includes('SUMMARY:\u{1F9EA} Bottle Batch #1'));
  assert.ok(ics.includes(`DTSTAMP:${DTSTAMP}`));
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 1);
});

test('events use floating local time (no Z, no TZID)', () => {
  const ics = f1Calendar(batch, settings, DTSTAMP);
  assert.ok(!/DTSTART:\d{8}T\d{6}Z/.test(ics));
  assert.ok(!ics.includes('TZID'));
});

test('every event carries a display alarm firing at event start', () => {
  const b2 = { ...batch, stage: 'f2', f2Start: '2026-07-12' };
  const ics = f2Calendar(b2, settings, DTSTAMP);
  const events = (ics.match(/BEGIN:VEVENT/g) || []).length;
  const alarms = (ics.match(/BEGIN:VALARM/g) || []).length;
  assert.equal(events, alarms);
  assert.ok(ics.includes('TRIGGER:PT0S'));
  assert.ok(ics.includes('ACTION:DISPLAY'));
});

test('f2Calendar has burp events for days 1..f2Days-1 and a fridge event', () => {
  const b2 = { ...batch, stage: 'f2', f2Start: '2026-07-12', f2Days: 3 };
  const ics = f2Calendar(b2, settings, DTSTAMP);
  assert.ok(ics.includes('UID:abc123-burp-1@trylledrik'));
  assert.ok(ics.includes('UID:abc123-burp-2@trylledrik'));
  assert.ok(!ics.includes('UID:abc123-burp-3@trylledrik'));
  assert.ok(ics.includes('UID:abc123-fridge@trylledrik'));
  assert.ok(ics.includes('DTSTART:20260713T180000')); // burp day 1
  assert.ok(ics.includes('DTSTART:20260714T180000')); // burp day 2
  assert.ok(ics.includes('DTSTART:20260715T180000')); // fridge day
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 3);
});

test('calendar wraps in VCALENDAR and uses CRLF endings throughout', () => {
  const ics = f1Calendar(batch, settings, DTSTAMP);
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  assert.ok(!/[^\r]\n/.test(ics), 'found a bare LF');
});

test('late reminder time rolls DTEND to the next day', () => {
  const late = { ...settings, reminderTime: '23:45' };
  const ics = f1Calendar(batch, late, DTSTAMP);
  assert.ok(ics.includes('DTSTART:20260712T234500'));
  assert.ok(ics.includes('DTEND:20260713T001500'));
});

test('batch names with commas are escaped in summaries', () => {
  const spicy = { ...batch, name: 'Ginger, extra hot' };
  const ics = f1Calendar(spicy, settings, DTSTAMP);
  assert.ok(ics.includes('Ginger\\, extra hot'));
});
