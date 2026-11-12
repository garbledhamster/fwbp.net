import assert from 'node:assert/strict';
import { practicePage, withBrowser } from './browser-qa.mjs';

await withBrowser(async browser => {
  const qa = await practicePage(browser, { campaignLiveButtons: true });
  const { page, tray, action, openGame, press, closeDialog, findFish, waitForBite, tick, reelToHole, errors } = qa;
  const map = page.locator('.fishing-map');
  const spotId = 'A3';
  const spot = map.locator(`[data-map-cell="${spotId}"]`);
  const fishInfo = map.locator('[data-map-fish]');
  const drillButton = map.locator('[data-map-drill]');
  const campaign = page.getByRole('button', { name: 'Campaign', exact: true });
  const save = input => page.evaluate(async input => {
    const { applyProfile, loadProfile } = await import('./game/profile.mjs');
    return input ? applyProfile(input) : loadProfile();
  }, input);
  const landing = (key, speciesId) => ({ type: 'award', key, outcome: 'landed', speciesId, catch: { points: 10 } });
  async function openMap() {
    await openGame();
    await press(campaign, 'Enter');
    await map.waitFor();
    await press(spot, 'Enter');
  }

  try {
    const starter = await save();
    assert.equal((await save({ type: 'buy', id: 'starter-license', revision: starter.revision })).status, 'bought');
    const practice = await save({ ...landing('practice:0', 'perch'), mode: 'practice' });
    assert.equal(practice.status, 'awarded');
    assert.deepEqual(practice.profile.caughtSpecies, ['perch']);
    const legacyDay = { id: 'legacy-day', allowance: 1, opened: ['E4'] };
    await page.evaluate(profile => new Promise((resolve, reject) => {
      const open = indexedDB.open('fwbp-campaign', 1);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction('profile', 'readwrite');
        tx.objectStore('profile').put(profile, 'campaign');
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onabort = () => { db.close(); reject(tx.error); };
      };
    }), { ...practice.profile, day: legacyDay });

    await openMap();
    assert.deepEqual((await save()).day, { ...legacyDay, allowance: 2, rosters: {} });
    assert.match(await map.locator('[data-map-allowance]').textContent(), /1 of 2 new holes/);
    assert.equal(await fishInfo.isHidden(), true);
    assert.equal(await fishInfo.textContent(), '');
    assert.doesNotMatch(await spot.getAttribute('aria-label'), /perch|pike|recognized/i);
    assert.equal(await spot.getAttribute('data-past-catch'), null, 'Practice does not leave a map marker');
    await map.locator('[data-depth-legend]').waitFor();
    await map.getByRole('radio', { name: 'Temperature' }).check();
    await map.locator('[data-temperature-legend]').waitFor();
    assert.equal(await map.locator('[data-depth-legend]').isHidden(), true);
    assert.match(await map.locator('[data-map-info]').textContent(), /36 °F/);
    const askBryan = map.locator('[data-map-help]');
    await press(askBryan, 'Enter');
    const help = page.locator('#map-help');
    await help.locator('[data-map-layer-tip]').filter({ hasText: /near the bottom/i }).waitFor();
    await closeDialog(help, help.locator('[data-map-help-close]'));
    assert.equal(await askBryan.evaluate(button => button === document.activeElement), true);

    await press(drillButton, 'Enter');
    const skipDrilling = page.locator('.fishing-drill [data-drill-skip]');
    await skipDrilling.waitFor();
    await page.evaluate(() => { Math.random = () => .05; });
    await press(skipDrilling, 'Enter');
    await tray.locator('[data-exit]:enabled').waitFor();
    const opened = (await save()).day;
    const roster = opened.rosters[spotId];
    assert.ok(roster.some(fish => fish.speciesId === 'pike'), 'the fixture also puts an unrecognized fish in this hole');

    await press(tray.locator('[data-open-map]'), 'Enter');
    await map.waitFor();
    assert.match(await fishInfo.textContent(), /Recognized at this hole.*Yellow perch/);
    assert.doesNotMatch(await fishInfo.textContent(), /pike/i);
    await press(drillButton, 'Enter');
    await findFish({ species: 'perch' });
    await press(action);
    await waitForBite();
    await tick(700);
    await press(page.getByRole('button', { name: 'Set hook', exact: true }));
    await reelToHole();
    await press(action);

    const reward = page.locator('.fishing-catch-popup');
    const view = reward.getByRole('button', { name: 'View in Your Lake' });
    await press(view, 'Enter');
    const lake = page.getByRole('dialog', { name: 'Your Lake', exact: true });
    await lake.getByRole('heading', { name: 'Yellow perch', exact: true }).waitFor();
    assert.match(await lake.locator('[data-catch-spots]').innerText(), /A3.*1 catch/s);
    const caught = await save();
    const [[key, location]] = Object.entries(caught.catchLocations);
    assert.deepEqual(location, { cellId: spotId, speciesId: 'perch' });
    const remaining = caught.day.rosters[spotId];
    assert.equal(remaining.length, roster.length - 1);
    const removed = roster.find(fish => !remaining.some(entry => entry.key === fish.key));
    assert.equal((await save({ ...landing(key, 'perch'), dayId: opened.id, cellId: spotId, fishKey: removed.key })).status,
      'duplicate-award', 'retrying the landed fish keeps its one saved payout');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await openMap();
    assert.deepEqual((await save()).day, caught.day, 'reload keeps the exact remaining fish and drilling allowance');
    assert.equal(await spot.getAttribute('data-hole-open'), '');
    assert.equal(await spot.getAttribute('data-past-catch'), '');

    // A different save can exhaust the hole while this map is open.
    for (const [index, fish] of remaining.entries()) {
      const result = await save({ ...landing(`other-outing:${index}`, fish.speciesId), dayId: opened.id, cellId: spotId, fishKey: fish.key });
      assert.equal(result.status, 'awarded');
    }
    await press(drillButton, 'Enter');
    await fishInfo.filter({ hasText: /this hole is quiet/i }).waitFor();
    assert.equal(await drillButton.isDisabled(), true);
    assert.deepEqual((await save()).day.rosters[spotId], []);
    await press(map.locator('[data-map-end]'), 'Enter');
    await press(campaign, 'Enter');
    await map.waitFor();
    await press(spot, 'Enter');
    assert.notEqual((await save()).day.id, opened.id);
    assert.equal(await spot.getAttribute('data-hole-open'), null);
    assert.equal(await spot.getAttribute('data-past-catch'), '');
    assert.match(await spot.getAttribute('aria-label'), /past catch/);
    assert.equal(await map.locator('[data-map-history]').isVisible(), true);
    assert.equal(await fishInfo.isHidden(), true);
    assert.equal(await drillButton.isEnabled(), true, 'a new day can stock the spot again');
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
});
console.log('PASS: map discovery, catch locations, saved hole stock and next-day markers');
