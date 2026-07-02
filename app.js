import { DEFAULT_SETTINGS } from './store.js';

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

function render() {
  $('#batch-list').innerHTML = '<p class="empty">No brews going. Start one! \u{1FAD9}</p>';
  $('#history-list').innerHTML = '<p class="empty">Nothing finished yet.</p>';
  const f = $('#settings-form');
  f.defaultF1Days.value = state.settings.defaultF1Days;
  f.defaultF2Days.value = state.settings.defaultF2Days;
  f.reminderTime.value = state.settings.reminderTime;
}

// --- boot ---
render();
