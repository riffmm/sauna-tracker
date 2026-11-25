import { CAPACITY, PRICE } from './config.js';

// Returns spots_left as a number, or null if the label can't be understood.
export function parseSpotsLeft(label) {
  const s = (label || '').trim().toLowerCase();
  if (s === 'full') return 0;
  const m = s.match(/(\d+)\s*spots?\s*left/);
  return m ? Number(m[1]) : null;
}

export function computeMetrics(spotsLeft) {
  const filled = Math.min(CAPACITY, Math.max(0, CAPACITY - spotsLeft));
  return {
    spots_left: spotsLeft,
    filled,
    revenue: filled * PRICE,
    occupancy_pct: Math.round((filled / CAPACITY) * 1000) / 10,
  };
}
