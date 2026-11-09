import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { practicePage, withBrowser } from './browser-qa.mjs';

async function fightGeometry(page) {
  return page.locator('.fishing-line-path').evaluate(path => {
    const point = path.getPointAtLength(path.getTotalLength()).matrixTransform(path.getScreenCTM());
    const start = path.getPointAtLength(0).matrixTransform(path.getScreenCTM());
    const fish = document.querySelector('.fishing-target').getBoundingClientRect();
    const tray = document.querySelector('.fishing-tray').getBoundingClientRect();
    return {
      x: point.x, y: point.y, distanceToHole: Math.hypot(point.x - start.x, point.y - start.y),
      gap: Math.hypot(point.x - fish.left - fish.width * 7 / 245,
        point.y - fish.top - fish.height * 42 / 72),
      fishInView: fish.left >= 0 && fish.right <= innerWidth && fish.top >= 0 && fish.bottom < tray.top,
    };
  });
}

async function checkFight(browser, mobile) {
  const { page, tray, action, button, status, press, enter, tick, findFish, errors } =
    await practicePage(browser, { mobile });
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
    if (!evidence || mobile) return;
    await mkdir(evidence, { recursive: true });
    await page.screenshot({ path: join(evidence, `${name}.png`), animations: 'disabled' });
  };

  async function hook() {
    await enter('Campaign');
    await findFish();
    await press(button('Spoon'));
    await press(action);
    await tick(700);
    await press(action);
  }

  await hook();
  const initial = await fightGeometry(page);
  const initialLoad = await load.evaluate(meter => meter.value);
  assert.equal(await load.evaluate(meter => meter.max), 8);
  assert.match(await status.textContent(), /line clear.*reel/i);

  await tick(800);
  const surge = await fightGeometry(page);
  assert.ok(surge.x > initial.x + 5 && surge.y > initial.y + 5,
    'the fish pulls sideways and deeper without input');
  assert.ok(surge.gap < 1 && surge.fishInView, 'the line follows the mouth and stays in the playable water');
  const surgeLoad = await load.evaluate(meter => meter.value);
  assert.ok(surgeLoad > initialLoad);
  assert.match(await status.textContent(), /line tight.*loosen/i);
  assert.equal(await loosen.evaluate(el => el.classList.contains('fishing-recommended')), true);
  const reelSlot = await action.boundingBox();
  await capture('haul-start');

  await page.evaluate(() => scrollBy(0, 36));
  await tick(32);
  const scrolled = await fightGeometry(page);
  assert.ok(scrolled.y < surge.y - 20 && scrolled.gap < 1, 'scroll changes the view without moving the hook off the mouth');
  await press(loosen);
  assert.ok(await load.evaluate(meter => meter.value) < surgeLoad);
  assert.match(await status.textContent(), /line clear.*reel/i);
  const looseDepth = (await fightGeometry(page)).y;
  for (let n = 0; n < 3; n++) {
    await tick(300);
    await press(action);
  }
  assert.ok((await fightGeometry(page)).y < looseDepth, 'reeling a clear line brings the fish up');
  assert.equal(await action.textContent(), 'Pull up');
  const atHole = await fightGeometry(page);
  assert.ok(atHole.distanceToHole < 1 && atHole.gap < 1, 'Pull up is offered only at the ice hole');
  assert.ok(atHole.y >= 0, 'the camera follows the fish back to the visible hole');
  assert.equal((await action.boundingBox()).x, reelSlot.x);
  assert.match(await status.textContent(), /pull up/i);
  await capture('haul-hole');
  await tick(300);
  await press(action);
  await tray.getByText(/Muskie.*75 points/i).waitFor();

  await press(button('Exit fishing'));
  await hook();
  await tick(800);
  await press(action);
  assert.match(await status.textContent(), /line snapped.*9\.7 lb.*8 lb/i);
  assert.equal(await action.textContent(), 'Next fish');
  assert.equal(await page.locator('.fishing-line').isHidden(), true);
  await press(action);
  assert.match(await status.textContent(), /find the fish/i);
  assert.deepEqual(errors, []);
  await page.close();
}

await withBrowser(async browser => {
  for (const mobile of [false, true]) {
    await checkFight(browser, mobile);
    console.log(`PASS: Campaign surge, attached hook, landing and snap (${mobile ? '320 px reduced-motion touch' : 'desktop keyboard'})`);
  }
});
