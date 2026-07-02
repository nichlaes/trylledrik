// Pure state transitions. State = { batches: [], settings: {} }.
// No storage, no DOM — unit-tested in Node. Never mutates input state.

export const DEFAULT_SETTINGS = {
  defaultF1Days: 10,
  defaultF2Days: 3,
  reminderTime: '18:00',
  batchCounter: 0,
};

export function startBatch(state, { id, name, f1Start, f1Days }) {
  const counter = state.settings.batchCounter + 1;
  const batch = {
    id,
    name: name || `Batch #${counter}`,
    stage: 'f1',
    f1Start,
    f1Days,
    f2Start: null,
    f2Days: state.settings.defaultF2Days,
    flavorings: '',
    rating: null,
    notes: '',
    finishedAt: null,
  };
  return {
    batches: [...state.batches, batch],
    settings: { ...state.settings, batchCounter: counter },
  };
}

function patchBatch(state, id, fields) {
  return {
    ...state,
    batches: state.batches.map((b) => (b.id === id ? { ...b, ...fields } : b)),
  };
}

export function bottleBatch(state, id, { flavorings, f2Start, f2Days }) {
  return patchBatch(state, id, { stage: 'f2', flavorings, f2Start, f2Days });
}

export function finishBatch(state, id, { rating, notes, finishedAt }) {
  return patchBatch(state, id, { stage: 'done', rating, notes, finishedAt });
}

export function updateBatch(state, id, fields) {
  return patchBatch(state, id, fields);
}

export function deleteBatch(state, id) {
  return { ...state, batches: state.batches.filter((b) => b.id !== id) };
}

const STAGES = ['f1', 'f2', 'done'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ID_FORMAT = /^[a-zA-Z0-9_-]{1,40}$/;
const REMINDER_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_DAYS = 3650;

function validSettings(s) {
  if (
    s.defaultF1Days !== undefined &&
    !(Number.isInteger(s.defaultF1Days) && s.defaultF1Days >= 1 && s.defaultF1Days <= MAX_DAYS)
  ) {
    return false;
  }
  if (
    s.defaultF2Days !== undefined &&
    !(Number.isInteger(s.defaultF2Days) && s.defaultF2Days >= 1 && s.defaultF2Days <= MAX_DAYS)
  ) {
    return false;
  }
  if (
    s.batchCounter !== undefined &&
    !(Number.isInteger(s.batchCounter) && s.batchCounter >= 0 && s.batchCounter <= 1000000)
  ) {
    return false;
  }
  if (s.reminderTime !== undefined && !(typeof s.reminderTime === 'string' && REMINDER_TIME.test(s.reminderTime))) {
    return false;
  }
  return true;
}

export function validateImport(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  if (!Array.isArray(data.batches)) return false;
  if (
    data.settings !== undefined &&
    (typeof data.settings !== 'object' || data.settings === null || Array.isArray(data.settings))
  ) {
    return false;
  }
  if (data.settings !== undefined && !validSettings(data.settings)) return false;
  return data.batches.every(
    (b) =>
      b &&
      typeof b === 'object' &&
      typeof b.id === 'string' &&
      ID_FORMAT.test(b.id) &&
      typeof b.name === 'string' &&
      STAGES.includes(b.stage) &&
      typeof b.f1Start === 'string' &&
      ISO_DATE.test(b.f1Start) &&
      Number.isInteger(b.f1Days) &&
      b.f1Days >= 1 &&
      b.f1Days <= MAX_DAYS &&
      (b.stage === 'f1' ||
        (typeof b.f2Start === 'string' &&
          ISO_DATE.test(b.f2Start) &&
          Number.isInteger(b.f2Days) &&
          b.f2Days >= 1 &&
          b.f2Days <= MAX_DAYS)) &&
      (b.rating === undefined ||
        b.rating === null ||
        (Number.isInteger(b.rating) && b.rating >= 1 && b.rating <= 5)) &&
      (b.flavorings === undefined || typeof b.flavorings === 'string') &&
      (b.notes === undefined || typeof b.notes === 'string') &&
      (b.finishedAt === undefined ||
        b.finishedAt === null ||
        (typeof b.finishedAt === 'string' && ISO_DATE.test(b.finishedAt)))
  );
}
