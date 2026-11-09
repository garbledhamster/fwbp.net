import assert from 'node:assert/strict';
import { practicePage, withBrowser } from './browser-qa.mjs';

const profileCommand = (page, command) => page.evaluate(async input => {
  const { applyProfile, loadProfile } = await import('./game/profile.mjs');
  return input ? applyProfile(input) : loadProfile();
}, command);

const landing = (key, speciesId, points, mode = 'campaign') => ({
  type: 'award', key, outcome: 'landed', speciesId, catch: { points }, mode,
});

async function verifySettlement(browser) {
  const context = await browser.newContext();
  try {
    const { page } = await practicePage(context);
    const other = await context.newPage();
    await other.goto(page.url(), { waitUntil: 'domcontentloaded' });
    await profileCommand(page);

    const wrong = await profileCommand(page, landing('shore:0', 'rock-bass', 15));
    assert.equal(wrong.earned, 7);
    assert.equal(wrong.profile.awards['shore:0'], 7);
    assert.equal(wrong.profile.coins, 7);
    assert.deepEqual(wrong.profile.caughtSpecies, ['rock-bass']);

    const practice = await profileCommand(page, landing('practice:0', 'perch', 10, 'practice'));
    assert.equal(practice.earned, 0);
    assert.equal(practice.profile.coins, 7);
    const missed = await profileCommand(page, { ...landing('shore:1', 'perch', 10), outcome: 'missed' });
    assert.equal(missed.status, 'no-award');
    assert.deepEqual(missed.profile, practice.profile);
    await page.evaluate(async () => {
      const { loadProfile } = await import('./game/profile.mjs');
      await loadProfile();
      const put = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (...args) {
        IDBObjectStore.prototype.put = put;
        const request = put.apply(this, args);
        request.addEventListener('success', () => this.transaction.abort(), { once: true });
        return request;
      };
    });
    const target = landing('shore:1', 'perch', 10);
    await assert.rejects(profileCommand(page, target), /AbortError|interrupted/);
    assert.deepEqual(await profileCommand(other), practice.profile, 'an aborted write changes none of the save');

    const results = await Promise.all([page, other].map(tab => profileCommand(tab, target)));
    assert.deepEqual(results.map(result => result.status).sort(), ['awarded', 'duplicate-award']);
    const saved = await profileCommand(other);
    assert.equal(saved.coins, 17);
    assert.deepEqual(saved.awards, { 'shore:0': 7, 'shore:1': 10 });
    assert.deepEqual(saved.caughtSpecies, ['rock-bass', 'perch']);
    assert.deepEqual(saved.goalCatches, ['shore:1']);

    await page.reload({ waitUntil: 'domcontentloaded' });
    assert.deepEqual(await profileCommand(page, target), { profile: saved, status: 'duplicate-award' });
    const later = await profileCommand(page, landing('shore:2', 'rock-bass', 15));
    assert.equal(later.earned, 15);
    assert.deepEqual(later.profile.goalCatches, ['shore:1']);
  } finally {
    await context.close();
  }
}

async function catchFish(qa, species, lure) {
  const { page, tray, press, findFish, waitForBite, tick, reelToHole, action } = qa;
  await press(tray.locator(`[data-lure="${lure}"]`));
  await findFish({ species });
  await page.keyboard.press('j');
  await waitForBite();
  assert.match(await qa.status.textContent(), /bite|gold/i);
  await tick(700);
  await page.keyboard.press('r');
  assert.equal(await action.textContent(), 'Reel', 'a hook set in gold starts the fight');
  await reelToHole({ keyboard: true });
  await page.keyboard.press('r');
  const reward = page.locator('.fishing-catch-popup[open]');
  await reward.waitFor();
  return reward;
}

async function openMap(qa) {
  const { page, launch, press } = qa;
  await press(launch, 'Enter');
  await press(page.getByRole('button', { name: 'Campaign', exact: true }), 'Enter');
  const map = page.locator('.fishing-map[open]');
  await map.waitFor();
  return map;
}

async function verifyOuting(browser) {
  const qa = await practicePage(browser);
  const { page, tray, press, closeDialog, leave, errors } = qa;
  const map = await openMap(qa);
  assert.match(await map.locator('[data-map-goal]').textContent(), /Bryan.*perch.*weed/i);
  const hole = map.getByRole('button', { name: /A3, Weed edge/ });
  await press(hole, 'Enter');
  await press(map.locator('[data-map-drill]'), 'Enter');
  const permit = page.locator('.fishing-permit[open]');
  await press(permit.getByRole('button', { name: 'Get this permit' }), 'Enter');
  const shop = page.getByRole('dialog', { name: 'Tackle shop' });
  const starter = shop.locator('[data-item="starter-license"]');
  await press(starter.getByRole('button', { name: /^(?:Buy|Claim) Starter Shore permit$/ }), 'Enter');
  await starter.getByText('Owned', { exact: true }).waitFor();
  await closeDialog(shop, shop.locator('[data-shop-back]'));
  await press(map.locator('[data-map-drill]'), 'Enter');
  await press(page.locator('[data-drill-skip]'), 'Enter');
  await tray.locator('[data-exit]:enabled').waitFor();
  assert.match(await tray.locator('[data-fishing-goal]').textContent(), /Goal.*perch/i);
  assert.equal(await tray.getByRole('status').count(), 1);

  const wrong = await catchFish(qa, 'pike', 'spoon');
  assert.equal(await wrong.locator('h2').textContent(), 'Northern pike');
  assert.match(await wrong.textContent(), /\+17 coins.*\+17 XP/);
  assert.match(await tray.locator('[data-run-progress]').textContent(), /35 pts/);
  assert.deepEqual((await profileCommand(page)).caughtSpecies, ['pike']);
  await closeDialog(wrong, wrong.locator('[data-reward-next]'));
  const goal = await catchFish(qa, 'perch', 'jig');
  assert.equal(await goal.locator('h2').textContent(), 'Yellow perch');
  assert.match(await goal.textContent(), /\+10 coins.*\+10 XP/);
  assert.match(await goal.textContent(), /goal complete/i);
  assert.match(await tray.locator('[data-run-progress]').textContent(), /45 pts/);

  const saved = await profileCommand(page);
  await page.reload({ waitUntil: 'domcontentloaded' });
  const resumed = await openMap(qa);
  assert.match(await resumed.locator('[data-map-goal]').textContent(), /Bryan.*goals complete/i);
  assert.equal(await resumed.locator('[data-map-cell="A3"]').getAttribute('data-hole-open'), '');
  await press(resumed.locator('[data-map-end]'), 'Enter');
  await press(page.getByRole('button', { name: 'Campaign', exact: true }), 'Enter');
  await resumed.waitFor();
  assert.match(await resumed.locator('[data-map-goal]').textContent(), /Bryan.*goals complete/i);
  assert.equal(await resumed.locator('[data-hole-open]').count(), 0);
  assert.notEqual((await profileCommand(page)).day.id, saved.day.id);
  assert.deepEqual(errors, []);
  await page.close();
}

await withBrowser(async browser => {
  for (const [name, verify] of [['settlement', verifySettlement], ['outing', verifyOuting]]) {
    try {
      await verify(browser);
      console.log(`PASS: Campaign goal ${name}`);
    } catch (error) {
      console.error(`FAIL: Campaign goal ${name}`, error);
      process.exitCode = 1;
    }
  }
});
