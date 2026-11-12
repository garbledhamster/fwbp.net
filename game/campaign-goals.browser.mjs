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
    assert.equal(later.earned, 7, 'the pike goal is active after perch');
    assert.deepEqual(later.profile.goalCatches, ['shore:1']);
    const tiny = await profileCommand(page, landing('shore:3', 'rock-bass', 1));
    assert.equal(tiny.earned, 1, 'off-goal rewards have a minimum of one');

    const pikeResults = await Promise.all([page, other].map((tab, index) =>
      profileCommand(tab, landing(`pike:${index}`, 'pike', 35))));
    assert.deepEqual(pikeResults.map(result => result.earned).sort((a, b) => a - b), [17, 35]);
    const afterPike = await profileCommand(page);
    assert.equal(afterPike.goalCatches.length, 2, 'two different pike catches complete just the pike goal');
    assert.match(afterPike.goalCatches[1], /^pike:[01]$/);
    const offReef = await profileCommand(other, landing('reef:1', 'rock-bass', 15));
    assert.equal(offReef.earned, 7);
    const walleye = await profileCommand(page, landing('reef:2', 'walleye', 25));
    assert.equal(walleye.earned, 25);
    assert.deepEqual(walleye.profile.goalCatches, [...afterPike.goalCatches, 'reef:2']);
    const done = await profileCommand(other, landing('reef:3', 'rock-bass', 15));
    assert.equal(done.earned, 15);
    assert.deepEqual(done.profile.goalCatches, walleye.profile.goalCatches);
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

async function buyPermit(qa, id, area) {
  const { page, press, closeDialog } = qa;
  const permit = page.getByRole('dialog', { name: `${area} permit` });
  await permit.waitFor();
  await press(permit.getByRole('button', { name: 'Get this permit' }), 'Enter');
  const shop = page.getByRole('dialog', { name: 'Tackle shop' });
  const item = shop.locator(`[data-item="${id}"]`);
  await press(item.getByRole('button', { name: new RegExp(`^(?:Buy|Claim) ${area} permit$`) }), 'Enter');
  await item.getByText('Owned', { exact: true }).waitFor();
  await closeDialog(shop, shop.locator('[data-shop-back]'));
}

async function drillSelected(qa, map) {
  const { page, press, tray } = qa;
  await press(map.locator('[data-map-drill]'), 'Enter');
  await press(page.locator('[data-drill-skip]'), 'Enter');
  await tray.locator('[data-exit]:enabled').waitFor();
}

async function nextDay(qa) {
  const { page, press } = qa;
  const map = page.locator('.fishing-map[open]');
  await press(map.locator('[data-map-end]'), 'Enter');
  await press(page.getByRole('button', { name: 'Campaign', exact: true }), 'Enter');
  await map.waitFor();
  assert.equal(await map.locator('[data-hole-open]').count(), 0);
  return map;
}

async function assertGoalClue(locator, expected) {
  const clue = await locator.textContent();
  assert.match(clue, expected);
  assert.doesNotMatch(clue, /\b[A-E][1-5]\b/, 'Bryan leaves the player to choose the spot');
}

