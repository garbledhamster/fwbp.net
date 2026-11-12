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
  await press(qa.launch, 'Enter');
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
  const target = page.getByRole('button', { name: 'Set hook', exact: true });
  const first = await target.boundingBox();
  await tick(300);
  const moving = await target.boundingBox();
  assert.ok(Math.abs(first.x - moving.x) > 20, 'the jig moves during the wait for gold');
  await tick(420);
  const gold = await target.boundingBox();
  assert.equal(gold.width, 44);
  await page.mouse.click(gold.x + gold.width / 2 - 25, gold.y + gold.height / 2);
  assert.match(await qa.status.textContent(), /missed the jig/i);
  assert.equal(await target.isVisible(), true, 'a missed target leaves the bite active');
  await page.mouse.move(gold.x + gold.width / 2, gold.y + gold.height / 2);
  await page.mouse.down();
  await page.mouse.move(gold.x + gold.width + 20, gold.y + gold.height / 2, { steps: 4 });
  await page.mouse.up();
  assert.equal(await target.isVisible(), true, 'dragging the jig does not set the hook');
  await page.mouse.move(gold.x + gold.width / 2, gold.y + gold.height / 2);
  await page.mouse.down();
  await tick(120);
  assert.ok(Math.abs((await target.boundingBox()).x - gold.x) > 22, 'the jig can leave the pointer before release');
  await page.mouse.up();
  await reelToHole({ keyboard: true });
  await page.keyboard.press('r');
  const catchDialog = page.locator('.fishing-catch-popup[open]');
  await catchDialog.waitFor();
  const landed = await savedProfile(page);
  const records = Object.values(landed.catchLocations);
  assert.equal(records.length, 1);
  assert.equal(records[0].cellId, 'A2');
  assert.equal(landed.day.rosters.A2.length, before.day.rosters.A2.length - 1);

  await press(catchDialog.getByRole('button', { name: 'Skills', exact: true }));
  const skills = page.getByRole('dialog', { name: 'Campaign Skills' });
  const add = skills.getByRole('button', { name: 'Add one rank to Lure Work' });
  await add.waitFor();
  const bank = skills.locator('[data-skill-bank]');
  const available = Number((await bank.textContent()).match(/(\d+) available/)[1]);
  assert.equal(available, 6, 'a Level 7 player can spend all six unspent points');
  await press(add);
  await skills.getByText('Rank added.', { exact: true }).waitFor();
  assert.match(await bank.textContent(), new RegExp(`${available - 1} available`));
  await closeDialog(skills, skills.getByRole('button', { name: 'Back', exact: true }));
  assert.equal(await catchDialog.isVisible(), true, 'skills return to the saved catch');
  await closeDialog(catchDialog, catchDialog.getByRole('button', { name: 'Back to catch' }));
  await page.reload({ waitUntil: 'domcontentloaded' });

  const reloaded = await savedProfile(page);
  assert.deepEqual(reloaded.catchLocations, landed.catchLocations);
  assert.deepEqual(reloaded.day, landed.day);
  assert.equal(reloaded.skillRanks.lure, 1);
  await press(qa.launch, 'Enter');
  await press(picker.getByRole('button', { name: 'Skills', exact: true }));
  await skills.getByText('Rank 1 / 100', { exact: true }).waitFor();
  assert.match(await bank.textContent(), new RegExp(`${available - 1} available`));
  await closeDialog(skills, skills.getByRole('button', { name: 'Back', exact: true }));
  await press(picker.getByRole('button', { name: 'Campaign', exact: true }));
  const map = page.locator('.fishing-map');
  const reef = map.locator('[data-map-cell="A2"]');
  await press(reef);
  assert.equal(await reef.getAttribute('data-hole-open'), '');
  assert.equal(await map.locator('[data-map-history]').isVisible(), true);
  assert.deepEqual(qa.errors, []);
  console.log('PASS one map → deep reef-edge hole → moving Jig → saved catch → skill rank → reload');
});

await withBrowser(async browser => {
  for (const [hook, width, viewport] of [
    ['finesse-hook', 56, { width: 320, height: 720 }],
    ['pro-hook', 68, { width: 720, height: 320 }],
  ]) {
    const qa = await practicePage(browser, { mobile: true, viewport });
    const { page, tick, findFish, waitForBite } = qa;
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.evaluate(async hook => {
      Math.random = () => .30;
      const { applyProfile } = await import('./game/profile.mjs');
      const { profile: funded } = await applyProfile({ type: 'award', key: 'target-fixture:0', outcome: 'landed', catch: { points: 1200 } });
      const { profile: bought } = await applyProfile({ type: 'buy', id: hook, revision: funded.revision });
      const { status } = await applyProfile({ type: 'equip', id: hook, revision: bought.revision });
      if (status !== 'equipped') throw new Error(`Could not equip ${hook}: ${status}`);
    }, hook);
    await qa.enter('Campaign', 'A2');
    await findFish({ species: 'perch' });
    await page.keyboard.press('j');
    await waitForBite();
    await tick(720);
    const target = page.getByRole('button', { name: 'Set hook', exact: true });
    const box = await target.boundingBox();
    assert.equal(box.width, width);
    assert.ok(box.x >= 0 && box.x + width <= viewport.width);
    assert.ok(box.y >= 0 && box.y + box.height <= (await qa.tray.boundingBox()).y);
    // The same 25 px offset is outside the starter target in the full playthrough.
    await page.touchscreen.tap(box.x + box.width / 2 - 25, box.y + box.height / 2);
    assert.equal(await qa.action.textContent(), 'Reel');
    assert.equal(await target.isVisible(), false);
    assert.deepEqual(qa.errors, []);
    await page.close();
  }
  console.log('PASS Fine-wire and Pro Jig accept a tap outside the starter target on portrait and landscape');
});
