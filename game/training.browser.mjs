import assert from 'node:assert/strict';
import { practicePage, withBrowser } from './browser-qa.mjs';

async function checkTraining(browser, mobile) {
  const { leave, enter, page, tray, press, tick, findFish, waitForBite, openGame, selectTackle, status, errors } =
    await practicePage(browser, { mobile });
  const picker = page.getByRole('dialog', { name: 'Choose an outing' });
  const shop = page.getByRole('dialog', { name: 'Tackle shop' });
  const hook = shop.locator('[data-item="finesse-hook"]');
  const training = shop.locator('[data-item="line-control"]');
  const balance = shop.locator('[data-shop-balance]');
  const buyHook = hook.getByRole('button', { name: 'Buy Fine-wire jig setup' });
  const buyTraining = training.getByRole('button', { name: 'Buy Line Control' });

  async function select(control) {
    await control.scrollIntoViewIfNeeded();
    await press(control, 'Enter');
  }

  async function openShop() {
    await openGame();
    await select(picker.getByRole('button', { name: 'Tackle shop' }));
    await shop.locator('[data-shop-grid]').waitFor();
  }

  async function closeShop() {
    await select(shop.getByRole('button', { name: 'Back to outings' }));
    await select(picker.getByRole('button', { name: 'Back to the site' }));
  }

  async function tryBite(lure, delay, canHook) {
    await page.evaluate(() => {
      const rolls = [.05, .2, .5, .4, .1];
      let draw = 0;
      Math.random = () => rolls[draw++ % rolls.length];
    });
    await enter('Campaign', 'A2');
    await select(tray.getByRole('group', { name: 'Lures' }).getByRole('button', { name: lure, exact: true }));
    await findFish({ species: lure === 'Jig' ? 'perch' : 'walleye' });
    const tap = () => mobile ? page.touchscreen.tap(38, 114) : page.mouse.click(38, 114);
    await tap();
    await waitForBite();
    await tick(delay);
    const meter = page.getByRole('meter', { name: 'Reel feedback' });
    if (canHook) {
      await tap();
      await meter.waitFor();
    } else {
      assert.match(await status.textContent(), /slipped the hook/i);
      assert.equal(await meter.isVisible(), false);
    }
    await leave();
  }

  await openShop();
  await selectTackle('finesse-hook');
  assert.match(await hook.textContent(), /200 ms.*Jig.*15 coins/is);
  assert.equal(await buyHook.isDisabled(), true);
  await selectTackle('line-control');
  assert.match(await training.textContent(), /350 ms.*any lure.*20 coins/is);
  assert.equal(await buyTraining.isDisabled(), true);
  await closeShop();

  const funded = await page.evaluate(async () => {
    const { applyProfile, loadProfile } = await import(new URL('./game/profile.mjs', location.href));
    const starter = await loadProfile();
    for (const [id, expected] of [['finesse-hook', 'locked'], ['line-control', 'unaffordable']]) {
      const refused = await applyProfile({ type: 'buy', id, revision: starter.revision });
      if (refused.status !== expected || refused.profile.coins !== 0) throw Error('A refused purchase altered the wallet');
    }
    return applyProfile({ type: 'award', key: 'training-fixture:0', outcome: 'landed', catch: { points: 45 } });
  });
  assert.equal(funded.profile.coins, 45);

  await tryBite('Jig', 3100, false);
  await openShop();
  await selectTackle('finesse-hook');
  await select(buyHook);
  await hook.getByText('Owned', { exact: true }).waitFor();
  await select(hook.getByRole('button', { name: 'Equip Fine-wire jig setup' }));
  await hook.getByText('Equipped for next outing', { exact: true }).waitFor();
  assert.equal(await balance.textContent(), '30 coins');
  await closeShop();

  await tryBite('Jig', 3100, true);
  await tryBite('Minnow', 3000, false);
  await tryBite('Jig', 3310, false);

  await openShop();
  await selectTackle('line-control');
  await select(buyTraining);
  await training.getByText('Owned', { exact: true }).waitFor();
  assert.equal(await balance.textContent(), '10 coins');

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await openShop();
  assert.equal(await balance.textContent(), '10 coins');
  await selectTackle('finesse-hook');
  await hook.getByText('Equipped for next outing', { exact: true }).waitFor();
  assert.equal(await buyHook.count(), 0);
  await selectTackle('line-control');
  await training.getByText('Owned', { exact: true }).waitFor();
  assert.equal(await buyTraining.count(), 0);
  const repeated = await page.evaluate(async () => {
    const { applyProfile, loadProfile } = await import(new URL('./game/profile.mjs', location.href));
    const profile = await loadProfile();
    return Promise.all(['finesse-hook', 'line-control'].map(id =>
      applyProfile({ type: 'buy', id, revision: profile.revision })));
  });
  assert.deepEqual(repeated.map(result => [result.status, result.profile.coins]), [
    ['already-owned', 10], ['already-owned', 10],
  ]);
  await closeShop();
  await tryBite('Jig', 3310, true);
  await tryBite('Minnow', 3050, true);
  assert.deepEqual(errors, []);
  await page.close();
}

await withBrowser(async browser => {
  for (const mobile of [false, true]) {
    await checkTraining(browser, mobile);
    console.log(`PASS: persistent hook and paid hook-timing effects (${mobile ? '320 px touch' : 'desktop keyboard'})`);
  }
});
