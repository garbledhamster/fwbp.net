import assert from 'node:assert/strict';
import { withBrowser, practicePage } from './browser-qa.mjs';
import map from './lake-map-data.mjs';

const shore = map.cells.find(cell => cell.area === 'starter-shore');
const reef = map.cells.find(cell => cell.depthFt >= 30);

async function checkShortPortraitMap(browser) {
  const { page, press, openGame, closeDialog } = await practicePage(browser, {
    mobile: true, viewport: { width: 320, height: 568 },
  });
  try {
    const dialog = page.locator('.fishing-map');
    await openGame();
    await press(page.getByRole('button', { name: 'Campaign', exact: true }), 'Enter');
    await dialog.waitFor();
    await press(dialog.locator('[data-map-drill]'), 'Enter');
    await press(page.locator('[data-permit-shop]'), 'Enter');
    const shop = page.locator('.fishing-shop');
    const item = shop.locator('[data-item="starter-license"]');
    await press(item.getByRole('button', { name: /^(Buy|Claim) Mille Lacs permit$/ }), 'Enter');
    await item.getByText('Owned', { exact: true }).waitFor();
    await closeDialog(shop, shop.locator('[data-shop-back]'));
    await dialog.waitFor();
    const selected = dialog.locator(`[data-map-cell="${shore.id}"]`);
    const position = await selected.evaluate(cell => {
      const box = cell.getBoundingClientRect();
      const footer = cell.closest('dialog').querySelector('.fishing-map-actions').getBoundingClientRect();
      const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      return { focused: cell === document.activeElement, hittable: cell.contains(hit), cellBottom: box.bottom, footerTop: footer.top };
    });
    assert.ok(position.focused && position.hittable && position.cellBottom <= position.footerTop,
      `focused hole must be fully above the footer at 320×568: ${JSON.stringify(position)}`);
    console.log('PASS 320×568: the selected hole is visible and reachable after claiming the permit');
  } finally {
    await page.close();
  }
}

await withBrowser(async browser => {
  await checkShortPortraitMap(browser);
  for (const viewport of [
    { width: 1200, height: 800 },
    { width: 320, height: 720 },
    { width: 720, height: 320 },
  ]) {
    const qa = await practicePage(browser, { mobile: viewport.width !== 1200, viewport });
    const { page, press, tray, enter, errors, findFish, waitForBite, tick, status } = qa;
    const dialog = page.locator('.fishing-map');
    const cell = id => dialog.locator(`[data-map-cell="${id}"]`);
    const moveHole = tray.locator('[data-open-map]');
    const confirm = page.locator('.fishing-end-attempt');
    const progress = tray.locator('[data-run-progress]');

    await enter('Campaign');
    await findFish({ species: 'perch' });
    assert.equal(await tray.locator('.fishing-countdown').isVisible(), false);
    await press(moveHole, 'Enter');
    await dialog.waitFor();
    assert.equal(await confirm.isVisible(), false, 'looking for fish has no attempt to abandon');
    assert.match(await dialog.locator('[data-map-budget]').textContent(), /6 of 6/);
    assert.equal(await cell(shore.id).getAttribute('aria-pressed'), 'true');
    assert.equal(await cell(shore.id).getAttribute('data-hole-open'), '');

    await press(cell(reef.id), 'Enter');
    assert.equal(await cell(reef.id).getAttribute('aria-pressed'), 'true');
    assert.equal(await cell(reef.id).getAttribute('data-spot-access'), 'unlocked');
    assert.equal(await dialog.locator('[data-map-drill]').textContent(), 'Drill hole');
    if (process.env.FISHING_EVIDENCE_DIR) {
      await page.screenshot({ path: `${process.env.FISHING_EVIDENCE_DIR}/map-${viewport.width}.png` });
    }
    assert.equal(await cell(reef.id).getAttribute('aria-pressed'), 'true');
    await press(cell(shore.id), 'Enter');
    assert.equal(await dialog.locator('[data-map-drill]').textContent(), 'Fish this hole');
    await press(dialog.locator('[data-map-drill]'), 'Enter');
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(await page.locator('.fishing-drill').isVisible(), false);
    assert.match(await progress.textContent(), /1\/6/);

    await findFish({ species: 'perch' });
    await page.keyboard.press('j');
    await waitForBite();
    await tick(700);
    await page.keyboard.press('r');
    assert.match(await status.textContent(), /reel it up toward the hole/i);
    await press(moveHole, 'Enter');
    await confirm.waitFor();
    assert.match(await confirm.textContent(), /Release this fish/);
    await press(confirm.locator('[data-end-cancel]'), 'Enter');
    assert.match(await progress.textContent(), /1\/6/);
    assert.equal(await tray.getByRole('meter').isVisible(), true, 'cancel keeps the same hooked fish');

    await press(moveHole, 'Enter');
    await press(confirm.locator('[data-end-confirm]'), 'Enter');
    await dialog.waitFor();
    assert.match(await dialog.locator('[data-map-budget]').textContent(), /5 of 6/);
    await press(dialog.locator('[data-map-back]'), 'Enter');
    assert.match(await progress.textContent(), /2\/6/);
    assert.equal(await tray.getByRole('meter').isVisible(), false);
    assert.equal(await tray.locator('[data-wallet]').textContent(), '0 coins', 'release has no catch payout');
    assert.deepEqual(errors, []);
    if (process.env.FISHING_EVIDENCE_DIR) {
      await page.screenshot({ path: `${process.env.FISHING_EVIDENCE_DIR}/map-play-${viewport.width}.png` });
    }
    await page.close();
  }
});
console.log('PASS: Campaign permit return, open-hole revisit, and release at desktop, portrait and landscape');
