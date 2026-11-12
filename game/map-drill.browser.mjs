import assert from 'node:assert/strict';
import { practicePage, withBrowser } from './browser-qa.mjs';

async function seedWallet(page) {
  await page.evaluate(async () => {
    const { applyProfile } = await import('./game/profile.mjs');
    const { profile } = await applyProfile({ type: 'award', key: 'earlier-outing:0', outcome: 'landed', catch: { points: 100 } });
    await applyProfile({ type: 'buy', id: 'starter-license', revision: profile.revision });
  });
}

await withBrowser(async (browser) => {
  const conditions = [];
  for (const skip of [false, true]) {
    const qa = await practicePage(browser, { mobile: skip });
    const { page, press, tray } = qa;
    await seedWallet(page);
    await press(qa.launch, 'Enter');
    await press(page.locator('[data-mode="campaign"][data-area="starter-shore"]'), 'Enter');
    const map = page.locator('.fishing-map');
    const drill = page.locator('.fishing-drill');
    const drillProgress = drill.getByRole('progressbar');
    const cell = id => map.locator(`[data-map-cell="${id}"]`);
    const open = map.locator('[data-map-drill]');

    if (skip) await press(cell('E4'), 'Enter');
    else await cell('E4').click();
    assert.match(await map.locator('[data-map-info]').textContent(), /10 ft/);
    await press(open, 'Enter');
    const shallowTurns = Number(await drillProgress.getAttribute('max'));
    await press(drill.locator('[data-drill-turn]'));
    assert.equal(await drillProgress.getAttribute('value'), '1');
    await press(drill.locator('[data-drill-back]'), 'Enter');
    assert.equal(await map.locator('[data-hole-open]').count(), 0);
    assert.match(await map.locator('[data-map-allowance]').textContent(), /2 of 2 new holes/);

    await press(cell('A3'), 'Enter');
    await press(open, 'Enter');
    const weedTurns = Number(await drillProgress.getAttribute('max'));
    assert.ok(weedTurns > shallowTurns, 'the two shore spots require different effort');
    assert.equal(await drillProgress.getAttribute('value'), '0');
    if (skip) await press(drill.locator('[data-drill-skip]'), 'Enter');
    else {
      for (let i = 0; i < weedTurns - 1; i++) await press(drill.locator('[data-drill-turn]'));
      assert.equal(await drillProgress.getAttribute('value'), String(weedTurns - 1));
      if (process.env.FISHING_EVIDENCE_DIR)
        await page.screenshot({ path: `${process.env.FISHING_EVIDENCE_DIR}/drilling.png` });
      await press(drill.locator('[data-drill-turn]'));
    }
    await tray.locator('[data-exit]:enabled').waitFor();
    const water = await tray.locator('[data-water]').textContent();
    const bands = await page.locator('.lake > .dive:visible').count();
    assert.match(water, /A3.*15 ft.*Weed edge/);
    conditions.push({ water, bands });
    assert.equal(await tray.locator('meter').getAttribute('max'), '8');

    await press(tray.locator('[data-open-map]'), 'Enter');
    await map.waitFor();
    assert.equal(await cell('A3').getAttribute('data-hole-open'), '');
    await press(cell('E4'), 'Enter');
    assert.equal(await open.isDisabled(), false);
    await press(open, 'Enter');
    await press(drill.locator('[data-drill-skip]'), 'Enter');
    await tray.locator('[data-water]').filter({ hasText: 'E4' }).waitFor();
    await press(tray.locator('[data-open-map]'), 'Enter');
    await map.waitFor();
    assert.match(await map.locator('[data-map-allowance]').textContent(), /0 of 2 new holes/);

    await press(cell('C1'), 'Enter');
    assert.match(await map.locator('[data-map-permit]').textContent(), /Mille Lacs permit.*Owned/);
    assert.equal(await cell('C1').locator('.fishing-map-lock-mark').isVisible(), false);
    await map.getByRole('radio', { name: 'Temperature' }).check();
    assert.match(await map.locator('[data-map-info]').textContent(), /C1 · Unlocked · .*°F/);
    assert.equal(await open.isDisabled(), true, 'the daily limit applies to deep water too');

    await press(map.locator('[data-map-back]'), 'Enter');
    await map.waitFor({ state: 'hidden' });
    await press(tray.locator('[data-exit]'), 'Enter');
    await press(page.locator('.fishing-pause [data-action="shop"]'), 'Enter');
    const shop = page.locator('.fishing-shop');
    await shop.locator('[data-shop-grid]').waitFor();
    const line = await qa.selectTackle('stronger-line');
    await press(line.getByRole('button', { name: 'Buy Stronger line', exact: true }), 'Enter');
    await press(line.getByRole('button', { name: 'Equip Stronger line', exact: true }), 'Enter');
    await line.getByText('Equipped for next outing', { exact: true }).waitFor();
    await qa.closeDialog(shop, shop.locator('[data-shop-back]'));
    const pause = page.locator('.fishing-pause');
    await qa.closeDialog(pause, pause.locator('[data-action="resume"]'));
    await press(tray.locator('[data-open-map]'), 'Enter');
    await map.waitFor();

    await press(cell('A3'), 'Enter');
    await press(open, 'Enter');
    await tray.locator('[data-water]').filter({ hasText: 'A3' }).waitFor();
    assert.equal(await drill.isVisible(), false);
    assert.equal(await tray.locator('[data-water]').textContent(), water);
    assert.equal(await tray.locator('meter').getAttribute('max'), '8', 'returning to an open hole keeps the active line');
    assert.match(await tray.locator('[data-run-progress]').textContent(), /1\/6/);

    await qa.leave();
    assert.equal(await page.locator('.lake > .dive:visible').count(), 7, 'leaving restores the site lake');
    await press(qa.launch, 'Enter');
    await press(page.getByRole('button', { name: 'Campaign', exact: true }), 'Enter');
    await press(map.locator('[data-map-end]'), 'Enter');
    await qa.chooseMode('Campaign', 'C1');
    assert.equal(await tray.locator('meter').getAttribute('max'), '12', 'new equipment applies next outing');
    assert.ok(await page.locator('.lake > .dive:visible').count() > bands, 'deep holes extend the playable water');
    assert.deepEqual(qa.errors, []);
    await page.close();
  }
  assert.deepEqual(conditions[0], conditions[1], 'drill and skip open identical hole conditions');
});
console.log('Mouse, keyboard and touch drill progress, cancellation, skip parity, permit flow and gear passed.');
