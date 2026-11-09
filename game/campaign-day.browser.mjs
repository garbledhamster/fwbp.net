import assert from 'node:assert/strict';
import { practicePage, withBrowser } from './browser-qa.mjs';

const profileCommand = (page, command) => page.evaluate(async input => {
  const { applyProfile, loadProfile } = await import('./game/profile.mjs');
  return input ? applyProfile(input) : loadProfile();
}, command);

await withBrowser(async browser => {
  const context = await browser.newContext();
  const { page, press, tray, launch, tick, errors } = await practicePage(context);
  const oldSave = {
    version: 1, revision: 1, coins: 25, owned: ['starter-license', 'starter-line', 'starter-hook'],
    equipped: { line: 'starter-line', hook: 'starter-hook' }, awards: {}, elapsedMs: 0,
  };
  await profileCommand(page);
  await page.evaluate(save => new Promise((resolve, reject) => {
    const request = indexedDB.open('fwbp-campaign', 1);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('profile', 'readwrite');
      tx.objectStore('profile').put(save, 'campaign');
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
    request.onerror = () => reject(request.error);
  }), oldSave);
  const other = await context.newPage();
  await other.goto(page.url(), { waitUntil: 'domcontentloaded' });
  const days = await Promise.all([page, other].map(tab => profileCommand(tab, { type: 'begin-day' })));
  assert.deepEqual(days.map(day => day.status).sort(), ['day-current', 'day-started']);
  const first = days[0].profile.day;
  assert.equal(first.id, days[1].profile.day.id);
  assert.equal(first.allowance, 2);
  assert.deepEqual(first.opened, []);
  assert.deepEqual(first.rosters, {});
  const open = (cellId, dayId = first.id) => ({ type: 'open-hole', dayId, cellId });
  assert.equal((await profileCommand(other, open('B1'))).status, 'permit-required');
  assert.equal((await profileCommand(other, open('Z0'))).status, 'invalid');
  const opens = await Promise.all([page, other].map(tab => profileCommand(tab, open('A3'))));
  assert.deepEqual(opens.map(result => result.status).sort(), ['hole-current', 'hole-opened']);
  assert.deepEqual(opens[0].profile.day, opens[1].profile.day, 'both tabs receive the same roster');
  const firstRoster = opens[0].profile.day.rosters.A3;
  assert.equal(firstRoster.length, 3);
  const secondHole = await profileCommand(other, open('E4'));
  assert.equal(secondHole.status, 'hole-opened');
  const savedDay = secondHole.profile.day;
  assert.deepEqual(savedDay.opened, ['A3', 'E4']);
  assert.deepEqual(savedDay.rosters.A3, firstRoster);
  assert.equal(savedDay.rosters.E4.length, 3);
  await other.close();

  async function campaignMap() {
    await press(launch, 'Enter');
    await press(page.getByRole('button', { name: 'Campaign', exact: true }), 'Enter');
    await page.locator('.fishing-map[open]').waitFor();
  }

  await page.reload({ waitUntil: 'domcontentloaded' });
  await campaignMap();
  const marked = page.locator('[data-map-cell="A3"]');
  assert.equal(await marked.getAttribute('data-hole-open'), '');
  assert.equal(await marked.textContent(), 'A3');
  assert.match(await marked.getAttribute('aria-label'), /hole open/i);
  assert.match(await page.locator('[data-map-allowance]').textContent(), /0 of 2 new holes/);
  assert.deepEqual((await profileCommand(page)).day, savedDay);
  await page.keyboard.press('ArrowRight');
  const locked = page.locator('[data-map-cell][aria-pressed="true"]');
  assert.match(await locked.getAttribute('aria-label'), /permit required/);
  assert.match(await page.locator('[data-map-permit]').textContent(), /Deep Reef permit/);
  const permit = await profileCommand(page, { type: 'buy', id: 'deep-reef-license', revision: secondHole.profile.revision });
  assert.equal(permit.status, 'bought');
  const atLimit = await profileCommand(page, open('B1'));
  assert.equal(atLimit.status, 'daily-limit');
  assert.deepEqual(atLimit.profile.day, savedDay);
  await press(marked, 'Enter');
  await press(page.locator('[data-map-drill]'), 'Enter');
  await tray.locator('[data-exit]:enabled').waitFor();
  assert.equal(await page.locator('.fishing-drill').isVisible(), false);
  await tick(31000);
  assert.equal(await tray.locator('[data-phase]').getAttribute('data-phase'), 'dusk');
  assert.deepEqual((await profileCommand(page)).day, savedDay, 'a change of light preserves the fishing day and rosters');

  await press(tray.locator('[data-exit]'), 'Enter');
  await press(page.locator('.fishing-pause [data-action="leave"]'), 'Enter');
  await tray.waitFor({ state: 'hidden' });
  assert.equal((await profileCommand(page)).day, undefined);
  await campaignMap();
  const next = (await profileCommand(page)).day;
  assert.notEqual(next.id, first.id);
  assert.equal(next.allowance, 2);
  assert.deepEqual(next.opened, []);
  assert.deepEqual(next.rosters, {});
  assert.equal(await page.locator('[data-hole-open]').count(), 0);
  assert.match(await page.locator('[data-map-allowance]').textContent(), /2 of 2 new holes/);
  assert.equal((await profileCommand(page, open('A3'))).status, 'stale-day');
  assert.equal((await profileCommand(page, { type: 'end-day', dayId: first.id })).status, 'stale-day');
  assert.deepEqual((await profileCommand(page)).day, next);
  await press(page.locator('[data-map-end]'), 'Enter');
  await page.getByRole('dialog', { name: 'Choose an outing' }).waitFor();
  assert.equal((await profileCommand(page)).day, undefined);

  await press(page.getByRole('button', { name: 'Campaign', exact: true }), 'Enter');
  await press(page.locator('[data-map-drill]'), 'Enter');
  await press(page.locator('[data-drill-skip]'), 'Enter');
  await tray.locator('[data-exit]:enabled').waitFor();
  await page.clock.fastForward(20 * 60 * 1000);
  assert.match(await tray.locator('.fishing-action').textContent(), /Fish again/);
  await page.waitForFunction(async () => {
    const { loadProfile } = await import('./game/profile.mjs');
    return !(await loadProfile()).day;
  }, undefined, { polling: 25 });
  assert.deepEqual(errors, []);
  await page.close();
});
console.log('Campaign day persists across tabs and reload, and ends on leave, map end, and expiry.');
