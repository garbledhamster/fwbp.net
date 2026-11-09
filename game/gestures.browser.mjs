import assert from 'node:assert/strict';
import { practicePage, withBrowser } from './browser-qa.mjs';

const layouts = [
  { name: 'desktop click and wheel', viewport: { width: 1200, height: 720 } },
  { name: '320×720 touch', mobile: true, viewport: { width: 320, height: 720 } },
  { name: '720×320 touch', mobile: true, viewport: { width: 720, height: 320 } },
];

async function checkGestures(browser, layout) {
  const { page, tray, action, button, status, enter, findFish, waitForBite, tick, press, closeDialog, closeSavedCatch, launch, errors } =
    await practicePage(browser, layout);
  const touch = layout.mobile && await page.context().newCDPSession(page);
  // A standard muskie on starter line supplies a real surge and multiple pulls.
  await page.evaluate(() => {
    const rolls = [.98, .2, .5, .4, .1];
    let draw = 0;
    Math.random = () => rolls[draw++ % rolls.length];
  });

  const scrollY = () => page.evaluate(() => document.body.hasAttribute('data-campaign-camera')
    ? document.querySelector('.fishing-route').scrollTop : window.scrollY);
  const depth = () => page.locator('.fishing-line-path').evaluate(path => {
    const end = path.getPointAtLength(path.getTotalLength());
    return end.y - path.getPointAtLength(0).y;
  });
  const load = () => tray.locator('meter').evaluate(meter => meter.value);
  const settleInput = async () => {
    // Wheel timestamps use the Playwright clock; native touch scrolling uses real time.
    await Promise.all([tick(170), page.waitForTimeout(170)]);
  };
  const marker = page.locator('[data-line-gesture-marker]');
  const up = marker.locator('[data-line-gesture-up]');
  const down = marker.locator('[data-line-gesture-down]');
  const lureAction = marker.locator('button');
  const markerPoint = async () => {
    // Fall back to the lure's coordinates so the pre-feature failure is a missed jig.
    const box = await marker.count() ? await marker.boundingBox() : undefined;
    if (box) return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    return page.locator('.fishing-line-path').evaluate(path => {
      const point = path.getPointAtLength(path.getTotalLength()).matrixTransform(path.getScreenCTM());
      return { x: point.x + 18, y: point.y };
    });
  };
  const tapLure = async () => {
    const { x, y } = await markerPoint();
    await (touch ? page.touchscreen.tap(x, y) : page.mouse.click(x, y));
  };
  const waterPoint = async () => ({ x: 30, y: Math.max(75, (await tray.boundingBox()).y * .57) });
  const fingers = (type, points) => touch.send('Input.dispatchTouchEvent', {
    type, touchPoints: points.map(({ x, y }, id) => ({ x, y, id })),
  });
  async function gesture({ x, y }, dx, dy, { pinch = false, cancel = false, hold = false } = {}) {
    if (!touch) {
      await page.mouse.move(x, y);
      await page.mouse.wheel(dx, dy);
      // Playwright wheel returns before the browser dispatches the event.
      await page.waitForTimeout(25);
      return;
    }
    const points = offset => [
      { x: x + dx * offset, y: y + dy * offset },
      ...(pinch ? [{ x: x + 26, y: y - dy * offset }] : []),
    ];
    await fingers('touchStart', points(0));
    for (const offset of [.25, .5, .75, 1]) await fingers('touchMove', points(offset));
    if (hold) await page.waitForTimeout(160);
    await fingers(cancel ? 'touchCancel' : 'touchEnd', []);
  }

  await enter('Campaign');
  const originalScroll = await scrollY();
  // End the browse swipe with the finger held still so a native fling cannot swallow the next tap.
  await gesture(await waterPoint(), 0, touch ? -65 : 115, { hold: true });
  await settleInput();
  assert.ok(await scrollY() > originalScroll + 5, 'depth browsing works outside the lure');
  await tick(600);
  assert.equal(await action.textContent(), 'Jig');
  await findFish({ species: 'muskie' });
  await marker.waitFor();
  assert.equal(await marker.getByRole('button', { name: 'Jig lure' }).count(), 1,
    'the lure has a click and tap target while searching');
  assert.equal(await marker.evaluate(el => getComputedStyle(el).borderWidth), '0px', 'the lure has no box');
  assert.equal(await up.isVisible(), false, 'there is no callout beside the lure');
  assert.match(await status.textContent(), /click or tap the jig/i);
  if (!touch) {
    await button('Menu').focus();
    const visited = new Set();
    let reachedLure = false;
    for (let step = 0; step < 10; step++) {
      await page.keyboard.press('Tab');
      reachedLure ||= await lureAction.evaluate(el => el === document.activeElement);
      assert.equal(await action.evaluate(el => el === document.activeElement), false, 'Tab skips the live Jig action');
      const lure = await page.evaluate(() => document.activeElement.dataset.lure);
      if (lure) visited.add(lure);
    }
    assert.ok(reachedLure, 'Tab reaches the jig');
    assert.deepEqual([...visited], ['jig', 'spoon', 'minnow'], 'Tab reaches every bait slot');
  }
  await press(button('Spoon'));
  await findFish({ species: 'muskie' });
  await marker.waitFor();
  assert.equal(await button('Spoon').getAttribute('aria-pressed'), 'true', 'the bait tap selects Spoon');
  const fish = page.locator('.fishing-swimmer[data-species="muskie"]');
  const biteRipple = page.locator('.fishing-bite-ripple');
  const pause = page.getByRole('dialog', { name: 'Paused' });
  const beforeScroll = await scrollY();
  await gesture(await markerPoint(), 0, touch ? -45 : 60, { hold: true });
  await settleInput();
  assert.ok(await scrollY() > beforeScroll, 'a wheel or swipe over the lure still browses depth');
  assert.notEqual(await fish.getAttribute('data-swim'), 'approach', 'scrolling does not jig');
  await tick(600);
  await findFish({ species: 'muskie' });
  const preJigScroll = await scrollY();
  await tapLure();
  assert.equal(await biteRipple.isVisible(), false, 'the fish has to reach the jig before gold starts');
  assert.equal(await scrollY(), preJigScroll, 'jigging holds the current depth');
  assert.equal(await button('Spoon').getAttribute('aria-pressed'), 'true', 'jigging keeps the bait selected');
  await tick(32);
  assert.equal(await fish.getAttribute('data-swim'), 'approach');
  await press(button('Menu'), 'Enter');
  const pausedFish = await fish.getAttribute('style');
  await tick(1700);
  assert.equal(await fish.getAttribute('style'), pausedFish, 'pause holds a fish on its approach');
  assert.equal(await biteRipple.isVisible(), false, 'a fish cannot bite during pause');
  await closeDialog(pause, pause.getByRole('button', { name: 'Resume fishing' }));

  await waitForBite();
  assert.equal(await lureAction.getAttribute('aria-disabled'), 'true', 'the lure waits for gold');
  assert.match(await status.textContent(), /wait for gold/i);
  await tapLure();
  assert.equal(await lureAction.getAttribute('aria-disabled'), 'true', 'an early tap leaves the bite timer running');
  assert.equal(await biteRipple.isVisible(), true, 'contact shows the ripple at the lure');
  assert.equal(await page.locator('.fishing-swimmer').count(), 2, 'the other fish are still swimming');
  const timing = tray.locator('.fishing-timing');
  const biteDepth = await depth();
  await press(button('Menu'), 'Enter');
  const pausedTiming = await timing.getAttribute('style');
  await tick(1700);
  assert.equal(await timing.getAttribute('style'), pausedTiming, 'pause holds the gold timer');
  await closeDialog(pause, pause.getByRole('button', { name: 'Resume fishing' }));
  await tick(120);
  if (touch) {
    assert.equal(await depth(), biteDepth, 'reduced motion keeps the line steady at contact');
    assert.equal(await biteRipple.isVisible(), true, 'reduced motion holds the bite cue through the wait');
  }
  await tick(580);
  await settleInput();
  for (const [dx, dy, options] of [[44, -8], [0, -7], [0, 65], ...(touch ? [[0, -42, { pinch: true }], [0, -70, { cancel: true }]] : [])]) {
    await gesture(await markerPoint(), dx, dy, options);
    assert.match(await status.textContent(), /yeah, reel it/i, 'horizontal, small, down, pinch and cancelled input do not hook');
    await settleInput();
  }
  assert.equal(await lureAction.getAttribute('aria-disabled'), 'false');
  await tapLure();
  assert.match(await status.textContent(), /reel it up toward the hole/i, 'a deliberate click or tap in gold sets the hook');
  assert.equal(await page.locator('.fishing-line').getAttribute('data-line-cue'), 'hook', 'the hook shows the stronger tug cue');
  assert.equal(await scrollY(), preJigScroll, 'hook does not browse depths');

  await tick(800);
  const tightLoad = await load();
  assert.match(await status.textContent(), /line’s tight/i);
  assert.equal(await up.isVisible(), false, 'a tight line offers no upward cue');
  assert.match(await down.innerText(), /↓ Loosen/, 'the downward cue stays visible under load');
  await settleInput();
  const tightScroll = await scrollY();
  await gesture(await waterPoint(), 0, 65);
  assert.ok(await load() < tightLoad, 'a downward gesture away from the marker pays out line');
  assert.equal(await scrollY(), tightScroll, 'paying out line does not scroll the page');
  const easedDepth = await depth();
  await gesture(await waterPoint(), 0, -65);
  assert.equal(await depth(), easedDepth, 'a fast follow-up cannot skip the fight action interval');

  await press(button('Menu'), 'Enter');
  await pause.waitFor();
  await marker.waitFor({ state: 'hidden' });
  const pausedLoad = await load();
  const pausedDepth = await depth();
  await settleInput();
  await gesture(await waterPoint(), 0, -65);
  await tick(900);
  assert.equal(await depth(), pausedDepth, 'a paused gesture does not reel');
  assert.equal(await load(), pausedLoad, 'pause holds the line load');
  await closeDialog(pause, pause.getByRole('button', { name: 'Resume fishing' }));
  assert.equal(await button('Menu').evaluate(el => el === document.activeElement), true, 'resume restores focus to Menu');
  await tick(300);
  await settleInput();

  for (let pull = 0; pull < 8 && await action.textContent() !== 'Pull up'; pull++) {
    const beforeDepth = await depth();
    const tight = /line’s tight/i.test(await status.textContent());
    await gesture(await waterPoint(), 0, tight ? 65 : -65);
    if (!tight) assert.ok(await depth() < beforeDepth, 'reeling anywhere in the water raises the fish');
    if (!touch && await action.textContent() === 'Pull up') {
      await gesture(await waterPoint(), 0, -65);
      assert.equal(await action.textContent(), 'Pull up', 'wheel momentum cannot turn the last reel into a lift');
    }
    await tick(300);
    await settleInput();
  }

  assert.equal(await action.textContent(), 'Pull up');
  await gesture(await waterPoint(), 0, -7);
  assert.equal(await action.textContent(), 'Pull up', 'small input cannot lift a fish at the hole');
  await settleInput();
  await gesture(await waterPoint(), 0, -65);
  await tray.getByText(/Muskie.*75 points/i).waitFor();
  const reward = page.locator('.fishing-catch-popup');
  await reward.getByRole('heading', { name: 'Muskie', exact: true }).waitFor();
  await settleInput();
  await gesture(await waterPoint(), 0, -65);
  assert.equal(await reward.isVisible(), true, 'gestures cannot dismiss the reward');
  assert.equal(await action.textContent(), 'Next fish', 'gestures cannot advance the outing');
  await closeSavedCatch();

  await press(button('Menu'), 'Enter');
  await closeDialog(pause, pause.getByRole('button', { name: 'Leave outing' }));
  await launch.waitFor();
  const siteScroll = await scrollY();
  await gesture({ x: 26, y: layout.viewport.height * .6 }, 0, touch ? -75 : 125);
  await settleInput();
  assert.ok(await scrollY() > siteScroll + 5, 'leaving restores native page scrolling');
  assert.deepEqual(errors, []);
  await page.close();
}

