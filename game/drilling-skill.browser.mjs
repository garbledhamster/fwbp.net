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
  const skills = page.getByRole('dialog', { name: 'Campaign Skills' });
  const drilling = skills.locator('article').filter({ has: page.getByRole('heading', { name: 'Drilling', exact: true }) });
  const map = page.locator('.fishing-map');
  const allowance = map.locator('[data-map-allowance]');
  const marks = map.locator('[data-hole-open]');
  const cell = id => map.locator(`[data-map-cell="${id}"]`);
  const open = map.locator('[data-map-drill]');
  const drill = page.locator('.fishing-drill');

  async function showSkills() {
    await press(picker.getByRole('button', { name: 'Skills', exact: true }), 'Enter');
    await drilling.waitFor();
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
  assert.equal(await drilling.getByRole('button', { name: 'Add one rank to Drilling' }).isDisabled(), true);
  await qa.closeDialog(skills, skills.locator('[data-skills-close]'));
  const { profile: funded } = await profileCommand(page, { type: 'award', key: 'earlier-outing:0', outcome: 'landed', catch: { points: 35 } });
  await profileCommand(page, { type: 'buy', id: 'starter-license', revision: funded.revision });

  await showMap();
  const first = (await profileCommand(page)).day;
  assert.equal(first.allowance, 2);
  await press(map.locator('[data-map-back]'), 'Enter');
  await showSkills();
  assert.match(await skills.textContent(), /Level 2 · 35 XP.*1 available/s);
  assert.match(await drilling.textContent(), /Next rank.*3 new holes/is);
  await press(drilling.getByRole('button', { name: 'Add one rank to Drilling' }), 'Enter');
  await drilling.getByText('Rank 1 / 100').waitFor();
  assert.match(await skills.textContent(), /0 available/);
  assert.deepEqual((await profileCommand(page)).day, first);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await qa.openGame();
  await showSkills();
  await drilling.getByText('Rank 1 / 100').waitFor();
  assert.match(await skills.textContent(), /0 available/);
  await qa.closeDialog(skills, skills.locator('[data-skills-close]'));
  await showMap();
  assert.match(await allowance.textContent(), /2 of 2 new holes/);
  await press(map.locator('[data-map-end]'), 'Enter');
  await showMap();
  assert.match(await allowance.textContent(), /3 of 3 new holes/);

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

  await page.reload({ waitUntil: 'domcontentloaded' });
  await qa.openGame();
  await showSkills();
  await press(skills.getByRole('button', { name: 'Reset points for free' }), 'Enter');
  await drilling.getByText('Rank 0 / 100').waitFor();
  assert.match(await skills.textContent(), /1 available/);
  assert.deepEqual((await profileCommand(page)).day, upgraded);
  await qa.closeDialog(skills, skills.locator('[data-skills-close]'));
  await showMap();
  assert.equal(await marks.count(), 3);
  assert.match(await allowance.textContent(), /0 of 3 new holes/);
  await press(map.locator('[data-map-end]'), 'Enter');
  await showMap();
  assert.equal(await marks.count(), 0);
  assert.match(await allowance.textContent(), /2 of 2 new holes/);
  assert.deepEqual(qa.errors, []);
});

console.log('Drilling unlock, persisted point spend, three saved holes, stale limit and next-day reset passed.');
