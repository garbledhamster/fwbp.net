import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { lineDepth, practicePage, withBrowser } from './browser-qa.mjs';

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
  const { leave, page, openGame, tray, action, button, enter, press, closeDialog, tick, findFish, waitForBite, errors, reelToHole, closeSavedCatch } =
    await practicePage(browser, { mobile, configure: async page => {
      await page.route('https://www.youtube-nocookie.com/**', route => route.abort());
      await page.route('https://www.youtube.com/iframe_api', route => route.abort());
    } });
  page.setDefaultTimeout(8000);
  const picker = page.getByRole('dialog', { name: 'Choose an outing' });
  const shop = page.getByRole('dialog', { name: 'Tackle shop' });
  const stronger = shop.locator('[data-item="stronger-line"]');
  const starter = shop.locator('[data-item="starter-line"]');
  const buy = stronger.getByRole('button', { name: 'Buy Stronger line' });
  const equip = item => item.getByRole('button', { name: /^Equip / });
  const balance = shop.locator('[data-shop-balance]');
  const practiceMeter = tray.getByRole('meter');
  const feedback = page.getByRole('meter', { name: 'Reel feedback' });
  const popup = page.locator('.fishing-catch-popup[open]');
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
    await openGame();
    const entry = picker.getByRole('button', { name: 'Tackle shop', exact: true });
    assert.equal(await entry.isVisible(), true, 'the outing chooser gives access to the shop');
    await press(entry);
    await press(shop.locator('[data-shop-select="stronger-line"]'));
    await stronger.waitFor({ state: 'visible' });
    assert.equal(await shop.evaluate(el => el.scrollTop), 0, 'the shop opens at the title and balance');
  }

  async function startWith(species, lure, mode = 'Campaign') {
    await page.evaluate(() => {
      const rolls = [.05, .2, .5, .4, .1];
      let draw = 0;
      Math.random = () => rolls[draw++ % rolls.length];
    });
    await enter(mode);
    if (mode === 'Practice') await search(page, tray, action, mobile);
    await press(tray.getByRole('group', { name: 'Lures' }).getByRole('button', { name: lure, exact: true }));
    if (mode === 'Practice') {
      await press(action);
      await tick(700);
      await press(action);
      return;
    }
    await findFish({ species });
    const tap = async () => {
      const y = (await tray.boundingBox()).y * .42;
      if (mobile) await page.touchscreen.tap(32, y);
      else await page.mouse.click(32, y);
    };
    await tap();
    await waitForBite();
    await tick(700);
    await tap();
    await feedback.waitFor();
  }

  async function idleDive() {
    // Allow the render frame after the 200 ms simulation sample to paint.
    const initialDepth = await lineDepth(page);
    await tick(216);
    return (await lineDepth(page)) - initialDepth;
  }

  await openShop();
  assert.match(await balance.textContent(), /0 coins/);
  assert.match(await shop.locator('[data-shop-select="starter-line"]').textContent(), /Equipped/is);
  assert.match(await stronger.textContent(), /12 lb line.*fish take less line.*10 coins/is);
  assert.equal(await buy.isDisabled(), true, 'a new profile cannot spend coins it has yet to earn');
  await press(shop.getByRole('button', { name: 'Back to outings' }));
  await press(picker.getByRole('button', { name: 'Back to the site' }));

  await startWith('perch', 'Jig');
  await reelToHole();
  await popup.locator('.fishing-reward-art svg').waitFor();
  assert.equal(await popup.locator('h2').textContent(), 'Yellow perch');
  const credit = await popup.locator('.fishing-catch-credit').textContent();
  assert.match(credit, /\+10 XP.*coins to collect/);
  const reward = Number(credit.match(/(\d+) coins to collect/)[1]);
  assert.equal(await button('Loosen').isHidden(), true, 'reeling only needs taps in Campaign');
  assert.equal(await wallet.textContent(), '0 coins', 'catch coins wait for an explicit claim');
  assert.equal(await phase.count(), 1, 'the Campaign tray names the current light phase');
  assert.equal(await phase.textContent(), 'Day');
  await capture('catch');

  await press(popup.getByRole('button', { name: 'My Lake', exact: true }));
  const lake = page.getByRole('dialog', { name: 'My Lake', exact: true });
  await press(lake.getByRole('button', { name: 'Collect Reward', exact: true }));
  await wallet.filter({ hasText: `${reward} coins` }).waitFor({ state: 'attached' });
  await closeDialog(lake, lake.locator('[data-close]'));
  await closeSavedCatch();
  await tick(30000);
  await phase.filter({ hasText: 'Dusk' }).waitFor();
  await leave();

  // Reopen the same hole and let the same unlanded pike run on each setup.
  await startWith('pike', 'Spoon');
  assert.equal(await phase.textContent(), 'Dusk');
  const starterDive = await idleDive();
  assert.ok(starterDive > 10, 'a fish takes line as soon as the angler stops tapping');
  assert.equal(await wallet.textContent(), `${reward} coins`);
  await capture('starter-dive');
  await leave();

  await openShop();
  await press(buy);
  await textVisible(stronger, /^Owned$/i);
  assert.equal(await balance.textContent(), `${reward - 10} coins`);
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
  assert.equal(await balance.textContent(), `${reward - 10} coins`);
  assert.match(await stronger.textContent(), /Equipped/i);
  assert.equal(await buy.count(), 0, 'reloading does not make an owned line buyable again');
  await capture('shop');
  await press(shop.getByRole('button', { name: 'Back to outings' }));
  await press(picker.getByRole('button', { name: 'Back to the site' }));

  await startWith('pike', 'Spoon');
  assert.equal(await phase.textContent(), 'Dusk', 'reload preserves the light phase for the matched surge');
  const strongerDive = await idleDive();
  assert.ok(strongerDive > 0 && strongerDive < starterDive,
    `the same run takes less line on the 12 lb setup (${strongerDive} vs ${starterDive})`);
  assert.equal(await wallet.textContent(), `${reward - 10} coins`);
  await capture('stronger-dive');
  await reelToHole();
  await popup.locator('.fishing-catch-stats').getByText('Stronger line', { exact: true }).waitFor();
  assert.equal(await wallet.textContent(), `${reward - 10} coins`, 'the second catch also waits for a claim');
  await leave();
  const savedProfile = () => page.evaluate(async () => {
    const { loadProfile } = await import('./game/profile.mjs?v=16');
    return loadProfile();
  });
  const beforePractice = await savedProfile();
  await startWith('perch', 'Jig', 'Practice');
  assert.equal(await practiceMeter.evaluate(el => el.max), 8, 'Practice uses starter line even with 12 lb line equipped');
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
  assert.ok(afterPractice.caughtSpecies.includes('perch'), 'Practice keeps the landed species in My Lake');
  assert.deepEqual(errors, []);
  await page.close();
}

await withBrowser(async browser => {
  for (const mobile of [false, true]) {
    await checkShop(browser, mobile);
    console.log(`PASS: Campaign catch, shop, reload and matched dusk run (${mobile ? '320 px touch' : 'desktop keyboard'})`);
  }
});
