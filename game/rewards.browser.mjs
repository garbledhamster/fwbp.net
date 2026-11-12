import assert from 'node:assert/strict';
import { practicePage, withBrowser } from './browser-qa.mjs';

await withBrowser(async browser => {
  const { page, tray, action, status, enter, press, findFish, waitForBite, tick, errors, reelToHole } = await practicePage(browser);
  const tapWater = async () => {
    const box = await tray.boundingBox();
    await page.mouse.click(32, box.y * .42);
  };
  await enter('Campaign');
  await findFish({ species: 'perch' });
  await tapWater();
  await waitForBite();
  await tick(700);
  await tapWater();
  await page.getByRole('meter', { name: 'Reel feedback' }).waitFor();

  // Reject the landed-specimen write, while allowing the outing clock to save.
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, ...args) {
      const request = put.call(this, value, ...args);
      if (Object.keys(value?.landedFish ?? {}).length) {
        IDBObjectStore.prototype.put = put;
        queueMicrotask(() => this.transaction.abort());
      }
      return request;
    };
  });
  await reelToHole();
  await status.filter({ hasText: /couldn’t save.*catch/i }).waitFor();
  assert.equal(await action.textContent(), 'Save catch', 'keep a retry on the earned catch');
  const wallet = tray.locator('[data-wallet]');
  assert.equal(await wallet.textContent(), '0 coins');
  await page.clock.fastForward(20 * 60 * 1000);
  assert.equal(await action.textContent(), 'Save catch', 'an expired outing keeps an earned catch available');
  await press(action);
  await status.filter({ hasText: /yellow perch.*coins to collect/i }).waitFor();
  assert.equal(await wallet.textContent(), '0 coins', 'retry records the catch without claiming its reward');
  const saved = await page.evaluate(async () => {
    const { loadProfile } = await import('./game/profile.mjs?v=16');
    return loadProfile();
  });
  assert.deepEqual(Object.values(saved.awards), [10]);
  assert.deepEqual(saved.caughtSpecies, ['perch']);
  assert.equal(Object.keys(saved.landedFish).length, 1);
  assert.ok(saved.fishRewards.perch.coins > 0);
  assert.equal(Object.keys(saved.collectionAwards).length, 0, 'Campaign uses its existing XP ledger');
  assert.deepEqual(errors, []);
  await page.close();
  console.log('PASS: a Campaign catch survives a failed save and outing expiry without an automatic coin claim');
});
