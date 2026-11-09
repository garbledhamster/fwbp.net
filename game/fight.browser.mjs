import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { practicePage, withBrowser } from './browser-qa.mjs';

async function fightGeometry(page) {
  return page.locator('.fishing-line-path').evaluate(path => {
    const point = path.getPointAtLength(path.getTotalLength()).matrixTransform(path.getScreenCTM());
    const start = path.getPointAtLength(0).matrixTransform(path.getScreenCTM());
    const target = document.querySelector('.fishing-target');
    const fish = target.getBoundingClientRect();
    const mouthX = target.hasAttribute('data-facing-right') ? 238 / 245 : 7 / 245;
    const tray = document.querySelector('.fishing-tray').getBoundingClientRect();
    return {
      x: point.x, y: point.y, holeX: start.x,
      depth: point.y - start.y, distanceToHole: Math.hypot(point.x - start.x, point.y - start.y),
      centerGap: Math.hypot(point.x - innerWidth / 2, point.y - tray.top / 2),
      gap: Math.hypot(point.x - fish.left - fish.width * mouthX,
        point.y - fish.top - fish.height * 42 / 72),
      fishInView: fish.left >= 0 && fish.right <= innerWidth && fish.top >= 0 && fish.bottom < tray.top,
    };
  });
}

async function checkFight(browser, mobile, mode) {
  const { leave, page, tray, action, button, status, press, enter, tick, findFish, waitForBite, reelToHole, errors } =
    await practicePage(browser, { mobile, campaignLiveButtons: mode === 'Campaign' });
  // Seed the first encounter with a standard muskie.
  await page.evaluate(() => {
    const rolls = [.98, .2, .5, .4, .1];
    let draw = 0;
    Math.random = () => rolls[draw++ % rolls.length];
  });
  const load = tray.locator('meter');
  const loosen = button('Loosen');
  const evidence = process.env.FISHING_EVIDENCE_DIR;
  const capture = async name => {
    if (!evidence || mobile || mode !== 'Campaign') return;
    await mkdir(evidence, { recursive: true });
    await page.screenshot({ path: join(evidence, `${name}.png`), animations: 'disabled' });
  };

  async function hook() {
    await enter(mode);
    await press(button('Spoon'));
    await findFish({ species: 'muskie' });
    await press(action);
    if (mode === 'Campaign') await waitForBite();
    await tick(700);
    await press(action);
  }

  await hook();
  const color = control => control.evaluate(el => getComputedStyle(el).backgroundColor);
  const gold = await color(action);
  assert.equal(await load.evaluate(meter => meter.max), 8);
  const initial = await fightGeometry(page);
  const initialLoad = await load.evaluate(meter => meter.value);
  assert.match(await status.textContent(), /reel it up toward the hole/i);

  await tick(800);
  const surge = await fightGeometry(page);
  if (mode === 'Campaign') {
    assert.ok(surge.holeX < initial.holeX - 5 && surge.depth > initial.depth + 5,
      'the lake moves as the fish pulls sideways and deeper without input');
    assert.ok(surge.centerGap < 1, 'the camera keeps the hook centered through the surge');
  } else {
    assert.ok(surge.x > initial.x + 5 && surge.y > initial.y + 5,
      'the fish pulls sideways and deeper without input');
  }
  assert.ok(surge.gap < 1 && surge.fishInView, 'the line follows the mouth and stays in the playable water');
  const surgeLoad = await load.evaluate(meter => meter.value);
  assert.ok(surgeLoad > initialLoad);
  assert.match(await status.textContent(), /line’s tight.*loosen/i);
  assert.equal(await loosen.evaluate(el => el.classList.contains('fishing-recommended')), true);
  assert.equal(await color(loosen), gold);
  assert.notEqual(await color(action), gold);
  const reelSlot = await action.boundingBox();
  await capture('haul-start');

  if (mode !== 'Campaign') {
    await page.evaluate(() => scrollBy(0, 36));
    await tick(32);
    const scrolled = await fightGeometry(page);
    assert.ok(scrolled.y < surge.y - 20 && scrolled.gap < 1, 'scroll changes the view without moving the hook off the mouth');
  }
  await press(loosen);
  assert.ok(await load.evaluate(meter => meter.value) < surgeLoad);
  assert.match(await status.textContent(), /reel it up toward the hole/i);
  const looseDepth = (await fightGeometry(page)).depth;
  if (mode === 'Campaign' && !mobile) {
    await tick(300);
    const before = await fightGeometry(page);
    await press(action);
    const frames = [await fightGeometry(page)];
    for (let i = 0; i < 13; i++) {
      await tick(16);
      frames.push(await fightGeometry(page));
    }
    assert.ok(Math.abs(frames[0].depth - before.depth) < 2, 'the reel does not jump on input');
    assert.ok(frames.filter((frame, i) => i && frame.depth < frames[i - 1].depth - 1).length > 4,
      'the line winds in across several frames');
    assert.ok(frames.every(frame => frame.centerGap < 1 && frame.gap < 1),
      'the camera tracks the hook and keeps it attached while reeling');
  }
  await reelToHole();
  assert.ok((await fightGeometry(page)).depth < looseDepth, 'reeling a clear line brings the fish up');
  assert.equal(await action.textContent(), 'Pull up');
  const atHole = await fightGeometry(page);
  assert.ok(atHole.distanceToHole < 1 && atHole.gap < 1, 'Pull up is offered only at the ice hole');
  assert.ok(atHole.y >= 0, 'the camera follows the fish back to the visible hole');
  if (mode === 'Campaign') assert.ok(atHole.centerGap < 1, 'the hook stays centered at the hole');
  assert.equal((await action.boundingBox()).x, reelSlot.x);
  assert.match(await status.textContent(), /pull it up/i);
  await capture('haul-hole');
  await tick(300);
  await press(action);
  await tray.getByText(/Muskie.*75 points/i).waitFor();

  await leave();
  await hook();
  await tick(800);
  await press(action);
  assert.match(await status.textContent(), /line snapped.*9\.7 lb.*8 lb/i);
  assert.equal(await action.textContent(), 'Next fish');
  assert.equal(await page.locator('.fishing-line').isHidden(), true);
  await press(action);
  assert.match(await status.textContent(), mode === 'Campaign' ? /scroll to a fish’s depth/i : /find the fish/i);
  assert.deepEqual(errors, []);
  await page.close();
}

await withBrowser(async browser => {
  for (const mode of ['Practice', 'Campaign']) {
    for (const mobile of [false, true]) {
      await checkFight(browser, mobile, mode);
      console.log(`PASS: ${mode} surge, attached hook, landing and snap (${mobile ? '320 px reduced-motion touch' : 'desktop keyboard'})`);
    }
  }
});
