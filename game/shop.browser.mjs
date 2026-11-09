import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { practicePage, withBrowser } from './browser-qa.mjs';

// Keep the search part of the playthrough on the same controls a player uses.
async function search(page, tray, action, mobile) {
  const touch = mobile ? await page.context().newCDPSession(page) : null;
  try {
    for (let step = 0; step < 18 && await action.isDisabled(); step++) {
      const oldY = await page.evaluate(() => scrollY);
      if (touch) {
        const from = Math.round((await tray.boundingBox()).y * .83);
        const send = (type, y) => touch.send('Input.dispatchTouchEvent', {
          type, touchPoints: y === undefined ? [] : [{ x: 150, y }],
        });
        await send('touchStart', from);
        for (const distance of [45, 90, 135]) await send('touchMove', from - distance);
        // Lift a stationary finger so a kinetic scroll does not carry the fish past the tray.
        await page.waitForTimeout(160);
        await send('touchEnd');
      } else {
        await page.keyboard.press('PageDown');
      }
      await page.waitForFunction(start => scrollY > start, oldY, { polling: 25 });
    }
    assert.ok(await action.isEnabled(), 'scroll to find the fish above the tray');
  } finally {
    await touch?.detach();
  }
}

async function checkShop(browser, mobile) {
  const { leave, page, launch, tray, action, status, button, enter, press, tick, findFish, waitForBite, errors, reelToHole, closeSavedCatch } =
    await practicePage(browser, { mobile, campaignLiveButtons: true });
  const picker = page.getByRole('dialog', { name: 'Choose an outing' });
  const shop = page.getByRole('dialog', { name: 'Tackle shop' });
  const stronger = shop.locator('[data-item="stronger-line"]');
  const starter = shop.locator('[data-item="starter-line"]');
  const buy = stronger.getByRole('button', { name: 'Buy Stronger line' });
  const equip = item => item.getByRole('button', { name: /^Equip / });
  const balance = shop.locator('[data-shop-balance]');
  const meter = tray.getByRole('meter');
  const wallet = tray.locator('[data-wallet]');
  const phase = tray.locator('[data-phase]');
  const evidence = process.env.FISHING_EVIDENCE_DIR;
  if (evidence && !mobile) await page.setViewportSize({ width: 1586, height: 992 });

  async function capture(step) {
    if (!evidence) return;
    await mkdir(evidence, { recursive: true });
    await page.screenshot({
      path: join(evidence, `${mobile ? 'phone' : 'desktop'}-${step}.png`),
      animations: 'disabled',
    });
  }

  async function textVisible(container, pattern) {
    await container.getByText(pattern).waitFor({ state: 'visible' });
  }

  async function openShop() {
    await press(launch, 'Enter');
    const entry = picker.getByRole('button', { name: 'Tackle shop', exact: true });
    assert.equal(await entry.isVisible(), true, 'the outing chooser gives access to the shop');
    await press(entry);
    await press(shop.locator('[data-shop-select="stronger-line"]'));
    await stronger.waitFor({ state: 'visible' });
    assert.equal(await shop.evaluate(el => el.scrollTop), 0, 'the shop opens at the title and balance');
  }

  async function startWith(species, lure, mode = 'Campaign') {
    await page.evaluate(species => {
      const rolls = [species, .2, .5, .4, .1];
      let draw = 0;
      Math.random = () => rolls[draw++ % rolls.length];
    }, species);
    await enter(mode);
    if (mode === 'Practice') await search(page, tray, action, mobile);
    await press(tray.getByRole('group', { name: 'Lures' }).getByRole('button', { name: lure, exact: true }));
    if (mode === 'Campaign') await findFish({ species: lure === 'Spoon' ? 'muskie' : 'perch' });
    await press(action);
    if (mode === 'Campaign') await waitForBite();
    await tick(700);
    await press(action);
  }

  await openShop();
  assert.match(await balance.textContent(), /0 coins/);
  assert.match(await shop.locator('[data-shop-select="starter-line"]').textContent(), /Equipped/is);
  assert.match(await stronger.textContent(), /12 lb.*10 coins/is);
  assert.equal(await buy.isDisabled(), true, 'a new profile cannot spend coins it has yet to earn');
  await press(shop.getByRole('button', { name: 'Back to outings' }));
  await press(picker.getByRole('button', { name: 'Back to the site' }));

  await startWith(.05, 'Jig');
  await reelToHole();
  await press(action);
  await textVisible(tray, /Yellow perch.*\+10 coins/i);
  const popup = page.locator('.fishing-catch-popup');
  await popup.locator('.fishing-reward-art svg').waitFor();
  assert.match(await popup.textContent(), /Yellow perch.*10 coins/s, 'show the fish with its saved payout');
  assert.equal(await button('Loosen').isHidden(), true, 'a landed catch leaves the outcome action in Bryan’s bubble');
  assert.match(await wallet.textContent(), /10 coins/);
  assert.equal(await phase.count(), 1, 'the Campaign tray names the current light phase');
  assert.equal(await phase.textContent(), 'Day');
  await capture('catch');
  await closeSavedCatch();
  await tick(30000);
  await phase.filter({ hasText: 'Dusk' }).waitFor();
  await leave();

  await startWith(.98, 'Spoon');
  assert.equal(await phase.textContent(), 'Dusk');
  assert.equal(await meter.evaluate(el => el.max), 8);
  await tick(800);
  assert.equal(await meter.evaluate(el => el.value), 6.7);
  await press(action);
  assert.match(await status.textContent(), /line snapped.*9\.7 lb.*8 lb/i);
  assert.match(await wallet.textContent(), /10 coins/, 'a snap pays no coins');
  await capture('snap');
  await leave();

  await openShop();
  await press(buy);
  await textVisible(stronger, /^Owned$/i);
  assert.match(await balance.textContent(), /0 coins/);
  await press(equip(stronger));
  await textVisible(stronger, /^Equipped for next outing$/i);
  await press(shop.locator('[data-shop-category="line"]'));
  await press(shop.locator('[data-shop-select="starter-line"]'));
  await press(equip(starter));
  await textVisible(starter, /^Equipped for next outing$/i);
  await press(shop.locator('[data-shop-category="line"]'));
  await press(shop.locator('[data-shop-select="stronger-line"]'));
  await press(equip(stronger));
  await textVisible(stronger, /^Equipped for next outing$/i);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await openShop();
  assert.match(await balance.textContent(), /0 coins/);
  assert.match(await stronger.textContent(), /Equipped/i);
  assert.equal(await buy.count(), 0, 'reloading does not make an owned line buyable again');
  await capture('shop');
  await press(shop.getByRole('button', { name: 'Back to outings' }));
  await press(picker.getByRole('button', { name: 'Back to the site' }));

  await startWith(.98, 'Spoon');
  assert.equal(await phase.textContent(), 'Dusk', 'reload preserves the light phase for the matched surge');
  assert.equal(await meter.evaluate(el => el.max), 12);
  await tick(800);
  assert.equal(await meter.evaluate(el => el.value), 6.7);
  await press(action);
  assert.match(await status.textContent(), /line’s tight.*loosen/i);
  assert.equal(await meter.evaluate(el => el.value), 9.7, 'the same surge holds on 12 lb line');
  assert.match(await wallet.textContent(), /0 coins/);
  await capture('held');
  await leave();
  const savedProfile = () => page.evaluate(async () => {
    const { loadProfile } = await import('./game/profile.mjs?v=16');
    return loadProfile();
  });
  const beforePractice = await savedProfile();
  await startWith(.05, 'Jig', 'Practice');
  assert.equal(await meter.evaluate(el => el.max), 8, 'Practice uses starter line even with 12 lb line equipped');
  assert.equal(await wallet.isHidden(), true, 'the campaign wallet stays outside Practice');
  await reelToHole();
  await press(action);
  await textVisible(tray, /Yellow perch.*\+10 points/i);
  await textVisible(tray, /10 \/ 20 XP/);
  await leave();
  const afterPractice = await savedProfile();
  for (const field of ['coins', 'owned', 'equipped', 'elapsedMs', 'awards']) {
    assert.deepEqual(afterPractice[field], beforePractice[field], `Practice preserves Campaign ${field}`);
  }
  assert.ok(afterPractice.caughtSpecies.includes('perch'), 'Practice keeps the landed species in Your Lake');
  assert.deepEqual(errors, []);
  await page.close();
}

await withBrowser(async browser => {
  for (const mobile of [false, true]) {
    await checkShop(browser, mobile);
    console.log(`PASS: Campaign catch, shop, reload and matched dusk surge (${mobile ? '320 px touch' : 'desktop keyboard'})`);
  }
});
