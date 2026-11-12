import assert from 'node:assert/strict';
import { practicePage, withBrowser } from './browser-qa.mjs';

const savedProfile = page => page.evaluate(async () => (await import('./game/profile.mjs')).loadProfile());

await withBrowser(async browser => {
  const qa = await practicePage(browser);
  const { page, press, tick, tray, findFish, waitForBite, reelToHole, closeDialog } = qa;
  await page.evaluate(async () => {
    Math.random = () => .30;
    const { applyProfile } = await import('./game/profile.mjs');
    await applyProfile({ type: 'award', key: 'rank-fixture:0', outcome: 'landed', catch: { points: 400 } });
  });
  await qa.openGame();
  const picker = page.getByRole('dialog', { name: 'Choose an outing' });
  assert.equal(await picker.getByRole('button', { name: 'Deep Reef', exact: true }).count(), 0);
  await qa.chooseMode('Campaign', 'A2');
  assert.match(await tray.locator('[data-water]').textContent(), /A2.*25 ft.*Reef edge/);
  const before = await savedProfile(page);
  assert.deepEqual(before.day.opened, ['A2']);
  const species = before.day.rosters.A2.find(entry => ['perch', 'rock-bass'].includes(entry.speciesId))?.speciesId;
  assert.ok(species, 'the seeded reef hole includes a fish that takes Jig');

  await findFish({ species });
  await page.keyboard.press('j');
  await waitForBite();
  const meter = page.getByRole('meter', { name: 'Reel feedback' });
  await tick(350);
  await page.mouse.click(38, 114);
  assert.equal(await meter.isVisible(), false, 'the early tap queues instead of hooking immediately');
  await tick(230);
  await meter.waitFor();
  await reelToHole({ keyboard: true });
  const catchDialog = page.locator('.fishing-catch-popup[open]');
  await catchDialog.waitFor();
  const landed = await savedProfile(page);
  const records = Object.values(landed.catchLocations);
  assert.equal(records.length, 1);
  assert.equal(records[0].cellId, 'A2');
  assert.equal(landed.day.rosters.A2.length, before.day.rosters.A2.length - 1);
  const [fish] = Object.values(landed.landedFish);
  assert.equal(fish.line.id, 'starter-line');
  assert.equal(fish.hook.id, 'starter-hook');
  assert.equal(fish.speciesId, records[0].speciesId);
  assert.ok(fish.quality > 0 && fish.age > 0);

  await press(catchDialog.getByRole('button', { name: 'Angler Skills', exact: true }));
  const skills = page.getByRole('dialog', { name: 'Angler Skills' });
  const add = skills.getByRole('button', { name: 'Add one rank to Hook timing' });
  await add.waitFor();
  const bank = skills.locator('[data-skill-bank]');
  const available = Number((await bank.textContent()).match(/(\d+) practice points? available/)[1]);
  assert.equal(available, 2, 'the previous catch and the new receipt earn one point each');
  await press(add);
  await skills.getByText('Rank added.', { exact: true }).waitFor();
  assert.match(await bank.textContent(), new RegExp(`${available - 1} practice point available`));
  await closeDialog(skills, skills.getByRole('button', { name: 'Back', exact: true }));
  assert.equal(await catchDialog.isVisible(), true, 'skills return to the saved catch');
  await closeDialog(catchDialog, catchDialog.locator('[data-reward-close]'));
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });

  const reloaded = await savedProfile(page);
  assert.deepEqual(reloaded.catchLocations, landed.catchLocations);
  assert.deepEqual(reloaded.day, landed.day);
  assert.equal(reloaded.angler.ranks.hook, 1);
  await qa.openGame();
  await press(picker.getByRole('button', { name: 'Angler Skills', exact: true }));
  await skills.getByText('Rank 1 / 3', { exact: true }).waitFor();
  assert.match(await bank.textContent(), new RegExp(`${available - 1} practice point available`));
  await closeDialog(skills, skills.getByRole('button', { name: 'Back', exact: true }));
  await press(picker.getByRole('button', { name: 'Campaign', exact: true }));
  const map = page.locator('.fishing-map');
  const reef = map.locator('[data-map-cell="A2"]');
  await press(reef);
  assert.equal(await reef.getAttribute('data-hole-open'), '');
  assert.equal(await map.locator('[data-map-history]').isVisible(), true);
  assert.deepEqual(qa.errors, []);
  console.log('PASS: deep reef catch, buffered hook, saved specimen and gear, one practice point, and rank persistence');
});
