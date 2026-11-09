import assert from 'node:assert/strict';
import { practicePage, withBrowser } from './browser-qa.mjs';

async function checkAccess(browser, mobile) {
  const { page, launch, tray, action, status, button, enter, press, tick, findFish, errors, reelToHole } =
    await practicePage(browser, { mobile });
  const picker = page.getByRole('dialog', { name: 'Choose an outing' });
  const shop = page.getByRole('dialog', { name: 'Tackle shop' });
  const guide = page.locator('.fishing-permit');
  const shore = picker.locator(`[data-area="starter-shore"]`);
  const reef = picker.getByRole('button', { name: 'Deep Reef', exact: true });
  const license = shop.locator('[data-item="deep-reef-license"]');
  const starter = shop.locator('[data-item="starter-license"]');
  const buy = license.getByRole('button', { name: 'Buy Deep Reef permit' });
  const back = shop.getByRole('button', { name: /Back to (outings|areas)/ });
  const score = tray.locator('[data-score]');
  const wallet = tray.locator('[data-wallet]');

  const seed = species => page.evaluate(speciesRoll => {
    const rolls = [speciesRoll, .2, .5, .4, .1];
    let draw = 0;
    Math.random = () => rolls[draw++ % rolls.length];
  }, species);
  const openPicker = () => press(launch, 'Enter');
  const waitWallet = amount => wallet.filter({ hasText: new RegExp(`^${amount} coins$`) }).waitFor();
  const attemptPurchase = revision => page.evaluate(async savedRevision => {
    const { loadProfile, applyProfile } = await import(new URL('./game/profile.mjs?v=16', location.href));
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
    await reelToHole();
    await press(action);
    await waitWallet(balance);
    assert.match(await status.textContent(), fish);
  };
  const expectFocused = locator => locator.evaluate(el => el === document.activeElement);
  const targetVisibleAndFocused = async item => {
    await item.waitFor();
    await page.waitForFunction(id => {
      const item = document.querySelector(`[data-item="${id}"]`);
      return item?.contains(document.activeElement);
    }, await item.getAttribute('data-item'), { polling: 25 });
    const box = await item.boundingBox();
    assert.ok(box && box.y >= 0 && box.y < (await page.viewportSize()).height, 'the exact permit scrolls into view');
  };

  await openPicker();
  assert.equal(await reef.isEnabled(), true, 'a blocked area remains actionable for guidance');
  await press(reef);
  await guide.getByRole('button', { name: 'Get this permit' }).waitFor();
  await page.waitForFunction(() => !document.querySelector('[data-permit-shop]').disabled);
  assert.match(await guide.textContent(), /Deep Reef needs the Deep Reef permit.*25 coins.*0 coins.*25 coins more/is);
  assert.equal(await tray.isHidden(), true, 'blocked entry never starts an outing');
  assert.equal(await guide.locator('img').getAttribute('src'), './assets/fishing/conservation-officer.webp');
  await press(guide.getByRole('button', { name: 'Get this permit' }));
  await targetVisibleAndFocused(license);
  assert.equal(await buy.isDisabled(), true);
  const broke = await attemptPurchase();
  assert.equal(broke.status, 'unaffordable');
  assert.equal(broke.coins, 0);
  assert.equal(broke.ownsLicense, false);
  await press(back);
  await picker.waitFor();
  assert.equal(await expectFocused(reef), true, 'cancel restores the intended area focus');
  assert.equal(await tray.isHidden(), true);

  // Free starter claim is explicit and also returns to its area without auto-start.
  await press(shore);
  await page.waitForFunction(() => !document.querySelector('[data-permit-shop]').disabled);
  assert.match(await guide.textContent(), /Starter Shore.*free.*0 coins/is);
  await press(guide.getByRole('button', { name: 'Back to areas' }));
  assert.equal(await expectFocused(shore), true);
  await press(shore);
  await page.waitForFunction(() => !document.querySelector('[data-permit-shop]').disabled);
  await press(guide.getByRole('button', { name: 'Get this permit' }));
  await targetVisibleAndFocused(starter);
  await press(starter.getByRole('button', { name: /(?:Buy|Claim) Starter Shore permit/ }));
  await starter.getByText('Owned', { exact: true }).waitFor();
  assert.match(await shop.locator('[data-shop-balance]').textContent(), /0 coins/);
  await press(back);
  await picker.waitFor();
  assert.equal(await expectFocused(shore), true);
  assert.equal(await tray.isHidden(), true, 'claiming a permit lets the player choose when to fish');
  await press(picker.getByRole('button', { name: 'Back to the site' }));

  await seed(.05);
  await enter('Campaign');
  await waitWallet(0);
  assert.match(await score.textContent(), /Mille Lacs.*Starter Shore/);
  if (mobile) assert.ok((await score.boundingBox()).height < 37, 'the area fits the 320 px header in two lines');
  for (const balance of [10, 20, 30]) {
    await land(/Yellow perch/i, balance);
    if (balance === 20) assert.match(await status.textContent(), /Lake Regular.*Two Campaign catches saved/i);
    else assert.doesNotMatch(await status.textContent(), /Lake Regular/i, 'the badge is announced on the second committed catch only');
    if (balance < 30) await press(action);
  }
  await press(button('Exit fishing'));
  await openPicker();
  await press(reef);
  await page.waitForFunction(() => !document.querySelector('[data-permit-shop]').disabled);
  await press(guide.getByRole('button', { name: 'Get this permit' }));
  await targetVisibleAndFocused(license);
  const stale = await attemptPurchase(broke.revision);
  assert.equal(stale.status, 'stale');
  assert.equal(stale.coins, 30);
  assert.equal(stale.ownsLicense, false);
  await press(buy);
  await license.getByText('Owned', { exact: true }).waitFor();
  assert.match(await shop.locator('[data-shop-balance]').textContent(), /5 coins/);
  const duplicate = await attemptPurchase();
  assert.equal(duplicate.status, 'already-owned');
  assert.equal(duplicate.coins, 5);
  assert.equal(duplicate.ownsLicense, true);
  await press(back);
  await picker.waitFor();
  assert.equal(await expectFocused(reef), true, 'paid claim returns to the intended area');
  assert.equal(await tray.isHidden(), true);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await seed(.2);
  await openPicker();
  await press(reef);
  await waitWallet(5);
  assert.match(await score.textContent(), /Mille Lacs.*Deep Reef/);
  await land(/Rock bass/i, 20);
  assert.doesNotMatch(await status.textContent(), /Lake Regular/i, 'reload and further catches do not repeat the badge');
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
    console.log(`PASS: exact permit claim, safe return, paid access and Campaign milestone (${mobile ? '320 px touch' : 'desktop keyboard'})`);
  }
});
