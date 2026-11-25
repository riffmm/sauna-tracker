import { chromium } from 'playwright';
import { URL } from './config.js';
import { pageLabel } from './time.js';

// Opens the booking page, selects `date`, and reads the label for the `time` slot.
// Resolves to { found, label, note } — note is the site's own message for the slot
// (e.g. "Silent Session"), which explains some "Full" slots that weren't sold out.
export async function readSlot(date, time) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    let events = [];
    page.on('response', async r => {
      if (!r.url().includes('/bookingGroup')) return;
      try { events = (await r.json()).events || []; } catch { /* ignore */ }
    });

    await page.goto(URL, { waitUntil: 'networkidle', timeout: 60_000 });
    const day = page.locator(`button.pv-d[data-day="${date}"]`);
    await day.waitFor({ timeout: 30_000 });
    if (await day.isEnabled()) await day.click();
    await page.waitForFunction(
      d => document.querySelector(`button.pv-d[data-day="${d}"]`)?.getAttribute('aria-pressed') === 'true'
        && document.querySelector('.pv-cal-times'),
      date, { timeout: 30_000 },
    ).catch(() => {});
    await page.waitForTimeout(1500);

    const slots = await page.$$eval('.pv-slot', els => els.map(e => ({
      time: e.querySelector('b')?.textContent.trim(),
      label: e.querySelector('small')?.textContent.trim(),
    })));
    const slot = slots.find(s => s.time === pageLabel(time));
    const ev = events.find(e => e.date === date && e.time === time && e.name_en === 'Community Session');
    return { found: !!slot, label: slot?.label ?? null, note: ev?.message ?? '' };
  } finally {
    await browser.close();
  }
}
