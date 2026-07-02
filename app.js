import { addDays, daysBetween, f1Calendar, f2Calendar } from './ics.js';
import {
  DEFAULT_SETTINGS,
  startBatch,
  bottleBatch,
  finishBatch,
  updateBatch,
  deleteBatch,
} from './store.js';

const BATCHES_KEY = 'trylledrik.batches';
const SETTINGS_KEY = 'trylledrik.settings';

// Corrupt JSON is stashed under <key>.backup instead of being destroyed.
function loadKey(key, fallback) {
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    localStorage.setItem(key + '.backup', raw);
    return fallback;
  }
}

let state = {
  batches: loadKey(BATCHES_KEY, []),
  settings: { ...DEFAULT_SETTINGS, ...loadKey(SETTINGS_KEY, {}) },
};

function save() {
  localStorage.setItem(BATCHES_KEY, JSON.stringify(state.batches));
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
}

function setState(next) {
  state = next;
  save();
  render();
}

const $ = (sel) => document.querySelector(sel);

function esc(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// "2026-07-12" -> "12 Jul". Parsed at local noon so timezones can't shift the day.
function fmtDate(iso) {
  return new Date(iso + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function downloadFile(filename, text, mime) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// --- tabs ---
document.querySelectorAll('.tab').forEach((btn) =>
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b === btn));
    for (const t of ['brews', 'history', 'settings']) {
      $('#tab-' + t).hidden = t !== btn.dataset.tab;
    }
  })
);

// --- settings ---
$('#settings-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  setState({
    ...state,
    settings: {
      ...state.settings,
      defaultF1Days: Number(f.defaultF1Days.value),
      defaultF2Days: Number(f.defaultF2Days.value),
      reminderTime: f.reminderTime.value,
    },
  });
});

function batchCard(b) {
  const inF1 = b.stage === 'f1';
  const start = inF1 ? b.f1Start : b.f2Start;
  const days = inF1 ? b.f1Days : b.f2Days;
  const day = Math.max(0, daysBetween(start, todayIso()) + 1);
  const target = addDays(start, days);
  const overdue = day > days;
  const pct = Math.min(100, (day / days) * 100);
  return `
  <article class="card ${overdue ? 'overdue' : ''}" data-id="${b.id}">
    <header>
      <h3>${esc(b.name)}</h3>
      <span class="badge ${b.stage}">${inF1 ? 'F1 &middot; jar' : 'F2 &middot; bottles'}</span>
    </header>
    ${b.flavorings ? `<p class="flavorings">${esc(b.flavorings)}</p>` : ''}
    <p class="day">Day ${day} of ${days}${overdue ? ' &mdash; over target!' : ''}</p>
    <div class="progress"><div style="width:${pct}%"></div></div>
    <p class="next">${inF1 ? 'Bottle' : 'Fridge'} on ${fmtDate(target)}</p>
    <menu>
      <button type="button" data-act="calendar" title="Download calendar reminders">&#x1F4C6;</button>
      <button type="button" data-act="edit">Edit</button>
      <button type="button" data-act="stage" class="primary">${inF1 ? 'Bottle it' : 'Finish'}</button>
    </menu>
  </article>`;
}

function historyCard(b) {
  const stars = b.rating
    ? '&#x2605;'.repeat(b.rating) + '&#x2606;'.repeat(5 - b.rating)
    : '&mdash;';
  return `
  <article class="card">
    <header>
      <h3>${esc(b.name)}</h3>
      <span class="stars">${stars}</span>
    </header>
    <p class="dates">${fmtDate(b.f1Start)} &rarr; ${b.finishedAt ? fmtDate(b.finishedAt) : '?'}</p>
    ${b.flavorings ? `<p class="flavorings">${esc(b.flavorings)}</p>` : ''}
    ${b.notes ? `<p class="notes">${esc(b.notes)}</p>` : ''}
  </article>`;
}

function render() {
  const active = state.batches.filter((b) => b.stage !== 'done');
  $('#batch-list').innerHTML = active.length
    ? active.map(batchCard).join('')
    : '<p class="empty">No brews going. Start one! \u{1FAD9}</p>';

  const done = state.batches
    .filter((b) => b.stage === 'done')
    .sort((a, b) => (b.finishedAt || '').localeCompare(a.finishedAt || ''));
  $('#history-list').innerHTML = done.length
    ? done.map(historyCard).join('')
    : '<p class="empty">Nothing finished yet.</p>';

  const f = $('#settings-form');
  f.defaultF1Days.value = state.settings.defaultF1Days;
  f.defaultF2Days.value = state.settings.defaultF2Days;
  f.reminderTime.value = state.settings.reminderTime;
}

// --- calendar downloads ---
function dtstampNow() {
  return new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
}

