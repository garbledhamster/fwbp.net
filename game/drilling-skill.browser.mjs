import assert from 'node:assert/strict';
import { practicePage, withBrowser } from './browser-qa.mjs';

const profileCommand = (page, command) => page.evaluate(async input => {
  const { applyProfile, loadProfile } = await import('./game/profile.mjs');
  return input ? applyProfile(input) : loadProfile();
}, command);

await withBrowser(async browser => {
  const context = await browser.newContext();
  const qa = await practicePage(context);
  const { page, press, tray } = qa;
  const picker = page.getByRole('dialog', { name: 'Choose an outing' });
  const skills = page.getByRole('dialog', { name: 'Angler Skills' });
  const line = skills.locator('article').filter({ has: page.getByRole('heading', { name: 'Line control', exact: true }) });
  const map = page.locator('.fishing-map');
  const allowance = map.locator('[data-map-allowance]');
  const marks = map.locator('[data-hole-open]');
  const cell = id => map.locator(`[data-map-cell="${id}"]`);
  const open = map.locator('[data-map-drill]');
  const drill = page.locator('.fishing-drill');

  async function showSkills() {
    await press(picker.getByRole('button', { name: 'Angler Skills', exact: true }), 'Enter');
    await line.waitFor();
  }

  async function showMap() {
    await press(picker.getByRole('button', { name: 'Campaign', exact: true }), 'Enter');
    await map.waitFor();
  }

  async function returnToMap() {
    await press(tray.locator('[data-open-map]'), 'Enter');
    await map.waitFor();
  }

  async function fish(id, newHole) {
    await press(cell(id), 'Enter');
    await press(open, 'Enter');
    if (newHole) {
      await press(drill.locator('[data-drill-skip]'), 'Enter');
      await drill.waitFor({ state: 'hidden' });
    } else await map.waitFor({ state: 'hidden' });
    await tray.locator('[data-exit]:enabled').waitFor();
    assert.equal(await drill.isVisible(), false);
    assert.match(await tray.locator('[data-water]').textContent(), new RegExp(id));
  }

  await qa.openGame();
  await showSkills();
  assert.equal(await line.getByRole('button', { name: 'Add one rank to Line control' }).isDisabled(), true);
  await qa.closeDialog(skills, skills.locator('[data-skills-close]'));
  const { profile: funded } = await profileCommand(page, { type: 'award', key: 'earlier-outing:0', outcome: 'landed', catch: { points: 35 } });
  await profileCommand(page, { type: 'buy', id: 'starter-license', revision: funded.revision });

  await showMap();
  const first = (await profileCommand(page)).day;
  assert.equal(first.allowance, 2);
  await press(map.locator('[data-map-back]'), 'Enter');
  await showSkills();
  assert.match(await skills.locator('[data-skill-bank]').textContent(), /1 practice point available/);
  assert.equal(await skills.getByRole('heading', { name: 'Drilling', exact: true }).count(), 0);
  await press(line.getByRole('button', { name: 'Add one rank to Line control' }), 'Enter');
  await line.getByText('Rank 1 / 5').waitFor();
  assert.match(await skills.textContent(), /0 practice points available/);
  assert.deepEqual((await profileCommand(page)).day, first);

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await qa.openGame();
  await showSkills();
  await line.getByText('Rank 1 / 5').waitFor();
  assert.match(await skills.textContent(), /0 practice points available/);
  await qa.closeDialog(skills, skills.locator('[data-skills-close]'));
  await showMap();
  assert.match(await allowance.textContent(), /2 of 2 new holes/);
  await press(map.locator('[data-map-back]'), 'Enter');
  // Give the open day the allowance and turn reduction already earned in a legacy save.
  await page.evaluate(async () => {
    await new Promise((resolve, reject) => {
      const request = indexedDB.open('fwbp-campaign', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('profile', 'readwrite');
        const store = tx.objectStore('profile');
        const saved = store.get('campaign');
        saved.onsuccess = () => {
          const profile = saved.result;
          store.put({ ...profile, skillRanks: { drilling: 20 },
            day: { ...profile.day, allowance: 3, drillReduction: 1 } }, 'campaign');
        };
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onabort = () => reject(tx.error);
      };
    });
  });
  await showMap();
  assert.match(await allowance.textContent(), /3 of 3 new holes/);
  assert.equal((await profileCommand(page)).day.drillReduction, 1);

  await fish('A3', true);
  await returnToMap();
  assert.match(await allowance.textContent(), /2 of 3 new holes/);
  await fish('E4', true);
  await returnToMap();
  assert.deepEqual(await marks.evaluateAll(cells => cells.map(cell => cell.dataset.mapCell)), ['A3', 'E4']);
  assert.match(await allowance.textContent(), /1 of 3 new holes/);

  const trained = (await profileCommand(page)).day;
  const other = await context.newPage();
  await other.goto(page.url(), { waitUntil: 'domcontentloaded' });
  const thirdHole = await profileCommand(other, { type: 'open-hole', dayId: trained.id, cellId: 'B1' });
  assert.equal(thirdHole.status, 'hole-opened');
  assert.equal(thirdHole.profile.day.rosters.B1.length, 3);
  await other.close();

  await press(cell('C1'), 'Enter');
  assert.match(await map.locator('[data-map-permit]').textContent(), /Owned/);
  await press(open, 'Enter');
  await press(drill.locator('[data-drill-skip]'), 'Enter');
  await map.waitFor();
  assert.deepEqual(await marks.evaluateAll(cells => cells.map(cell => cell.dataset.mapCell)), ['B1', 'A3', 'E4']);
  assert.match(await allowance.textContent(), /0 of 3 new holes/);
  assert.equal(await open.isDisabled(), true);
  assert.match(await map.locator('[data-map-message]').textContent(), /end the day/);
  await fish('A3', false);
  await returnToMap();
  await fish('E4', false);
  await returnToMap();
  await fish('B1', false);
  const upgraded = (await profileCommand(page)).day;
  assert.deepEqual(upgraded, thirdHole.profile.day, 'the stale fourth drill and reopening saved holes preserve the trained day');

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await qa.openGame();
  await showSkills();
  await press(skills.getByRole('button', { name: 'Reset points for free' }), 'Enter');
  await line.getByText('Rank 0 / 5').waitFor();
  assert.match(await skills.textContent(), /1 practice point available/);
  assert.deepEqual((await profileCommand(page)).day, upgraded);
  await qa.closeDialog(skills, skills.locator('[data-skills-close]'));
  await showMap();
  assert.equal(await marks.count(), 3);
  assert.match(await allowance.textContent(), /0 of 3 new holes/);
  await press(map.locator('[data-map-end]'), 'Enter');
  await showMap();
  assert.equal(await marks.count(), 0);
  assert.match(await allowance.textContent(), /2 of 2 new holes/);
  assert.equal((await profileCommand(page)).day.drillReduction, 0);
  assert.deepEqual(qa.errors, []);
});

console.log('PASS: Angler ranks leave the drill budget alone, preserve a legacy open day, and use the standard next-day budget');
