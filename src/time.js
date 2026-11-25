import { TIMEZONE } from './config.js';

// Current wall-clock date/time in Toronto, regardless of the machine's timezone.
export function torontoNow(d = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(d).map(p => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: +parts.hour * 60 + +parts.minute,
    seconds: +parts.second,
    iso: `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`,
  };
}

export const toMinutes = hhmm => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

// "06:00" -> "6:00 a.m."  (matches the label the booking page renders)
export function pageLabel(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'a.m.' : 'p.m.'}`;
}
