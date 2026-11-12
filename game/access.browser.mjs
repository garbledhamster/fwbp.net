import assert from 'node:assert/strict';
import { practicePage, withBrowser } from './browser-qa.mjs';

await withBrowser(async browser => {
  for (const mobile of [false, true]) {
    const qa = await practicePage(browser, { mobile });
    const { page, press, tray, closeDialog } = qa;
    await qa.openGame();
    const picker = page.getByRole('dialog', { name: 'Choose an outing' });
    assert.equal(await picker.getByRole('button', { name: 'Deep Reef', exact: true }).count(), 0);
    await press(picker.getByRole('button', { name: 'Campaign', exact: true }));
    const map = page.getByRole('dialog', { name: 'Campaign · Mille Lacs' });
    const reef = map.locator('[data-map-cell="B1"]');
    const guide = page.getByRole('dialog', { name: 'Mille Lacs permit' });
    const permitShop = guide.getByRole('button', { name: 'Get this permit' });
    const mapAction = map.locator('[data-map-drill]');
    await press(reef);
    await press(mapAction);
    await guide.getByText(/claim your free Mille Lacs permit/i).waitFor();
    assert.equal(await tray.isHidden(), true);
    assert.equal(await guide.locator('img').getAttribute('src'), './assets/fishing/conservation-officer.webp');
    await press(guide.getByRole('button', { name: 'Back to map' }));
    await map.waitFor();
    assert.equal(await reef.evaluate(el => el === document.activeElement), true);
    await press(mapAction);
    await guide.getByText(/claim your free Mille Lacs permit/i).waitFor();
    await press(permitShop);
    const shop = page.getByRole('dialog', { name: 'Tackle shop' });
    const permit = shop.locator('[data-item="starter-license"]');
    await press(permit.getByRole('button', { name: /^(Buy|Claim) Mille Lacs permit$/ }));
    await permit.getByText('Owned', { exact: true }).waitFor();
    assert.equal(await shop.locator('[data-item="deep-reef-license"]').count(), 0);
    await closeDialog(shop, shop.locator('[data-shop-back]'));
    await map.waitFor();
    assert.equal(await reef.evaluate(el => el === document.activeElement), true);
    assert.equal(await tray.isHidden(), true, 'claiming the permit does not drill the selected spot');
    await press(mapAction);
    await press(page.locator('[data-drill-skip]'));
    await tray.locator('[data-exit]:enabled').waitFor();
    assert.match(await tray.locator('[data-water]').textContent(), /B1.*25 ft.*Reef edge/);
    const saved = await page.evaluate(async () => (await import('./game/profile.mjs')).loadProfile());
    assert.deepEqual(saved.day.opened, ['B1']);
    assert.ok(saved.owned.includes('starter-license'));
    assert.equal(saved.coins, 0);
    assert.deepEqual(qa.errors, []);
    await page.close();
  }
  console.log('PASS free Mille Lacs permit, return focus and deep-hole access on desktop and touch');
});
