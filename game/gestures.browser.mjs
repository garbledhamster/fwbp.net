import assert from 'node:assert/strict';
import { practicePage, withBrowser } from './browser-qa.mjs';

const layouts = [
  { name: 'desktop wheel', viewport: { width: 1200, height: 720 } },
  { name: '320×720 touch', mobile: true, viewport: { width: 320, height: 720 } },
  { name: '720×320 touch', mobile: true, viewport: { width: 720, height: 320 } },
];

async function checkGestures(browser, layout) {
  const { page, tray, action, button, status, enter, findFish, tick, press, closeDialog, launch, errors } =
    await practicePage(browser, layout);
  const touch = layout.mobile && await page.context().newCDPSession(page);
  // A standard muskie on starter line supplies a real surge and multiple pulls.
  await page.evaluate(() => {
    const rolls = [.98, .2, .5, .4, .1];
    let draw = 0;
    Math.random = () => rolls[draw++ % rolls.length];
  });

  const scrollY = () => page.evaluate(() => window.scrollY);
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
  const wait = marker.locator('[data-line-gesture-wait]');
  const markerPoint = async () => {
    // Fall back to the lure's coordinates so the pre-feature failure is a missed jig.
    const box = await marker.count() ? await marker.boundingBox() : undefined;
    if (box) return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    return page.locator('.fishing-line-path').evaluate(path => {
      const point = path.getPointAtLength(path.getTotalLength()).matrixTransform(path.getScreenCTM());
      return { x: point.x + 18, y: point.y };
    });
  };
  const waterPoint = async () => ({ x: 30, y: Math.max(75, (await tray.boundingBox()).y * .57) });
  const fingers = (type, points) => touch.send('Input.dispatchTouchEvent', {
    type, touchPoints: points.map(({ x, y }, id) => ({ x, y, id })),
  });
  async function gesture({ x, y }, dx, dy, { pinch = false, cancel = false } = {}) {
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
    await fingers(cancel ? 'touchCancel' : 'touchEnd', []);
  }

  await enter('Campaign');
  const originalScroll = await scrollY();
  await gesture(await waterPoint(), 0, touch ? -65 : 115);
  await settleInput();
  assert.ok(await scrollY() > originalScroll + 5, 'native depth browsing works outside the line marker');
  assert.equal(await action.textContent(), 'Jig');
  await findFish();
  await marker.waitFor();
  assert.equal(await marker.evaluate(el => el.tabIndex), -1, 'the marker adds no keyboard stop');
  if (!touch) {
    await button('Menu').focus();
    const visited = new Set();
    for (let step = 0; step < 10; step++) {
      await page.keyboard.press('Tab');
      assert.equal(await marker.evaluate(el => el.contains(document.activeElement)), false, 'Tab skips the marker');
      assert.equal(await action.evaluate(el => el === document.activeElement), false, 'Tab skips the live Jig action');
      const lure = await page.evaluate(() => document.activeElement.dataset.lure);
      if (lure) visited.add(lure);
    }
    assert.deepEqual([...visited], ['jig', 'spoon', 'minnow'], 'Tab reaches every bait slot');
  }
  await press(button('Spoon'));
  await findFish();
  await marker.waitFor();
  const selected = await button('Spoon').getAttribute('aria-pressed');
  const preJigScroll = await scrollY();
  await gesture(await markerPoint(), 0, -70);
  assert.equal(await wait.isVisible(), true, 'an upward line gesture jigs the selected lure');
  assert.equal(await scrollY(), preJigScroll, 'jig does not browse depths');
  assert.equal(await button('Spoon').getAttribute('aria-pressed'), selected, 'a gesture does not change tackle on release');

  // The next wheel event belongs to the jig burst. A short swipe stays below the threshold.
  await gesture(await markerPoint(), 0, touch ? -10 : -70);
  assert.match(await status.textContent(), /wait for gold/i, 'a follow-through cannot attempt an early hook');
  await tick(700);
  await settleInput();
  for (const [dx, dy, options] of [[44, -8], [0, -7], [0, 65], ...(touch ? [[0, -42, { pinch: true }], [0, -70, { cancel: true }]] : [])]) {
    await gesture(await markerPoint(), dx, dy, options);
    assert.match(await status.textContent(), /yeah, reel it/i, 'horizontal, small, down, pinch and cancelled input do not hook');
    await settleInput();
  }
  await gesture(await markerPoint(), 0, -64);
  assert.match(await status.textContent(), /reel it up toward the hole/i, 'a deliberate new upward gesture sets the hook');
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

  const pause = page.getByRole('dialog', { name: 'Paused' });
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
  await settleInput();
  await gesture(await waterPoint(), 0, -65);
  assert.equal(await action.textContent(), 'Next fish', 'gestures cannot dismiss the catch result');

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

await withBrowser(async browser => {
  for (const layout of layouts) {
    await checkGestures(browser, layout);
    console.log(`PASS: Campaign browsing, gesture catch, input guards, Pause and exit (${layout.name})`);
  }
});
