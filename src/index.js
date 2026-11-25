#!/usr/bin/env node
import { SESSIONS, LEAD_MINUTES } from './config.js';
import { torontoNow, toMinutes } from './time.js';
import { parseSpotsLeft, computeMetrics } from './metrics.js';
import { readSlot } from './scrape.js';
import { append, load, daily } from './store.js';

const log = (...a) => console.log(`[${torontoNow().iso}]`, ...a);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function check(time, date = torontoNow().date) {
  const base = { date, time };
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { found, label, note } = await readSlot(date, time);
      let rec;
      if (!found) rec = { ...base, status: 'not_listed', label: null, note };
      else {
        const left = parseSpotsLeft(label);
        rec = left === null
          ? { ...base, status: 'unparsed', label, note }
          : { ...base, status: 'ok', label, ...computeMetrics(left), note };
      }
      rec.checked_at = torontoNow().iso;
      append(rec);
      log(`${date} ${time} ->`, rec.status === 'ok'
        ? `${rec.filled}/12 filled, $${rec.revenue}, ${rec.occupancy_pct}%${note ? ` (${note})` : ''}`
        : `${rec.status} (label: ${label ?? 'none'})`);
      return rec;
    } catch (err) {
      log(`${date} ${time} attempt ${attempt} failed: ${err.message.split('\n')[0]}`);
      if (attempt < 3) await sleep(45_000);
    }
  }
  const rec = { ...base, status: 'error', checked_at: torontoNow().iso };
  append(rec);
  return rec;
}

// Long-running scheduler: fires each session's check LEAD_MINUTES before it starts.
async function watch() {
  log(`Watching ${SESSIONS.length} sessions, checking ${LEAD_MINUTES} min before each. Ctrl+C to stop.`);
  const done = new Set();
  for (;;) {
    const now = torontoNow();
    for (const t of SESSIONS) {
      const key = `${now.date} ${t}`;
      const due = toMinutes(t) - LEAD_MINUTES;
      // fire anywhere in [start-5min, start) so a brief hiccup doesn't skip the session
      if (!done.has(key) && now.minutes >= due && now.minutes < toMinutes(t)) {
        done.add(key);
        await check(t, now.date);
      }
    }
    await sleep(20_000);
  }
}

// One-shot mode for scheduled runners (GitHub Actions). Started ~35 min before a session:
// picks the earliest unrecorded session starting between 15 min ago and 60 min from now,
// waits until 5 min before it, then checks. Runs that start late still read the slot if
// it's within 15 min after start (the page keeps listing it briefly), flagged late.
async function next() {
  const now = torontoNow();
  const recorded = new Set(load().filter(r => r.status === 'ok').map(r => `${r.date} ${r.time}`));
  const t = SESSIONS.find(s => {
    const diff = toMinutes(s) - now.minutes;
    return diff >= -15 && diff <= 60 && !recorded.has(`${now.date} ${s}`);
  });
  if (!t) return log('No unrecorded session in the next hour; nothing to do.');
  const waitMs = ((toMinutes(t) - LEAD_MINUTES - now.minutes) * 60 - now.seconds) * 1000;
  if (waitMs > 0) {
    log(`Next session ${t}; waiting ${Math.round(waitMs / 60000)} min until 5 min before it.`);
    await sleep(waitMs);
  }
  const rec = await check(t, now.date);
  if (torontoNow().minutes >= toMinutes(t)) log(`Note: ${t} was read after it started (runner started late).`);
  return rec;
}

function report(filterDate) {
  const recs = load().filter(r => !filterDate || r.date === filterDate);
  if (!recs.length) return console.log('No data yet.');
  const days = daily(recs);
  for (const d of days) {
    console.log(`\n${d.date}  -  revenue $${d.revenue}  |  ${d.filled} filled  |  ${d.occupancy_pct}% occupancy  |  ${d.sessions_recorded}/11 sessions recorded`);
    console.table(recs.filter(r => r.date === d.date).map(r => ({
      time: r.time, status: r.status, spots_left: r.spots_left ?? '', filled: r.filled ?? '',
      revenue: r.revenue != null ? `$${r.revenue}` : '',
      occupancy: r.occupancy_pct != null ? `${r.occupancy_pct}%` : '',
      note: r.note || '',
    })));
  }
  if (days.length > 1) console.log(`\nTotal across ${days.length} days: $${days.reduce((s, d) => s + d.revenue, 0)}`);
}

const [cmd, arg, maybeDate] = process.argv.slice(2);
if (cmd === 'watch') await watch();
else if (cmd === 'next') await next();
else if (cmd === 'check' && /^\d\d:\d\d$/.test(arg ?? '')) await check(arg, maybeDate);
else if (cmd === 'report') report(arg);
else console.log(`Usage:
  node src/index.js watch                    run all day, check 5 min before each session
  node src/index.js next                     wait for the next session (within 1h) and check it
  node src/index.js check HH:MM [YYYY-MM-DD] check one session now (e.g. check 21:00)
  node src/index.js report [YYYY-MM-DD]      per-session and per-day revenue`);
