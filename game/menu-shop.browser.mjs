import assert from 'node:assert/strict';
import { practicePage, withBrowser } from './browser-qa.mjs';

// Catches accidental purchasing/equipping during grid browsing, wrong
// targeted-shop returns, and profile gear changing a fight already in progress.
await withBrowser(async browser => {
  for (const viewport of [{ width: 1200, height: 720 }, { width: 320, height: 720 }, { width: 720, height: 320 }]) {
    const { page, tray, action, enter, press, findFish, tick, errors } = await practicePage(browser, { mobile: viewport.width === 320 });
    await page.setViewportSize(viewport);
    const saved = () => page.evaluate(async () => (await import('./game/profile.mjs?v=16')).loadProfile());
    await page.evaluate(async () => {
      const { loadProfile } = await import('./game/profile.mjs?v=16');
      const profile = await loadProfile();
      profile.coins = 100;
      await new Promise((resolve, reject) => {
        const request = indexedDB.open('fwbp-campaign', 1);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('profile', 'readwrite');
          tx.objectStore('profile').put(profile, 'campaign');
          tx.oncomplete = () => { db.close(); resolve(); };
          tx.onerror = () => reject(tx.error);
        };
        request.onerror = () => reject(request.error);
      });
    });
    // Public interface selects the exact item and returns via the caller.
    await page.evaluate(async () => {
      const { openShop } = await import(document.querySelector('script[src*="/game/fishing.mjs"]').src);
      await openShop({ itemId: 'finesse-hook', onClose: () => { document.body.dataset.shopReturned = 'yes'; } });
    });
    const shop = page.getByRole('dialog', { name: 'Tackle shop', exact: true });
    const before = await saved();
    assert.equal(await shop.locator('[data-item="finesse-hook"]').isVisible(), true, 'target hook is selected');
    if (viewport.width === 320) await press(shop.locator('[data-shop-grid-back]'));
    await press(shop.locator('[data-shop-select="starter-hook"]'));
    assert.match(await shop.locator('[data-shop-inspector]').textContent(), /Standard hooks/);
    if (viewport.width === 320) await press(shop.locator('[data-shop-grid-back]'));
    await press(shop.locator('[data-shop-select="finesse-hook"]'));
    assert.match(await shop.locator('[data-shop-inspector]').textContent(), /200 ms/);
    assert.deepEqual(await saved(), before, 'browsing does not alter coins, ownership or equipment');
    await press(shop.getByRole('button', { name: 'Back', exact: true }));
    await page.waitForFunction(() => document.body.dataset.shopReturned === 'yes');
    assert.equal(await page.locator('body').getAttribute('data-shop-returned'), 'yes');
    assert.equal(await page.locator('.fishing-picker[open]').count(), 0, 'custom return replaces picker return');

    await enter('Practice');
    await findFish();
    await press(action);
    await tick(700);
    await press(action);
    const max = await tray.locator('meter').evaluate(el => el.max);
    await press(tray.locator('[data-exit]'));
    const pause = page.getByRole('dialog', { name: 'Paused', exact: true });
    await press(pause.getByRole('button', { name: 'Tackle shop', exact: true }));
    await press(shop.locator('[data-shop-select="stronger-line"]'));
    await shop.locator('[data-item="stronger-line"]').waitFor();
    const frozenLoad = await tray.locator('meter').evaluate(el => el.value);
    await tick(60000);
    assert.equal(await tray.locator('meter').evaluate(el => el.value), frozenLoad, 'Shop holds the active fight');
    const stronger = shop.locator('[data-item="stronger-line"]');
    await press(stronger.getByRole('button', { name: 'Buy Stronger line', exact: true }));
    await stronger.getByText('Owned', { exact: true }).waitFor();
    assert.equal((await saved()).coins, 90, 'explicit Buy spends once');
    // Hold the actual IndexedDB completion event to expose the interval where
    // the save is pending, regardless of machine speed or concurrent QA load.
    await page.evaluate(() => {
      const descriptor = Object.getOwnPropertyDescriptor(IDBTransaction.prototype, 'oncomplete');
      Object.defineProperty(IDBTransaction.prototype, 'oncomplete', {
        ...descriptor,
        set(callback) {
          descriptor.set.call(this, function (event) {
            window.finishShopSave = () => {
              Object.defineProperty(IDBTransaction.prototype, 'oncomplete', descriptor);
              callback.call(this, event);
            };
          });
        },
      });
    });
    await press(stronger.getByRole('button', { name: 'Equip Stronger line', exact: true }));
    await page.waitForFunction(() => typeof window.finishShopSave === 'function');
    assert.equal(await shop.locator('[data-shop-back]').isDisabled(), true, 'Back visibly waits for the pending save');
    await page.keyboard.press('Escape');
    assert.equal(await shop.isVisible(), true, 'Escape also preserves the pending save');
    await page.evaluate(() => window.finishShopSave());
    await stronger.getByText('Equipped for next outing', { exact: true }).waitFor();
    await page.waitForFunction(() => !document.querySelector('[data-shop-back]').disabled);
    assert.equal((await saved()).equipped.line, 'stronger-line');
    assert.equal(await tray.locator('meter').evaluate(el => el.max), max, 'current outing keeps its equipment snapshot');
    const shopClosed = shop.evaluate(el => new Promise(resolve => el.addEventListener('close', () => resolve(), { once: true })));
    await press(shop.getByRole('button', { name: 'Back to Pause', exact: true }));
    await shopClosed;
    await press(pause.getByRole('button', { name: 'Gear', exact: true }));
    const gear = page.getByRole('dialog', { name: 'Gear', exact: true });
    assert.match(await gear.locator('.fishing-loadout').textContent(), /This outing.*Starter line.*Next Campaign outing.*Stronger line/s);
    assert.equal(await gear.evaluate(el => el.scrollWidth <= el.clientWidth), true, 'Gear fits the viewport');
    await page.keyboard.press('Escape');
    await press(pause.getByRole('button', { name: 'Resume fishing', exact: true }));
    assert.equal(await tray.isVisible(), true);
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('PASS: targeted shop, explicit purchases, grid browsing, pending-save hold, and next-outing loadout');
});
