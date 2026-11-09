import assert from 'node:assert/strict';
import { practicePage, withBrowser } from './browser-qa.mjs';

async function checkAccess(browser, mobile) {
  const { page, launch, tray, action, status, button, enter, press, tick, findFish, errors } =
    await practicePage(browser, { mobile });
  const picker = page.getByRole('dialog', { name: 'Choose an outing' });
  const shop = page.getByRole('dialog', { name: 'Tackle shop' });
  const reef = picker.getByRole('button', { name: 'Deep Reef', exact: true });
  const license = shop.locator('[data-item="deep-reef-license"]');
  const buy = license.getByRole('button', { name: 'Buy Deep Reef license' });
  const back = shop.getByRole('button', { name: 'Back to outings' });
  const score = tray.locator('[data-score]');
  const wallet = tray.locator('[data-wallet]');

  const seed = species => page.evaluate(speciesRoll => {
    const rolls = [speciesRoll, .2, .5, .4, .1];
    let draw = 0;
    Math.random = () => rolls[draw++ % rolls.length];
  }, species);
  const openPicker = () => press(launch, 'Enter');
  const openShop = async () => {
    await press(picker.getByRole('button', { name: 'Tackle shop' }));
    await license.waitFor();
  };
  const waitWallet = amount => wallet.filter({ hasText: new RegExp(`^${amount} coins$`) }).waitFor();
  const waitForReef = () => page.waitForFunction(
    () => document.querySelector('[data-area="deep-reef"]').getAttribute('aria-disabled') !== 'true',
    null, { polling: 25 },
  );
  const attemptPurchase = revision => page.evaluate(async savedRevision => {
    const { loadProfile, applyProfile } = await import(new URL('./game/profile.mjs?v=15', location.href));
    const current = await loadProfile();
    const { status, profile } = await applyProfile({
      type: 'buy', id: 'deep-reef-license', revision: savedRevision ?? current.revision,
    });
    return { status, coins: profile.coins, ownsLicense: profile.owned.includes('deep-reef-license'), revision: profile.revision };
  }, revision);
  const land = async (fish, balance) => {
    await findFish();
    await press(action);
    await tick(700);
    await press(action);
    await waitWallet(balance);
    assert.match(await status.textContent(), fish);
  };

  await openPicker();
  assert.equal(await reef.isVisible(), true, 'Deep Reef is visible before it opens');
  assert.equal(await reef.isDisabled(), true);
  assert.match(await picker.textContent(), /requires.*Deep Reef license.*25 coins/is);
  await reef.evaluate(control => control.click());
  assert.equal(await picker.isVisible(), true, 'the locked choice does not start an outing');
  await openShop();
  assert.match(await license.textContent(), /Opens Deep Reef.*25 coins/is);
  assert.equal(await buy.isDisabled(), true);
  const broke = await attemptPurchase();
  assert.equal(broke.status, 'unaffordable');
  assert.equal(broke.coins, 0);
  assert.equal(broke.ownsLicense, false);
  await press(back);
  await press(picker.getByRole('button', { name: 'Back to the site' }));

  await seed(.05);
  await enter('Campaign');
  await waitWallet(0);
  assert.match(await score.textContent(), /Mille Lacs.*Starter Shore/);
  if (mobile) assert.ok((await score.boundingBox()).height < 37, 'the area fits the 320 px header in two lines');
  for (const balance of [10, 20, 30]) {
    await land(/Yellow perch/i, balance);
    if (balance < 30) await press(action);
  }
  await press(button('Exit fishing'));
  await openPicker();
  await openShop();
  const funded = await attemptPurchase(broke.revision);
  assert.equal(funded.status, 'stale');
  assert.equal(funded.coins, 30);
  assert.equal(funded.ownsLicense, false);
  await press(buy);
  await license.getByText('Owned', { exact: true }).waitFor();
  assert.match(await shop.locator('[data-shop-balance]').textContent(), /5 coins/);
  const duplicate = await attemptPurchase();
  assert.equal(duplicate.status, 'already-owned');
  assert.equal(duplicate.coins, 5);
  assert.equal(duplicate.ownsLicense, true);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await seed(.2);
  await openPicker();
  await waitForReef();
  assert.equal(await reef.isDisabled(), false);
  await press(reef);
  await waitWallet(5);
  assert.match(await score.textContent(), /Mille Lacs.*Deep Reef/);
  await land(/Rock bass/i, 20);
  await press(button('Exit fishing'));

  await seed(.2);
  await enter('Campaign');
  await waitWallet(20);
  assert.match(await score.textContent(), /Mille Lacs.*Starter Shore/);
  await land(/Yellow perch/i, 30);
  assert.deepEqual(errors, []);
  await page.close();
}

await withBrowser(async browser => {
  for (const mobile of [false, true]) {
    await checkAccess(browser, mobile);
    console.log(`PASS: Reef license, shared wallet and second water (${mobile ? '320 px touch' : 'desktop keyboard'})`);
  }
});
