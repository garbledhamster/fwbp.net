import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { practicePage, withBrowser } from './browser-qa.mjs';

async function campaign(browser, { mobile = false } = {}) {
  const qa = await practicePage(browser, { mobile });
  const { page, tray, tick, press, status, findFish, waitForBite } = qa;
  const touch = mobile && await page.context().newCDPSession(page);
  const wait = ms => Promise.all([tick(ms), page.waitForTimeout(ms)]);
  const marker = page.locator('[data-line-gesture-marker]');
  const load = () => tray.locator('meter').evaluate(meter => meter.value);
  const depth = () => page.locator('.fishing-line-path').evaluate(path => {
    const rig = document.querySelector('.fishing-line-rig');
    return rig.transform.baseVal.getItem(0).matrix.f - path.getPointAtLength(0).y;
  });
  const waterPoint = async () => ({ x: 30, y: Math.max(75, (await tray.boundingBox()).y * .5) });
  const markerPoint = async () => {
    const { x, y, width, height } = await marker.boundingBox();
    return { x: x + width / 2, y: y + height / 2 };
  };

  async function gesture(dy, point, duration = 100) {
    const { x, y } = point ?? await waterPoint();
    if (!touch) {
      await page.mouse.move(x, y);
      await page.mouse.wheel(0, dy);
      await page.waitForTimeout(30);
      return;
    }
    const dispatch = (type, touchPoints) => touch.send('Input.dispatchTouchEvent', { type, touchPoints });
    await dispatch('touchStart', [{ x, y }]);
    for (let i = 1; i <= 4; i++) {
      await page.waitForTimeout(duration / 4);
      await dispatch('touchMove', [{ x, y: y + dy * i / 4 }]);
    }
    await dispatch('touchEnd', []);
  }

  async function wheelPackets(deltas, gap, deltaMode = 0) {
    const point = await waterPoint();
    for (const [index, deltaY] of deltas.entries()) {
      if (index) await wait(gap);
      await page.evaluate(({ x, y, deltaY, deltaMode }) => {
        document.elementFromPoint(x, y).dispatchEvent(new WheelEvent('wheel', {
          deltaY, deltaMode, bubbles: true, cancelable: true,
        }));
      }, { ...point, deltaY, deltaMode });
    }
  }

  async function hook(lure, species) {
    await press(tray.getByRole('group', { name: 'Lures' }).getByRole('button', { name: lure, exact: true }));
    await findFish({ species });
    const jig = marker.getByRole('button', { name: 'Jig lure' });
    await (mobile ? jig.tap() : jig.click());
    await waitForBite();
    assert.match(await status.textContent(), /wait for gold/i);
    await wait(700);
    await gesture(mobile ? -60 : -100, await markerPoint());
    assert.match(await status.textContent(), /reel it up toward the hole/i);
  }

  const phase = () => page.locator('.lake').getAttribute('data-line-gesture');
  return { ...qa, depth, gesture, hook, load, phase, wait, wheelPackets };
}

async function controlledReel(browser, input, mobile = false) {
  const qa = await campaign(browser, { mobile });
  try {
    await qa.enter('Campaign');
    await qa.hook('Jig', 'perch');
    // Start after the first surge, when the line load is steady for the reel.
    await qa.tick(1880);
    const before = await qa.depth();
    const start = await qa.page.evaluate(() => Date.now());
    await input(qa);
    const elapsed = await qa.page.evaluate(() => Date.now()) - start;
    if (elapsed < 220) await qa.tick(220 - elapsed);
    const movement = (before - await qa.depth()) / before;
    assert.ok(movement > 0, 'the first reel moves the fish');
    assert.deepEqual(qa.errors, []);
    return movement;
  } finally {
    await qa.page.close();
  }
}

async function controlledPayout(browser, delta) {
  const qa = await campaign(browser);
  try {
    await qa.page.evaluate(() => { Math.random = () => .98; });
    await qa.enter('Campaign');
    await qa.hook('Spoon', 'muskie');
    await qa.tick(120);
    const line = qa.page.locator('.fishing-line');
    assert.equal(await line.getAttribute('data-line-pull'), 'surge', 'the fish tugs without any player input');
    await qa.tick(680);
    const before = await qa.load();
    await qa.gesture(delta);
    assert.equal(await line.getAttribute('data-line-pull'), 'loosen', 'payout visibly bows the line');
    return before - await qa.load();
  } finally {
    await qa.page.close();
  }
}

