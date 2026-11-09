import assert from 'node:assert/strict';
import { practicePage, withBrowser } from './browser-qa.mjs';
import lakeMap from './lake-map-data.mjs';

const shoreId = lakeMap.cells.find(cell => cell.area === 'starter-shore').id;
const reefId = lakeMap.cells.find(cell => cell.area === 'deep-reef').id;

async function checkAccess(browser, mobile) {
  const qa = await practicePage(browser, { mobile, campaignLiveButtons: true });
  const { leave, page, launch, tray, action, status, enter, press, tick, findFish, waitForBite, errors, reelToHole } = qa;
  const picker = page.getByRole('dialog', { name: 'Choose an outing' });
  const map = page.getByRole('dialog', { name: 'Campaign · Mille Lacs' });
  const cell = id => map.locator(`[data-map-cell="${id}"]`);
  const shop = page.getByRole('dialog', { name: 'Tackle shop' });
  const guide = page.locator('.fishing-permit');
  const reef = picker.getByRole('button', { name: 'Deep Reef', exact: true });
  const license = shop.locator('[data-item="deep-reef-license"]');
  const starter = shop.locator('[data-item="starter-license"]');
  const buy = license.getByRole('button', { name: 'Buy Deep Reef permit' });
  const back = shop.getByRole('button', { name: /^(?:Back|Back to (?:outings|areas))$/ });
  const score = tray.locator('[data-score]');
  const wallet = tray.locator('[data-wallet]');

  const seed = (...species) => page.evaluate(speciesRolls => {
    const rolls = speciesRolls.flatMap(roll => [roll, .2, .5, .4, .1]);
    let draw = 0;
    Math.random = () => rolls[draw++ % rolls.length];
  }, species);
  const openPicker = () => press(launch, 'Enter');
  const openSelectedHole = async (area, id) => {
    await press(area);
    await map.waitFor();
    assert.equal(await cell(id).getAttribute('aria-pressed'), 'true');
    await press(map.locator('[data-map-drill]'));
  };
  const waitPermit = async (area, message) => {
    // A closed dialog keeps its previous enabled button during the next saved-profile read.
    const current = page.getByRole('dialog', { name: `${area} permit`, exact: true });
    await current.waitFor();
    await current.locator('[data-permit-message]').filter({ hasText: message }).waitFor();
    await current.locator('[data-permit-shop]:enabled').waitFor();
  };
  const waitWallet = amount => wallet.filter({ hasText: new RegExp(`^${amount} coins$`) }).waitFor();
  const attemptPurchase = revision => page.evaluate(async savedRevision => {
    const { loadProfile, applyProfile } = await import(new URL('./game/profile.mjs', location.href));
    const current = await loadProfile();
    const { status, profile } = await applyProfile({
      type: 'buy', id: 'deep-reef-license', revision: savedRevision ?? current.revision,
    });
    return { status, coins: profile.coins, ownsLicense: profile.owned.includes('deep-reef-license'), revision: profile.revision };
  }, revision);
  const land = async (species, fish, balance) => {
    await findFish({ species });
    await press(action);
    await waitForBite();
    await tick(700);
    await press(action);
    await reelToHole();
    await press(action);
    await waitWallet(balance);
    assert.match(await status.textContent(), fish);
    await qa.closeSavedCatch();
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
  await openSelectedHole(reef, reefId);
  await waitPermit('Deep Reef', /^Deep Reef needs the Deep Reef permit.*25 coins.*0 coins.*25 coins more/);
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
  await qa.closeDialog(shop, back);
  await map.waitFor();
  assert.equal(await expectFocused(cell(reefId)), true, 'cancel restores the intended hole focus');
  assert.equal(await tray.isHidden(), true);

  // Free starter claim is explicit and also returns to its area without auto-start.
  await press(cell(shoreId));
  await press(map.locator('[data-map-drill]'));
  await waitPermit('Starter Shore', /^Starter Shore needs the Starter Shore permit.*free.*0 coins/);
  assert.match(await guide.textContent(), /Starter Shore.*free.*0 coins/is);
  await press(guide.getByRole('button', { name: 'Back to areas' }));
  await map.waitFor();
  assert.equal(await expectFocused(cell(shoreId)), true);
  await press(map.locator('[data-map-drill]'));
  await waitPermit('Starter Shore', /^Starter Shore needs the Starter Shore permit.*free.*0 coins/);
  await press(guide.getByRole('button', { name: 'Get this permit' }));
  await targetVisibleAndFocused(starter);
  await press(starter.getByRole('button', { name: /(?:Buy|Claim) Starter Shore permit/ }));
  await starter.getByText('Owned', { exact: true }).waitFor();
  assert.match(await shop.locator('[data-shop-balance]').textContent(), /0 coins/);
  await qa.closeDialog(shop, back);
  await map.waitFor();
  assert.equal(await expectFocused(cell(shoreId)), true);
  assert.equal(await tray.isHidden(), true, 'claiming a permit lets the player choose when to fish');
  await press(map.locator('[data-map-back]'));
  await press(picker.getByRole('button', { name: 'Back to the site' }));

  // The three shore slots add a different roll offset. These rolls keep each on perch.
  await seed(.05, .72, .39);
  await enter('Campaign');
  await waitWallet(0);
  assert.match(await score.textContent(), new RegExp(`Mille Lacs.*${shoreId}`));
  if (mobile) {
    const waterBounds = await tray.locator('[data-water]').boundingBox();
    const scoreBounds = await score.boundingBox();
    const menuBounds = await tray.locator('[data-exit]').boundingBox();
    assert.ok(waterBounds.height < 37, 'the hole and depth fit the 320 px header in two lines');
    assert.ok(scoreBounds.x + scoreBounds.width <= menuBounds.x, 'the score and progress fit beside Menu');
  }
  for (const balance of [10, 15, 20]) {
    await land('perch', /Yellow perch/i, balance);
    if (balance === 15) assert.match(await status.textContent(), /Lake Regular.*Two Campaign catches saved/i);
    else assert.doesNotMatch(await status.textContent(), /Lake Regular/i, 'the badge is announced on the second committed catch only');
    if (balance < 20) await press(action);
  }
  await leave();
  await seed(.05, .72, .39);
  await enter('Campaign');
  await land('perch', /Yellow perch/i, 25);
  await leave();
  await openPicker();
  await openSelectedHole(reef, reefId);
  await waitPermit('Deep Reef', /^Deep Reef needs the Deep Reef permit.*25 coins.*25 coins/);
  await press(guide.getByRole('button', { name: 'Get this permit' }));
  await targetVisibleAndFocused(license);
  const stale = await attemptPurchase(broke.revision);
  assert.equal(stale.status, 'stale');
  assert.equal(stale.coins, 25);
  assert.equal(stale.ownsLicense, false);
  assert.equal(await starter.count(), 0, 'the free Starter Shore permit is not the selected purchase');
  await press(buy);
  await license.getByText('Owned', { exact: true }).waitFor();
  assert.match(await shop.locator('[data-shop-balance]').textContent(), /0 coins/);
  const duplicate = await attemptPurchase();
  assert.equal(duplicate.status, 'already-owned');
  assert.equal(duplicate.coins, 0);
  assert.equal(duplicate.ownsLicense, true);
  await qa.closeDialog(shop, back);
  await map.waitFor();
  assert.equal(await expectFocused(cell(reefId)), true, 'paid claim returns to the intended hole');
  assert.equal(await tray.isHidden(), true);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await seed(.2);
  await enter('Deep Reef');
  await waitWallet(0);
  assert.match(await score.textContent(), new RegExp(`Mille Lacs.*${reefId}`));
  await land('rock-bass', /Rock bass/i, 7);
  assert.doesNotMatch(await status.textContent(), /Lake Regular/i, 'reload and further catches do not repeat the badge');
  await leave();

  await seed(.2);
  await enter('Campaign');
  await waitWallet(7);
  assert.match(await score.textContent(), new RegExp(`Mille Lacs.*${shoreId}`));
  await land('perch', /Yellow perch/i, 12);
  assert.deepEqual(errors, []);
  await page.close();
}

await withBrowser(async browser => {
  for (const mobile of [false, true]) {
    await checkAccess(browser, mobile);
    console.log(`PASS: exact permit claim, safe return, paid access and Campaign milestone (${mobile ? '320 px touch' : 'desktop keyboard'})`);
  }
});
