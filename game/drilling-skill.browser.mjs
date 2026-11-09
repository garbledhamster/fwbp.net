import assert from 'node:assert/strict';
import { practicePage, withBrowser } from './browser-qa.mjs';

const profileCommand = (page, command) => page.evaluate(async input => {
  const { applyProfile, loadProfile } = await import('./game/profile.mjs');
  return input ? applyProfile(input) : loadProfile();
}, command);

await withBrowser(async browser => {
  const qa = await practicePage(browser);
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

  await press(qa.launch, 'Enter');
  await showSkills();
  assert.equal(await drilling.getByRole('button', { name: 'Locked' }).isDisabled(), true);
  await qa.closeDialog(skills, skills.locator('[data-skills-close]'));
  const { profile: funded } = await profileCommand(page, { type: 'award', key: 'earlier-outing:0', outcome: 'landed', catch: { points: 35 } });
  const { profile: licensed } = await profileCommand(page, { type: 'buy', id: 'starter-license', revision: funded.revision });
  await profileCommand(page, { type: 'buy', id: 'deep-reef-license', revision: licensed.revision });

  await showMap();
  const first = (await profileCommand(page)).day;
  assert.equal(first.allowance, 1);
  await press(map.locator('[data-map-back]'), 'Enter');
  await showSkills();
  assert.match(await skills.textContent(), /Level 2 · 35 XP.*1 skill point saved/);
  assert.match(await drilling.textContent(), /2 new holes.*next day.*1 point/is);
  await press(drilling.getByRole('button', { name: 'Learn', exact: true }), 'Enter');
  await drilling.getByRole('button', { name: 'Learned' }).waitFor();
  assert.match(await skills.textContent(), /0 skill points saved/);
  assert.deepEqual((await profileCommand(page)).day, first);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await press(qa.launch, 'Enter');
  await showSkills();
  await drilling.getByRole('button', { name: 'Learned' }).waitFor();
  assert.match(await skills.textContent(), /0 skill points saved/);
  await qa.closeDialog(skills, skills.locator('[data-skills-close]'));
  await showMap();
  assert.match(await allowance.textContent(), /1 of 1 new holes/);
  await press(map.locator('[data-map-end]'), 'Enter');
  await showMap();
  assert.match(await allowance.textContent(), /2 of 2 new holes/);

  await fish('A3', true);
  await returnToMap();
  assert.match(await allowance.textContent(), /1 of 2 new holes/);
  await fish('E4', true);
  await returnToMap();
  assert.deepEqual(await marks.evaluateAll(cells => cells.map(cell => cell.dataset.mapCell)), ['A3', 'E4']);
  assert.match(await allowance.textContent(), /0 of 2 new holes/);
  await press(cell('B1'), 'Enter');
  assert.match(await map.locator('[data-map-permit]').textContent(), /Owned/);
  assert.equal(await open.isDisabled(), true);
  assert.match(await map.locator('[data-map-message]').textContent(), /end the day/);
  await fish('A3', false);
  await returnToMap();
  await fish('E4', false);
  const upgraded = (await profileCommand(page)).day;
  assert.deepEqual(upgraded.opened, ['A3', 'E4']);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await press(qa.launch, 'Enter');
  await showSkills();
  await press(skills.getByRole('button', { name: 'Reset points for free' }), 'Enter');
  await drilling.getByRole('button', { name: 'Learn', exact: true }).waitFor();
  assert.match(await skills.textContent(), /1 skill point saved/);
  assert.deepEqual((await profileCommand(page)).day, upgraded);
  await qa.closeDialog(skills, skills.locator('[data-skills-close]'));
  await showMap();
  assert.equal(await marks.count(), 2);
  assert.match(await allowance.textContent(), /0 of 2 new holes/);
  await press(map.locator('[data-map-end]'), 'Enter');
  await showMap();
  assert.equal(await marks.count(), 0);
  assert.match(await allowance.textContent(), /1 of 1 new holes/);
  assert.deepEqual(qa.errors, []);
});

console.log('Drilling unlock, persisted point spend, two saved holes and next-day reset passed.');