async function checkKeyboard(browser) {
  const { page, action, button, enter, findFish, waitForBite, tick, press, closeDialog, errors } = await practicePage(browser);
  await page.evaluate(async () => {
    const { applyProfile } = await import('./game/profile.mjs');
    await applyProfile({ type: 'award', key: 'practice-fixture:0', mode: 'practice', outcome: 'landed',
      speciesId: 'muskie', catch: { points: 75 } });
    Math.random = () => .98;
  });
  await enter('Campaign');
  const startingDepth = await page.locator('.fishing-route').evaluate(el => el.scrollTop);
  await page.keyboard.press('ArrowDown');
  await tick(620);
  assert.ok(await page.locator('.fishing-route').evaluate(el => el.scrollTop) > startingDepth, 'Arrow Down lowers the lure');
  await findFish({ species: 'muskie' });
  const fish = page.locator('.fishing-swimmer[data-species="muskie"]');
  const pause = page.getByRole('dialog', { name: 'Paused' });
  const lake = page.getByRole('dialog', { name: 'Your Lake' });
  const tip = page.locator('.fishing-studied-cue');
  await press(button('Menu'), 'Enter');
  await press(pause.getByRole('button', { name: 'Your Lake' }), 'Enter');
  await press(lake.locator('button[data-species="muskie"]'), 'Enter');
  await press(lake.getByRole('button', { name: 'Learn this tip' }), 'Enter');
  await lake.getByRole('button', { name: 'Tip learned' }).waitFor();
  await closeDialog(lake, lake.getByRole('button', { name: 'Return to outing' }));
  await closeDialog(pause, pause.getByRole('button', { name: 'Resume fishing' }));
  await tick(32);
  assert.equal(await tip.isVisible(), false, 'a newly learned tip leaves the current swimmer unchanged');
  await page.keyboard.press('j');
  await tick(32);
  assert.equal(await fish.getAttribute('data-swim'), 'away', 'a fish backs away from the wrong bait');
  await tick(520);
  await page.keyboard.press('2');
  await findFish({ species: 'muskie' });
  await page.keyboard.press('j');
  await waitForBite();
  assert.equal(await tip.isVisible(), false, 'contact preserves the swimmer’s original guidance');
  await tick(700);
  await page.keyboard.press('r');
  assert.equal(await action.textContent(), 'Reel', 'R in gold starts the fight');
  assert.equal(await page.locator('.fishing-target.is-hooked').count(), 1);
  assert.deepEqual(errors, []);
  await page.close();
}

