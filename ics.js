// Pure date + iCalendar helpers. No DOM, no storage — unit-tested in Node.
// All dates are local-time "YYYY-MM-DD" strings. Date math is done in UTC
// on split components so DST shifts can never skew a day.

export function addDays(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function daysBetween(fromIso, toIso) {
  const [fy, fm, fd] = fromIso.split('-').map(Number);
  const [ty, tm, td] = toIso.split('-').map(Number);
  return Math.round(
    (Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000
  );
}

// RFC 5545 §3.3.11 TEXT escaping. Backslash must be escaped first.
export function escapeText(s) {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

// RFC 5545 §3.1: physical lines are at most 75 octets; continuations start
// with a single space (which counts toward the 75).
export function foldLine(line) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out = [];
  let cur = '';
  let curLen = 0;
  for (const ch of line) {
    const len = enc.encode(ch).length;
    if (curLen + len > 75) {
      out.push(cur);
      cur = ' ';
      curLen = 1;
    }
    cur += ch;
    curLen += len;
  }
  out.push(cur);
  return out.join('\r\n');
}

// "18:00" -> { start: "180000", end: "183000", endNextDay: false }.
// Events are 30 minutes long; an end past midnight rolls to the next day.
function eventTimes(time) {
  const [h, m] = time.split(':').map(Number);
  const startMin = h * 60 + m;
  const endMin = startMin + 30;
  const fmt = (min) =>
    String(Math.floor((min % 1440) / 60)).padStart(2, '0') +
    String(min % 60).padStart(2, '0') +
    '00';
  return { start: fmt(startMin), end: fmt(endMin), endNextDay: endMin >= 1440 };
}

// One VEVENT (as an array of unfolded lines) with a display alarm at start.
// Times are floating local time so Calendar uses the device's timezone.
function makeEvent({ uid, date, time, summary, dtstamp }) {
  const { start, end, endNextDay } = eventTimes(time);
  const endDate = endNextDay ? addDays(date, 1) : date;
  return [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${date.replaceAll('-', '')}T${start}`,
    `DTEND:${endDate.replaceAll('-', '')}T${end}`,
    `SUMMARY:${escapeText(summary)}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(summary)}`,
    'TRIGGER:PT0S',
    'END:VALARM',
    'END:VEVENT',
  ];
}

function calendar(events) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//trylledrik//kombucha tracker//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...events.flat(),
    'END:VCALENDAR',
  ];
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

export function f1Calendar(batch, settings, dtstamp) {
  return calendar([
    makeEvent({
      uid: `${batch.id}-bottle@trylledrik`,
      date: addDays(batch.f1Start, batch.f1Days),
      time: settings.reminderTime,
      summary: `\u{1F9EA} Bottle ${batch.name}`,
      dtstamp,
    }),
  ]);
}

export function f2Calendar(batch, settings, dtstamp) {
  const events = [];
  for (let n = 1; n < batch.f2Days; n++) {
    events.push(
      makeEvent({
        uid: `${batch.id}-burp-${n}@trylledrik`,
        date: addDays(batch.f2Start, n),
        time: settings.reminderTime,
        summary: `\u{1FAE7} Burp ${batch.name}`,
        dtstamp,
      })
    );
  }
  events.push(
    makeEvent({
      uid: `${batch.id}-fridge@trylledrik`,
      date: addDays(batch.f2Start, batch.f2Days),
      time: settings.reminderTime,
      summary: `\u{2744}\u{FE0F} ${batch.name} \u{2192} fridge`,
      dtstamp,
    })
  );
  return calendar(events);
}
