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
