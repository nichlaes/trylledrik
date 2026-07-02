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

export function validateImport(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  if (!Array.isArray(data.batches)) return false;
  if (
    data.settings !== undefined &&
    (typeof data.settings !== 'object' || data.settings === null || Array.isArray(data.settings))
  ) {
    return false;
  }
  return data.batches.every(
    (b) =>
      b &&
      typeof b === 'object' &&
      typeof b.id === 'string' &&
      typeof b.name === 'string' &&
      STAGES.includes(b.stage) &&
      typeof b.f1Start === 'string' &&
      ISO_DATE.test(b.f1Start) &&
      Number.isInteger(b.f1Days) &&
      b.f1Days >= 1
  );
}
