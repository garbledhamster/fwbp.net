import assert from 'node:assert/strict';
import { practicePage, withBrowser } from './browser-qa.mjs';
import map from './lake-map-data.mjs';
const shore = map.cells.find((cell) => cell.area === 'starter-shore');
const reef = map.cells.find((cell) => cell.depthFt >= 30);
const visibleWaterBands = (page) =>
  page.locator('.lake > .dive:visible').count();
const snapshot = (page) =>
  page
    .locator('.fishing-target, .fishing-candidate')
    .evaluateAll((els) =>
      els.map((el) => ({
        art: el.querySelector('use').getAttribute('href'),
        band: el.parentElement.dataset.dive,
        x: el.style.getPropertyValue('--x'),
        y: el.style.getPropertyValue('--y'),
      })),
    );
async function seedWallet(page) {
  await page.evaluate(async () => {
    const { loadProfile } = await import('./game/profile.mjs');
    const saved = await loadProfile();
    saved.coins = 100;
    saved.awards['earlier-outing:0'] = 10;
    saved.owned.push('starter-license');
    await new Promise((resolve, reject) => {
      const request = indexedDB.open('fwbp-campaign', 1);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('profile', 'readwrite');
        tx.objectStore('profile').put(saved, 'campaign');
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });
  });
}
await withBrowser(async (browser) => {
  const conditions = [];
  for (const skip of [false, true]) {
    const qa = await practicePage(browser);
    const { page, press, tray } = qa;
    await seedWallet(page);
    await press(qa.launch, 'Enter');
    await press(page.locator('[data-mode="campaign"][data-area="starter-shore"]'), 'Enter');
    await press(page.locator('[data-map-drill]'), 'Enter');
    if (skip) await press(page.locator('[data-drill-skip]'), 'Enter');
    else {
      for (let i = 0; i < 7; i++) await press(page.locator('[data-drill-turn]'), 'Space');
      assert.equal(await page.locator('.fishing-drill progress').getAttribute('value'), '7');
      if (process.env.FISHING_EVIDENCE_DIR)
        await page.screenshot({ path: `${process.env.FISHING_EVIDENCE_DIR}/drilling.png` });
      await press(page.locator('[data-drill-turn]'), 'Space');
    }
    await tray.locator('[data-exit]:enabled').waitFor();
    conditions.push(await snapshot(page));
    assert.match(
      await tray.locator('[data-water]').textContent(),
      new RegExp(`${shore.id}.*${shore.depthFt} ft`),
    );
    const firstHole = await snapshot(page);
    const shoreBands = await visibleWaterBands(page);
    // The matching permit is bought through Rowan, then the same selection resumes.
    await press(tray.locator('[data-open-map]'), 'Enter');
    await press(page.locator(`[data-map-cell="${reef.id}"]`), 'Enter');
    await press(page.locator('[data-permit-shop]'), 'Enter');
    const shop = page.locator('.fishing-shop');
    const permit = await qa.selectTackle('deep-reef-license');
    await press(permit.getByRole('button', { name: 'Buy Deep Reef permit', exact: true }), 'Enter');
    await permit.getByText('Owned', { exact: true }).waitFor();
    const line = await qa.selectTackle('stronger-line');
    await press(line.getByRole('button', { name: 'Buy Stronger line', exact: true }), 'Enter');
    await press(line.getByRole('button', { name: 'Equip Stronger line', exact: true }), 'Enter');
    await line.getByText('Equipped for next outing', { exact: true }).waitFor();
    await qa.closeDialog(shop, shop.locator('[data-shop-back]'));
    assert.equal(await page.locator(`[data-map-cell="${reef.id}"]`).getAttribute('aria-pressed'), 'true');
    await press(page.locator('[data-map-drill]'), 'Enter');
    await press(page.locator('[data-drill-skip]'), 'Enter');
    assert.notDeepEqual(await snapshot(page), firstHole);
    assert.ok(await visibleWaterBands(page) > shoreBands, 'deep holes extend the playable water');
    assert.match(
      await tray.locator('[data-water]').textContent(),
      new RegExp(`${reef.id}.*${reef.depthFt} ft`),
    );
    assert.equal(await tray.locator('meter').getAttribute('max'), '8', 'moving preserves active line');
    assert.match(await tray.locator('[data-run-progress]').textContent(), /1\/6/);
    await press(tray.locator('[data-open-map]'), 'Enter');
    await press(page.locator(`[data-map-cell="${shore.id}"]`), 'Enter');
    await press(page.locator('[data-map-drill]'), 'Enter');
    assert.equal(await page.locator('.fishing-drill').isVisible(), false);
    assert.deepEqual(await snapshot(page), firstHole, 'revisit never rerolls candidates');
    assert.equal(await visibleWaterBands(page), shoreBands, 'revisit restores the original depth');
    await qa.leave();
    assert.equal(await visibleWaterBands(page), 7, 'leaving restores the entire site lake');
    await qa.enter('Campaign');
    assert.equal(await tray.locator('meter').getAttribute('max'), '12', 'new equipment applies next outing');
    assert.deepEqual(qa.errors, []);
    await page.close();
  }
  assert.deepEqual(conditions[0], conditions[1], 'drill and skip open identical fish and depths');
});
console.log('Drill/skip parity, reef purchase, contrasting holes, stable revisits and equipment passed.');
