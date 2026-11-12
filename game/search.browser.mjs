import assert from 'node:assert/strict';
import { practicePage, withBrowser } from './browser-qa.mjs';

const scrollY = page => page.evaluate(() => window.scrollY);

async function search(action, step) {
  for (let i = 0; i < 12; i++) {
    await step();
    if (await action.isEnabled()) return;
  }
  assert.fail('Manual scrolling should bring the fish into view.');
}

async function checkDesktop(browser) {
  const { chooseMode, startGame, page, tray, action, launch, status, press, tick, errors, reelToHole } = await practicePage(browser);
  const fish = page.locator('.fishing-target');
  const line = page.locator('.fishing-line');
  await launch.focus();
  await page.evaluate(() => window.scrollTo({ top: 120, behavior: 'instant' }));
  const saved = await scrollY(page);
  assert.ok(saved > 0);
  await page.keyboard.press('Enter');
  await startGame();
  await chooseMode();
  assert.equal(await scrollY(page), 0, 'start at the ice hole');
  assert.equal(await action.isDisabled(), true, 'the first fish requires a search');
  assert.match(await status.textContent(), /scroll.*find the fish/i);
  assert.equal(await line.isVisible(), true, 'the lure follows the view while the fish is out of sight');

  await fish.evaluate((el, trayTop) => {
    const box = el.getBoundingClientRect();
    window.scrollBy({ top: box.top + box.height / 2 - trayTop - 12, behavior: 'instant' });
  }, (await tray.boundingBox()).y);
  const covered = await fish.boundingBox();
  assert.ok(covered.y + covered.height / 2 > (await tray.boundingBox()).y);
  assert.ok(covered.y + covered.height / 2 < 720, 'the fish is behind the tray, inside the browser');
  assert.equal(await action.isDisabled(), true, 'water behind the tray does not count');
  await action.evaluate(el => el.click());
  assert.match(await status.textContent(), /scroll.*find the fish/i);

  await page.mouse.move(600, 300);
  const wheel = async () => {
    const start = await scrollY(page);
    await page.mouse.wheel(0, 300);
    await page.waitForFunction(y => window.scrollY > y, start, { polling: 25 });
  };
  const land = async () => {
    await press(action, 'Enter');
    await tick(600);
    await press(action, 'Enter');
    await reelToHole();
    await press(action, 'Enter');
    await action.filter({ hasText: /^Next fish$/ }).waitFor();
    assert.match(await status.textContent(), /\+\d+ points/);
    assert.equal(await scrollY(page), 0, 'reeling and landing return the view to the ice hole');
  };
  const next = async () => {
    const start = await scrollY(page);
    await press(action, 'Enter');
    await tick(300);
    assert.equal(await scrollY(page), start, 'Next fish preserves the scroll position');
    assert.equal(await action.isDisabled(), true);
    assert.equal(await line.isVisible(), true);
    assert.match(await status.textContent(), /scroll.*find the fish/i);
    return start;
  };
  await search(action, wheel);
  assert.equal(await line.isVisible(), true);
  await land();
  const first = await next();
  await search(action, wheel);
  assert.ok(await scrollY(page) > first, 'find the second fish deeper in the lake');
  await land();
  await next();
  for (let step = 0; step < 12 && (await fish.boundingBox()).y >= 0; step++) await wheel();
  const below = await scrollY(page);
  assert.ok((await fish.boundingBox()).y < 0, 'scroll past the third fish before searching upward');
  assert.equal(await action.isDisabled(), true);
  await search(action, async () => {
    const start = await scrollY(page);
    await page.keyboard.press('PageUp');
    await page.waitForFunction(y => window.scrollY < y, start, { polling: 25 });
  });
  assert.ok(await scrollY(page) < below, 'find the third fish by scrolling back up');
  await page.keyboard.press('Escape');
  await press(page.locator('.fishing-pause').getByRole('button', { name: 'Leave outing', exact: true }));
  await page.waitForTimeout(400); // Let any native PageUp animation finish.
  assert.equal(await scrollY(page), saved, 'exit restores the site scroll position');
  assert.equal(await launch.evaluate(el => el === document.activeElement), true);
  assert.equal(await tray.isHidden(), true);

  const guide = page.getByRole('button', { name: 'Fishing with Bryan, Your Lake' });
  await guide.click();
  const perch = page.getByRole('button', { name: 'Yellow perch' }).first();
  await press(perch, 'Enter');
  const card = page.getByRole('dialog');
  assert.equal(await card.getByRole('heading', { name: 'Yellow perch' }).isVisible(), true);
  assert.match(await card.textContent(), /Try Jig|Learn this tip|Tip learned/);
  assert.deepEqual(errors, []);
  await page.close();
}

async function checkTouch(browser) {
  const { enter, page, action, status, press, errors } = await practicePage(browser, { mobile: true });
  await enter();
  assert.equal(await action.isDisabled(), true, 'the first fish requires a search');
  const touch = await page.context().newCDPSession(page);
  await search(action, async () => {
    const start = await scrollY(page);
    const send = (type, y) => touch.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: y === undefined ? [] : [{ x: 160, y }],
    });
    await send('touchStart', 440);
    for (const y of [380, 320, 260, 200, 140]) await send('touchMove', y);
    await page.waitForTimeout(160); // Release a stationary finger to avoid a kinetic scroll.
    await send('touchEnd');
    await page.waitForFunction(y => window.scrollY > y, start, { polling: 25 });
  });
  assert.ok(await scrollY(page) > 0);
  await press(action);
  assert.match(await status.textContent(), /wait for gold/i);
  assert.deepEqual(errors, []);
  await page.close();
}

async function checkRetreatVisibility(browser) {
  const { enter, page, tray, action, button, press, tick, errors } = await practicePage(browser);
  const fish = page.locator('.fishing-target');
  await page.evaluate(() => {
    const seed = [.05, .2, .01, .4, .1];
    let draw = 0;
    Math.random = () => seed[draw++ % seed.length];
  });

  await enter();
  const trayTop = (await tray.boundingBox()).y;
  await fish.evaluate((el, top) => {
    const box = el.getBoundingClientRect();
    window.scrollBy({ top: box.top + box.height / 2 - top + 4, behavior: 'instant' });
  }, trayTop);
  await page.waitForFunction(() => document.querySelector('.fishing-action').ariaDisabled !== 'true',
    null, { polling: 25 });
  assert.equal(await action.isEnabled(), true);

  await press(button('Spoon'));
  await press(action, 'Enter');
  await page.waitForTimeout(420);
  await tick(40);
  assert.equal(await action.isDisabled(), true, 'a fish that backs below the tray cannot be jigged');

  await page.evaluate(() => window.scrollBy({ top: 90, behavior: 'instant' }));
  await page.waitForFunction(() => document.querySelector('.fishing-action').ariaDisabled !== 'true',
    null, { polling: 25 });
  assert.equal(await action.isEnabled(), true, 'Jig becomes available when the fish comes back into view');
  assert.deepEqual(errors, []);
  await page.close();
}

const checks = [
  ['wheel down, keyboard back up, and Your Lake', checkDesktop],
  ['320px touch search', checkTouch],
  ['fish visibility updates after it backs away', checkRetreatVisibility],
];
await withBrowser(async browser => {
  const results = await Promise.allSettled(checks.map(([, check]) => check(browser)));
  for (const [i, result] of results.entries()) {
    if (result.status === 'fulfilled') console.log(`PASS: ${checks[i][0]}`);
    else console.error(`FAIL: ${checks[i][0]}`, result.reason);
  }
  if (results.some(result => result.status === 'rejected')) process.exitCode = 1;
});
