import assert from 'node:assert/strict';
import { practicePage, withBrowser } from './browser-qa.mjs';

async function checkShop(browser, mobile) {
  const { page, launch, tray, action, status, button, enter, press, tick, findFish, errors } =
    await practicePage(browser, { mobile });
  const picker = page.getByRole('dialog', { name: 'Choose an outing' });
  const shop = page.getByRole('dialog', { name: 'Tackle shop' });
  const stronger = shop.locator('[data-item="stronger-line"]');
  const starter = shop.locator('[data-item="starter-line"]');
  const buy = stronger.getByRole('button', { name: 'Buy Stronger line' });
  const equip = item => item.getByRole('button', { name: /^Equip / });
  const balance = shop.locator('[data-shop-balance]');
  const meter = tray.getByRole('meter');
  const wallet = tray.locator('[data-wallet]');

  async function textVisible(container, pattern) {
    await container.getByText(pattern).waitFor({ state: 'visible' });
  }

  async function openShop() {
    await press(launch, 'Enter');
    const entry = picker.getByRole('button', { name: 'Tackle shop', exact: true });
    assert.equal(await entry.isVisible(), true, 'the outing chooser gives access to the shop');
    await press(entry);
    await stronger.waitFor({ state: 'visible' });
    assert.equal(await shop.evaluate(el => el.scrollTop), 0, 'the shop opens at the title and balance');
  }

  async function startWith(species, lure) {
    await page.evaluate(species => {
      const rolls = [species, .2, .5, .4, .1];
      let draw = 0;
      Math.random = () => rolls[draw++ % rolls.length];
    }, species);
    await enter('Campaign');
    await findFish();
    await press(tray.getByRole('group', { name: 'Lures' }).getByRole('button', { name: lure, exact: true }));
    await press(action);
    await tick(700);
    await press(action);
  }

  await openShop();
  assert.match(await balance.textContent(), /0 coins/);
  assert.match(await starter.textContent(), /8 lb.*equipped/is);
  assert.match(await stronger.textContent(), /12 lb.*10 coins/is);
  assert.equal(await buy.isDisabled(), true, 'a new profile cannot spend coins it has yet to earn');
  await press(shop.getByRole('button', { name: 'Back to outings' }));
  await press(picker.getByRole('button', { name: 'Back to the site' }));

  await startWith(.05, 'Jig');
  await textVisible(tray, /Yellow perch.*\+10 coins/i);
  assert.match(await wallet.textContent(), /10 coins/);
  await press(button('Exit fishing'));

  await startWith(.98, 'Spoon');
  assert.equal(await meter.evaluate(el => el.max), 8);
  await tick(800);
  await press(action);
  assert.match(await status.textContent(), /line snapped.*9\.7 lb.*8 lb/i);
  assert.match(await wallet.textContent(), /10 coins/, 'a snap pays no coins');
  await press(button('Exit fishing'));

  await openShop();
  await press(buy);
  await textVisible(stronger, /^Owned$/i);
  assert.match(await balance.textContent(), /0 coins/);
  await press(equip(stronger));
  await textVisible(stronger, /^Equipped$/i);
  await press(equip(starter));
  await textVisible(starter, /^Equipped$/i);
  await press(equip(stronger));
  await textVisible(stronger, /^Equipped$/i);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await openShop();
  assert.match(await balance.textContent(), /0 coins/);
  assert.match(await stronger.textContent(), /Equipped/i);
  assert.equal(await buy.count(), 0, 'reloading does not make an owned line buyable again');
  await press(shop.getByRole('button', { name: 'Back to outings' }));
  await press(picker.getByRole('button', { name: 'Back to the site' }));

  await startWith(.98, 'Spoon');
  assert.equal(await meter.evaluate(el => el.max), 12);
  await tick(800);
  await press(action);
  assert.match(await status.textContent(), /line tight.*loosen/i);
  assert.equal(await meter.evaluate(el => el.value), 9.7, 'the same surge holds on 12 lb line');
  assert.match(await wallet.textContent(), /0 coins/);
  await press(button('Exit fishing'));
  await enter('Practice');
  assert.equal(await wallet.isHidden(), true, 'the campaign wallet stays outside Practice');
  assert.deepEqual(errors, []);
  await page.close();
}

await withBrowser(async browser => {
  for (const mobile of [false, true]) {
    await checkShop(browser, mobile);
    console.log(`PASS: Campaign catch, shop, reload and matched surge (${mobile ? '320 px touch' : 'desktop keyboard'})`);
  }
});