async function checkExpiredRetry(browser) {
  const { page, action, enter, findFish, waitForBite, tick } = await practicePage(browser);
  await page.evaluate(() => { Math.random = () => .98; });
  await enter('Campaign');
  await page.keyboard.press('2');
  await findFish({ species: 'muskie' });
  await page.keyboard.press('j');
  await waitForBite();
  const slot = await page.locator('.fishing-target').getAttribute('data-candidate');
  await page.keyboard.press('r');
  assert.equal(await action.textContent(), 'Try again');
  const released = page.locator(`.fishing-swimmer[data-candidate="${slot}"]`);
  assert.equal(await released.count(), 1, 'an early hook returns the fish to the water');
  const others = page.locator(`.fishing-swimmer:not([data-candidate="${slot}"])`);
  const otherSlots = await others.evaluateAll(fish => fish.map(swimmer => swimmer.dataset.candidate));

  await tick(31000);
  assert.equal(await action.textContent(), 'Next fish');
  const expired = page.locator(`:is(.fishing-swimmer, .fishing-target)[data-candidate="${slot}"]`);
  assert.equal(await expired.count(), 0, 'the fish leaves the water when the retry window expires');
  assert.deepEqual(await others.evaluateAll(fish => fish.map(swimmer => swimmer.dataset.candidate)), otherSlots);
  const previous = await others.first().getAttribute('style');
  await tick(64);
  assert.notEqual(await others.first().getAttribute('style'), previous, 'the other fish keep swimming');
  await page.close();
}

await withBrowser(async browser => {
  for (const layout of layouts) {
    await checkGestures(browser, layout);
    console.log(`PASS: Campaign browsing, gesture catch, input guards, Pause and exit (${layout.name})`);
  }
  await checkKeyboard(browser);
  console.log('PASS: Campaign keyboard depth, bait response, jig and hook');
  await checkExpiredRetry(browser);
  console.log('PASS: Campaign retry expiry removes only the released fish');
});
