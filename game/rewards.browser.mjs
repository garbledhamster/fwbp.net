import assert from 'node:assert/strict';
import { practicePage, withBrowser } from './browser-qa.mjs';

await withBrowser(async browser => {
  const { page, tray, action, status, enter, press, findFish, tick, errors, reelToHole } = await practicePage(browser);
  await enter('Campaign');
  await findFish();
  await press(action);
  await tick(700);
  await press(action);
  await reelToHole();

  // Abort the next browser save, then let the real store handle the retry.
  await page.evaluate(() => {
    const original = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (stores, mode, ...options) {
      const transaction = original.call(this, stores, mode, ...options);
      if (mode === 'readwrite') {
        IDBDatabase.prototype.transaction = original;
        queueMicrotask(() => transaction.abort());
      }
      return transaction;
    };
  });

  await press(action);
  await status.filter({ hasText: /couldn’t save.*catch/i }).waitFor();
  assert.equal(await action.textContent(), 'Save catch', 'keep a retry on the earned catch');
  assert.equal(await tray.locator('[data-wallet]').textContent(), '0 coins');
  await page.clock.fastForward(20 * 60 * 1000);
  assert.equal(await action.textContent(), 'Save catch', 'an expired outing keeps an earned payout available');
  await press(action);
  await status.filter({ hasText: /yellow perch.*\+10 coins/i }).waitFor();
  assert.equal(await tray.locator('[data-wallet]').textContent(), '10 coins');
  const saved = await page.evaluate(async () => {
    const { loadProfile } = await import('./game/profile.mjs?v=16');
    return loadProfile();
  });
  assert.deepEqual(Object.values(saved.awards), [10]);
  assert.deepEqual(saved.caughtSpecies, ['perch']);
  assert.equal(Object.keys(saved.collectionAwards).length, 0, 'Campaign uses its existing payout ledger');
  assert.deepEqual(errors, []);
  await page.close();
  console.log('PASS: a transient save failure can retry the same catch award');
});