async function compareFights(browser, mobile) {
  const qa = await campaign(browser, { mobile });
  const { page, status, phase, tray, depth, load, tick, gesture, wait } = qa;
  const input = dy => gesture(dy * (mobile ? 60 : 100));
  const movements = {};
  const evidence = process.env.FISHING_EVIDENCE_DIR;
  const capture = async state => {
    if (!evidence) return;
    await mkdir(evidence, { recursive: true });
    await page.screenshot({ path: join(evidence, `resistance-${mobile ? 'touch' : 'wheel'}-${state}.png`), animations: 'disabled' });
  };
  try {
    for (const { kind, species, lure, speciesRoll } of [
      { kind: 'light', species: 'perch', lure: 'Jig', speciesRoll: .05 },
      { kind: 'heavy', species: 'muskie', lure: 'Spoon', speciesRoll: .98 },
    ]) {
      // Same depth and size rolls for both encounters, with enough pull to
      // exercise the tight-line cue on starter line during the muskie fight.
      await page.evaluate(speciesRoll => {
        const rolls = [speciesRoll, .2, .5, .4, .1];
        let draw = 0;
        Math.random = () => rolls[draw++ % rolls.length];
      }, speciesRoll);
      await qa.enter('Campaign');
      await qa.hook(lure, species);
      await tick(1880);
      const before = await depth();
      await input(-1);
      await tick(220);
      movements[kind] = (before - await depth()) / before;
      assert.ok(movements[kind] > 0, `the first reel moves the ${species}`);
      if (kind === 'heavy') {
        await wait(800);
        for (let step = 0; step < 12 && !/line’s tight/i.test(await status.textContent()); step++) await tick(40);
        assert.match(await status.textContent(), /line’s tight/i, 'the stronger fish loads starter line during its next surge');
        const tight = await load();
        await capture('tight');
        await input(1);
        assert.ok(await load() < tight, 'downward input relieves the measured load');
        await capture('eased');
        for (let pull = 0; pull < 24 && await phase() !== 'lift'; pull++) {
          await wait(300);
          assert.equal(await phase(), 'reel', 'the fish stays on the line');
          await input(/line’s tight/i.test(await status.textContent()) ? 1 : -1);
        }
        assert.equal(await phase(), 'lift');
        await wait(300);
        await input(-1);
        await tray.getByText(/Muskie.*points/i).waitFor();
        await page.locator('.fishing-catch-popup').getByRole('heading', { name: 'Muskie', exact: true }).waitFor();
        await capture('landed');
        await qa.closeSavedCatch();
      }
      await qa.leave();
    }
    assert.ok(movements.heavy < movements.light, `a larger fish moves less: ${JSON.stringify(movements)}`);
    assert.deepEqual(qa.errors, []);
    console.log(`PASS: perch and muskie ${mobile ? 'phone swipe' : 'desktop wheel'} resistance, payout and lift ${JSON.stringify(movements)}`);
  } finally {
    await page.close();
  }
}

await withBrowser(async browser => {
  const notch = await controlledReel(browser, qa => qa.gesture(-100));
  const lineNotch = await controlledReel(browser, qa => qa.wheelPackets([-3], 0, 1));
  const oneLineNotch = await controlledReel(browser, qa => qa.wheelPackets([-1], 0, 1));
  const trackpad = await controlledReel(browser, async qa => {
    await qa.wheelPackets([-10, -10, -10], 16);
    await qa.wheelPackets([-70, -60, -50, -40], 70);
    const after = await qa.depth();
    await qa.wait(70);
    await qa.wheelPackets([-30], 70);
    await qa.tick(80);
    assert.ok(Math.abs(await qa.depth() - after) < 1, 'a wheel tail cannot add a second reel after the action interval');
  });
  const swipe = await controlledReel(browser, qa => qa.gesture(-68), true);
  for (const [device, movement] of Object.entries({ lineNotch, oneLineNotch, trackpad, swipe })) {
    assert.ok(Math.abs(movement / notch - 1) < .25, `${device} is comparable to a pixel-mode wheel notch: ${movement} vs ${notch}`);
  }
  const quick = await controlledReel(browser, qa => qa.gesture(-250));
  const extreme = await controlledReel(browser, qa => qa.gesture(-9999));
  assert.ok(quick > notch * 1.2, `a faster deliberate reel moves the same fish farther: ${quick} vs ${notch}`);
  assert.ok(Math.abs(extreme - quick) < .001, 'an extreme delta does not add power past the capped gesture');
  console.log(`PASS: normalized gesture distance, quiet wheel tail and effort cap ${JSON.stringify({ notch, lineNotch, oneLineNotch, trackpad, swipe, quick, extreme })}`);
  const regularPayout = await controlledPayout(browser, 100);
  const hardPayout = await controlledPayout(browser, 250);
  assert.ok(hardPayout > regularPayout + 1, 'a stronger downward wheel stroke eases more load');
  console.log(`PASS: fish surge and effort-based payout ${JSON.stringify({ regularPayout, hardPayout })}`);
  for (const mobile of [false, true]) await compareFights(browser, mobile);
});
