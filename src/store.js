import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const LOG = path.join(DATA, 'sessions.jsonl');

export function append(record) {
  fs.mkdirSync(DATA, { recursive: true });
  fs.appendFileSync(LOG, JSON.stringify(record) + '\n');
  writeCsvs();
}

// All records, keeping only the latest reading per date+time.
export function load() {
  if (!fs.existsSync(LOG)) return [];
  const byKey = new Map();
  for (const line of fs.readFileSync(LOG, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const r = JSON.parse(line);
    const prev = byKey.get(`${r.date} ${r.time}`);
    // a successful reading always beats a failed one
    if (!prev || r.status === 'ok' || prev.status !== 'ok') byKey.set(`${r.date} ${r.time}`, r);
  }
  return [...byKey.values()].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

export function daily(records = load()) {
  const days = new Map();
  for (const r of records) {
    const d = days.get(r.date) ?? { date: r.date, sessions_recorded: 0, filled: 0, revenue: 0, capacity: 0 };
    if (r.status === 'ok') { d.sessions_recorded++; d.filled += r.filled; d.revenue += r.revenue; d.capacity += 12; }
    days.set(r.date, d);
  }
  return [...days.values()].map(d => ({
    ...d,
    occupancy_pct: d.capacity ? Math.round((d.filled / d.capacity) * 1000) / 10 : 0,
  }));
}

const csv = (rows, cols) => [cols.join(','), ...rows.map(r => cols.map(c => {
  const v = r[c] ?? ''; return /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v;
}).join(','))].join('\n') + '\n';

function writeCsvs() {
  const recs = load();
  fs.writeFileSync(path.join(DATA, 'sessions.csv'), csv(recs,
    ['date', 'time', 'status', 'label', 'spots_left', 'filled', 'revenue', 'occupancy_pct', 'note', 'checked_at']));
  fs.writeFileSync(path.join(DATA, 'daily.csv'), csv(daily(recs),
    ['date', 'sessions_recorded', 'filled', 'revenue', 'occupancy_pct']));
}