function slug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'batch';
}

function downloadCalendar(b) {
  if (b.stage === 'f1') {
    downloadFile(`${slug(b.name)}-f1.ics`, f1Calendar(b, state.settings, dtstampNow()), 'text/calendar');
  } else if (b.stage === 'f2') {
    downloadFile(`${slug(b.name)}-f2.ics`, f2Calendar(b, state.settings, dtstampNow()), 'text/calendar');
  }
}

// --- new batch ---
// dialog.returnValue persists across opens, so Escape after an earlier OK
// would read as "ok" — openDialog clears it every time.
function openDialog(sel) {
  const dlg = $(sel);
  dlg.returnValue = '';
  dlg.showModal();
}

$('#new-batch').addEventListener('click', () => {
  const f = $('#form-new');
  f.reset();
  f.f1Start.value = todayIso();
  f.f1Days.value = state.settings.defaultF1Days;
  openDialog('#dlg-new');
});

$('#dlg-new').addEventListener('close', () => {
  if ($('#dlg-new').returnValue !== 'ok') return;
  const f = $('#form-new');
  const id = Math.random().toString(36).slice(2, 10);
  const next = startBatch(state, {
    id,
    name: f.batchName.value.trim(),
    f1Start: f.f1Start.value,
    f1Days: Number(f.f1Days.value),
  });
  setState(next);
  downloadCalendar(next.batches.find((b) => b.id === id));
});

// --- card actions (event delegation) ---
let actionBatchId = null;

$('#batch-list').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const id = btn.closest('.card').dataset.id;
  const b = state.batches.find((x) => x.id === id);
  if (!b) return;
  actionBatchId = id;
  if (btn.dataset.act === 'calendar') downloadCalendar(b);
  else if (btn.dataset.act === 'edit') openEdit(b);
  else if (btn.dataset.act === 'stage') (b.stage === 'f1' ? openBottle : openFinish)(b);
});

// --- bottle ---
function openBottle(b) {
  const f = $('#form-bottle');
  f.reset();
  f.flavorings.value = b.flavorings;
  f.f2Start.value = todayIso();
  f.f2Start.min = b.f1Start;
  f.f2Days.value = b.f2Days || state.settings.defaultF2Days;
  openDialog('#dlg-bottle');
}

$('#dlg-bottle').addEventListener('close', () => {
  if ($('#dlg-bottle').returnValue !== 'ok') return;
  const f = $('#form-bottle');
  const next = bottleBatch(state, actionBatchId, {
    flavorings: f.flavorings.value.trim(),
    f2Start: f.f2Start.value,
    f2Days: Number(f.f2Days.value),
  });
  setState(next);
  downloadCalendar(next.batches.find((b) => b.id === actionBatchId));
});

// --- finish ---
function openFinish(b) {
  $('#form-finish').reset();
  openDialog('#dlg-finish');
}

$('#dlg-finish').addEventListener('close', () => {
  if ($('#dlg-finish').returnValue !== 'ok') return;
  const f = $('#form-finish');
  setState(
    finishBatch(state, actionBatchId, {
      rating: Number(f.rating.value),
      notes: f.notes.value.trim(),
      finishedAt: todayIso(),
    })
  );
});

// --- edit / delete ---
function openEdit(b) {
  const f = $('#form-edit');
  f.reset();
  f.batchName.value = b.name;
  f.f1Start.value = b.f1Start;
  f.f1Days.value = b.f1Days;
  const inF2 = b.stage === 'f2';
  $('#edit-f2-fields').hidden = !inF2;
  f.f2Start.required = inF2;
  f.f2Days.required = inF2;
  if (inF2) {
    f.f2Start.value = b.f2Start;
    f.f2Start.min = b.f1Start;
    f.f2Days.value = b.f2Days;
  }
  openDialog('#dlg-edit');
}

$('#dlg-edit').addEventListener('close', () => {
  const rv = $('#dlg-edit').returnValue;
  const b = state.batches.find((x) => x.id === actionBatchId);
  if (!b) return;
  if (rv === 'delete') {
    if (confirm(`Delete "${b.name}"? Remember to remove its calendar events by hand.`)) {
      setState(deleteBatch(state, actionBatchId));
    }
    return;
  }
  if (rv !== 'ok') return;
  const f = $('#form-edit');
  const fields = {
    name: f.batchName.value.trim() || b.name,
    f1Start: f.f1Start.value,
    f1Days: Number(f.f1Days.value),
  };
  if (b.stage === 'f2') {
    fields.f2Start = f.f2Start.value;
    fields.f2Days = Number(f.f2Days.value);
  }
  setState(updateBatch(state, actionBatchId, fields));
});

// --- boot ---
render();
