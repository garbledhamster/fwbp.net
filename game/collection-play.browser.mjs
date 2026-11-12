import assert from 'node:assert/strict';
import { practicePage, withBrowser } from './browser-qa.mjs';

await withBrowser(async browser => {
  for (const mobile of [false, true]) {
    const { page, tray, action, status, enter, leave, press, findFish, tick, reelToHole, errors } = await practicePage(browser, { mobile });
    const savedProfile = () => page.evaluate(async () => {
      const { loadProfile } = await import('./game/profile.mjs?v=16');
      return loadProfile();
    });
    await page.evaluate(() => {
      window.savedCatches = [];
      document.addEventListener('fishing:catch-saved', event => window.savedCatches.push(event.detail));
    });
    await enter();
    await findFish();
    await press(action);
    await tick(700);
    await press(action);
    await reelToHole();
    assert.deepEqual((await savedProfile()).caughtSpecies, [], 'a hooked fish is not collected');

    await page.evaluate(() => {
      const original = IDBDatabase.prototype.transaction;
      IDBDatabase.prototype.transaction = function (...args) {
        const transaction = original.apply(this, args);
        if (args[1] === 'readwrite') {
          IDBDatabase.prototype.transaction = original;
          queueMicrotask(() => transaction.abort());
        }
        return transaction;
      };
    });
    await press(action);
    await status.filter({ hasText: /couldn’t save.*catch/i }).waitFor();
    assert.deepEqual((await savedProfile()).caughtSpecies, [], 'a failed write earns no collection credit');
    assert.equal(await page.evaluate(() => window.savedCatches.length), 0);
    assert.equal(await action.textContent(), 'Save catch');
    await page.clock.fastForward(20 * 60 * 1000);
    assert.equal(await action.textContent(), 'Save catch', 'Practice retains a failed landing beyond expiry');
    await press(action);
    await status.filter({ hasText: /yellow perch.*\+10 points/i }).waitFor();
    const saved = await savedProfile();
    assert.deepEqual(saved.caughtSpecies, ['perch']);
    assert.equal(saved.coins, 0);
    assert.deepEqual(saved.awards, {});
    assert.equal(Object.keys(saved.collectionAwards).length, 1);
    assert.equal(await page.evaluate(() => window.savedCatches.length), 1);
    assert.equal(await page.evaluate(() => window.savedCatches[0].mode), 'practice');
    await leave();

    // Learning during an existing encounter takes effect when the next encounter starts.
    await page.evaluate(() => { Math.random = () => .05; });
    await enter();
    await findFish();
    const cue = tray.locator('.fishing-studied-cue');
    assert.equal(await cue.isHidden(), true);
    await page.evaluate(async () => {
      const { openYourLake } = await import('./game/collection.mjs');
      openYourLake({ initialSpecies: 'perch' });
    });
    const collection = page.getByRole('dialog', { name: 'My Lake', exact: true });
    await collection.getByRole('button', { name: 'Learn this tip', exact: true }).click();
    await collection.getByRole('button', { name: 'Tip learned', exact: true }).waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await collection.locator('[data-species="perch"]').isVisible(), true);
    await page.keyboard.press('Escape');
    assert.equal(await collection.count(), 0);
    assert.equal(await tray.isVisible(), true, 'nested Escape does not end the outing');
    assert.equal(await cue.isHidden(), true, 'current fish does not reveal a newly learned tip');
    await leave();
    await enter();
    await findFish();
    assert.equal(await cue.isVisible(), true);
    assert.match(await cue.textContent(), /Jig.*Yellow perch/i);
    assert.match(await cue.locator('use').getAttribute('href'), /#jig$/);
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('PASS: Practice collection retries, settled events and later learned cues at desktop and touch widths');
});
