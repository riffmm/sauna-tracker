# Sauna Tracker

Five minutes before each of Saunoa Toronto's 11 daily community sessions, this tool opens
https://saunoa.ca/book/toronto/community in headless Chromium and reads the slot label
("N spots left" or "Full"). It then works out filled spots, revenue and occupancy for that session.

Rules: 12 spots per session at $45 each. `filled = 12 - spots_left` (kept between 0 and 12),
`revenue = filled × 45`, `occupancy_pct = filled / 12 × 100` (rounded to 1 decimal).

## Setup
```
npm install
npx playwright install chromium
```

## Where it runs
It runs on **GitHub Actions** (`.github/workflows/track.yml`), so no PC needs to be on. Each run
starts about 35 min before a session, waits until 5 min before it, reads the page, and saves the
result into `data/` in this repository. To check a session by hand, open
Actions → "Track sauna sessions" → "Run workflow".
To see results, open `data/sessions.csv` or `data/daily.csv` on GitHub, or run `git pull` then `npm run report`.

## Run it locally instead (pick one)
- **Keep a terminal open:** `npm start`. It runs all day and checks each session 5 min before it starts.
- **Windows Task Scheduler** (keeps working after a restart, no window needed):
  `powershell -ExecutionPolicy Bypass -File .\setup-schedule.ps1`. The PC still has to be on
  (or asleep, since the tasks can wake it). Output goes to `data\run.log`.

## Results
- `npm run report`: every day's sessions and the day's total revenue.
- `npm run report -- 2026-11-25`: one day only.
- `data/sessions.csv`: one row per session (spots_left, filled, revenue, occupancy_pct, note).
- `data/daily.csv`: one row per day (filled, revenue, occupancy_pct).
- `data/sessions.jsonl`: raw log of every check. The CSVs are rebuilt from it.

Manual check: `npm run check -- 19:30` (today) or `npm run check -- 19:30 2026-11-25`.

## Notes
- The **note** column holds the site's own message for a slot (e.g. "Silent Session", a session
  type that people book normally). It does not explain why a slot is full.
- "Full" is ambiguous. Community and private sessions share the sauna, so a slot shows "Full" both
  when 12 people booked it and when a private group took the whole sauna. The public page can't
  tell these apart, so "Full" always counts as 12 filled ($540), which may overstate private bookings.
- Status other than `ok`: `not_listed` (the slot wasn't on the page), `unparsed` (the label wasn't
  understood), or `error` (the page failed to load after 3 tries, 45 s apart).
- Times use Toronto time.