async function verifyOuting(browser) {
  const qa = await practicePage(browser);
  const { page, tray, press, closeDialog, errors } = qa;
  const map = await openMap(qa);
  await assertGoalClue(map.locator('[data-map-goal]'), /Bryan.*perch.*weed edges.*10–15 ft.*jig/i);
  const hole = map.getByRole('button', { name: /A3, Weed edge/ });
  await press(hole, 'Enter');
  await press(map.locator('[data-map-drill]'), 'Enter');
  await buyPermit(qa, 'starter-license', 'Mille Lacs');
  await drillSelected(qa, map);
  await tray.locator('[data-exit]:enabled').waitFor();
  assert.match(await tray.locator('[data-fishing-goal]').textContent(), /Goal.*perch/i);
  assert.equal(await tray.getByRole('status').count(), 1);
  const openingRoster = (await profileCommand(page)).day.rosters.A3;
  assert.equal(openingRoster.length, 3);

  const wrong = await catchFish(qa, 'pike', 'spoon');
  assert.equal(await wrong.locator('h2').textContent(), 'Northern pike');
  assert.match(await wrong.textContent(), /\+17 coins.*\+17 XP/);
  assert.match(await tray.locator('[data-run-progress]').textContent(), /35 pts/);
  const afterPike = await profileCommand(page);
  assert.deepEqual(afterPike.caughtSpecies, ['pike']);
  assert.equal(afterPike.day.rosters.A3.length, 2);
  assert.deepEqual(Object.values(afterPike.catchLocations), [{ cellId: 'A3', speciesId: 'pike' }]);
  await closeDialog(wrong, wrong.locator('[data-reward-next]'));
  const goal = await catchFish(qa, 'perch', 'jig');
  assert.equal(await goal.locator('h2').textContent(), 'Yellow perch');
  assert.match(await goal.textContent(), /\+10 coins.*\+10 XP/);
  const pikeClue = /Bryan.*pike.*weed edges.*10–15 ft.*spoon/i;
  await assertGoalClue(goal.locator('[data-reward-goal]'), /goal complete.*pike.*weed edges.*10–15 ft.*spoon/i);
  assert.match(await tray.locator('[data-run-progress]').textContent(), /45 pts/);

  const saved = await profileCommand(page);
  assert.equal(saved.day.rosters.A3.length, 1);
  await page.reload({ waitUntil: 'domcontentloaded' });
  const resumed = await openMap(qa);
  await assertGoalClue(resumed.locator('[data-map-goal]'), pikeClue);
  assert.equal(await resumed.locator('[data-map-cell="A3"]').getAttribute('data-hole-open'), '');
  assert.deepEqual((await profileCommand(page)).day, saved.day);
  const next = await nextDay(qa);
  await assertGoalClue(next.locator('[data-map-goal]'), pikeClue);
  assert.notEqual((await profileCommand(page)).day.id, saved.day.id);
  await press(next.getByRole('button', { name: /E4, Weed edge, 10 ft/ }), 'Enter');
  await drillSelected(qa, next);
  assert.match(await tray.locator('[data-fishing-goal]').textContent(), /Goal.*pike/i);
  const pike = await catchFish(qa, 'pike', 'spoon');
  assert.equal(await pike.locator('h2').textContent(), 'Northern pike');
  assert.match(await pike.textContent(), /\+35 coins.*\+35 XP/);
  await assertGoalClue(pike.locator('[data-reward-goal]'), /goal complete.*walleye/i);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await openMap(qa);
  const reefMap = await nextDay(qa);
  await assertGoalClue(reefMap.locator('[data-map-goal]'), /walleye.*reef edges.*25 ft.*minnow/i);
  await press(reefMap.getByRole('button', { name: /B1, Reef edge/ }), 'Enter');
  await drillSelected(qa, reefMap);
  assert.match(await tray.locator('[data-fishing-goal]').textContent(), /Goal.*walleye/i);
  const walleye = await catchFish(qa, 'walleye', 'minnow');
  assert.equal(await walleye.locator('h2').textContent(), 'Walleye');
  assert.match(await walleye.textContent(), /\+25 coins.*\+25 XP/);
  assert.match(await walleye.locator('[data-reward-goal]').textContent(), /Bryan.*goals complete/i);

  await page.reload({ waitUntil: 'domcontentloaded' });
  const completeMap = await openMap(qa);
  assert.match(await completeMap.locator('[data-map-goal]').textContent(), /Bryan.*goals complete/i);
  const complete = await profileCommand(page);
  assert.equal(complete.goalCatches.length, 3);
  assert.deepEqual(complete.caughtSpecies, ['pike', 'perch', 'walleye']);
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
