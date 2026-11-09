import assert from 'node:assert/strict';
import { withBrowser, practicePage } from './browser-qa.mjs';
import map from './lake-map-data.mjs';
const shore = map.cells.find((c) => c.area === 'starter-shore');
const reef = map.cells.find((c) => c.depthFt >= 30);
await withBrowser(async (browser) => {
  for (const viewport of [
    { width: 1200, height: 800 },
    { width: 320, height: 720 },
    { width: 720, height: 320 },
  ]) {
    const qa = await practicePage(browser, { mobile: viewport.width !== 1200, viewport });
    const { page, press, tray, enter, errors, findFish, tick, action } = qa;
    await enter('Campaign');
    assert.equal(await page.locator('.fishing-candidate').count(), 2);
    assert.equal(await tray.locator('.fishing-countdown').isVisible(), false);
    const source = await page
      .locator('.fishing-target')
      .evaluate((el) => [el.parentElement.dataset.dive, el.style.cssText]);
    await press(page.locator('.fishing-candidate').first(), 'Enter');
    assert.notDeepEqual(
      await page
        .locator('.fishing-target')
        .evaluate((el) => [el.parentElement.dataset.dive, el.style.cssText]),
      source,
    );
    assert.match(await tray.locator('[data-run-progress]').textContent(), /1\/6/);
    await press(tray.locator('[data-open-map]'), 'Enter');
    const dialog = page.locator('.fishing-map');
    assert.equal(await dialog.locator(`[data-map-cell="${shore.id}"]`).getAttribute('aria-pressed'), 'true');
    await press(dialog.locator(`[data-map-cell="${reef.id}"]`), 'Enter');
    const permit = page.locator('.fishing-permit');
    await permit.waitFor();
    assert.match(await permit.textContent(), /Deep Reef permit/);
    await press(permit.locator('[data-permit-shop]'), 'Enter');
    const shop = page.locator('.fishing-shop');
    await shop.waitFor();
    await shop.locator('[data-item="deep-reef-license"]').waitFor();
    await qa.closeDialog(shop, shop.locator('[data-shop-back]'));
    await dialog.waitFor();
    if (process.env.FISHING_EVIDENCE_DIR)
      await page.screenshot({ path: `${process.env.FISHING_EVIDENCE_DIR}/map-${viewport.width}.png` });
    assert.equal(await dialog.locator(`[data-map-cell="${reef.id}"]`).getAttribute('aria-pressed'), 'true');
    await press(dialog.locator(`[data-map-cell="${shore.id}"]`), 'Enter');
    assert.equal(await dialog.locator('[data-map-drill]').textContent(), 'Fish this hole');
    await press(dialog.locator('[data-map-drill]'), 'Enter');
    assert.equal(await page.locator('.fishing-drill').isVisible(), false);
    await findFish();
    // Any jig commits, including a wrong lure. A later target selection must confirm.
    await press(action);
    await tick(300);
    await press(page.locator('.fishing-candidate').first(), 'Enter');
    await page.locator('.fishing-end-attempt').waitFor();
    await press(page.locator('[data-end-cancel]'), 'Enter');
    assert.match(await tray.locator('[data-run-progress]').textContent(), /1\/6/);
    await press(tray.locator('[data-open-map]'), 'Enter');
    await press(page.locator('[data-end-confirm]'), 'Enter');
    await dialog.waitFor();
    assert.match(await dialog.locator('[data-map-budget]').textContent(), /5 of 6/);
    await press(dialog.locator('[data-map-back]'), 'Enter');
    assert.match(await tray.locator('[data-run-progress]').textContent(), /2\/6/);
    assert.deepEqual(errors, []);
    if (process.env.FISHING_EVIDENCE_DIR)
      await page.screenshot({ path: `${process.env.FISHING_EVIDENCE_DIR}/map-play-${viewport.width}.png` });
    await page.close();
  }
});
console.log(
  'Campaign map, permit return, targets, abandonment and revisits passed at desktop, portrait and landscape.',
);
