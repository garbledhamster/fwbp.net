import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { practicePage, withBrowser } from './browser-qa.mjs';

async function fightView(page) {
  return page.evaluate(() => {
    const target = document.querySelector('.fishing-target');
    const fish = target.getBoundingClientRect();
    const facing = target.style.getPropertyValue('--fight-facing');
    const mouthX = facing ? .5 + (7 / 245 - .5) * Number(facing)
      : target.hasAttribute('data-facing-right') ? 238 / 245 : 7 / 245;
    const tray = document.querySelector('.fishing-tray').getBoundingClientRect();
    const path = document.querySelector('.fishing-line-path');
    const hook = path.getPointAtLength(path.getTotalLength()).matrixTransform(path.getScreenCTM());
    return {
      trayTop: tray.top,
      fishTop: fish.top,
      fishBottom: fish.bottom,
      centerGap: Math.hypot(hook.x - innerWidth / 2, hook.y - tray.top / 2),
      gap: Math.hypot(hook.x - fish.left - fish.width * mouthX,
        hook.y - fish.top - fish.height * 42 / 72),
    };
  });
}

async function checkLandscape(browser, mode) {
  const { leave, page, tray, action, button, status, openGame, press, enter, tick, findFish, waitForBite, selectTackle, errors } =
    await practicePage(browser, { mobile: true });
  await page.evaluate(() => {
    const rolls = [.98, .2, .5, .4, .1];
    let draw = 0;
    Math.random = () => rolls[draw++ % rolls.length];
  });

  const campaign = mode === 'Campaign';
  const tapWater = async () => {
    const box = await tray.boundingBox();
    await page.touchscreen.tap(30, box.y * .42);
  };
  const anglerMeter = page.getByRole('meter', { name: 'Reel feedback' });

  await enter(mode);
  await press(button('Spoon'));
  await findFish({ species: 'muskie' });
  if (campaign) {
    await tapWater();
    await waitForBite();
  } else await press(action);
  await tick(700);
  if (campaign) await tapWater();
  else await press(action);
  await tick(800);
  if (campaign) await anglerMeter.waitFor();
  else assert.match(await status.textContent(), /line’s tight/i);
  const portrait = await fightView(page);
  assert.ok(portrait.fishTop >= 0 && portrait.fishBottom < portrait.trayTop);
  const load = tray.locator('meter');
  const beforeRotation = campaign ? undefined : await load.evaluate(el => el.value);
  const loosen = button('Loosen');

  await page.setViewportSize({ width: 720, height: 320 });
  for (let frame = 0; frame < 4; frame++) {
    await page.waitForTimeout(32);
    await tick(32);
  }
  const landscape = await fightView(page);
  assert.ok(landscape.fishTop >= 0 && landscape.fishBottom < landscape.trayTop,
    `rotation keeps the fish above the tray: ${JSON.stringify(landscape)}`);
  assert.ok(landscape.trayTop >= 160, `leave at least half of the short screen for water: ${JSON.stringify(landscape)}`);
  assert.ok(landscape.gap < 1, 'the line stays attached across rotation');
  if (campaign) {
    assert.equal(await action.isVisible(), false);
    assert.equal(await loosen.isVisible(), false);
    for (const overlay of [anglerMeter, page.locator('.fishing-bryan-callout')]) {
      const bounds = await overlay.boundingBox();
      assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 720 && bounds.y >= 0 &&
        bounds.y + bounds.height <= landscape.trayTop, 'the meter and Bryan cue stay inside the water');
      assert.equal(await overlay.evaluate(el => getComputedStyle(el).pointerEvents), 'none');
    }
  } else {
    assert.equal(await load.evaluate(el => el.value), beforeRotation, 'rotation preserves the load');
  }
  const touchTargets = campaign ? [button('Menu'), ...['Jig', 'Spoon', 'Minnow'].map(button)] : [action, loosen];
  for (const control of touchTargets) {
    const bounds = await control.boundingBox();
    assert.ok(bounds?.width >= 44 && bounds.height >= 44 && bounds.y + bounds.height <= 320,
      'the tray retains on-screen touch targets');
  }

  if (process.env.FISHING_EVIDENCE_DIR && mode === 'Campaign') {
    await mkdir(process.env.FISHING_EVIDENCE_DIR, { recursive: true });
    await page.screenshot({
      path: join(process.env.FISHING_EVIDENCE_DIR, 'landscape-after.png'),
      animations: 'disabled',
    });
  }

  if (campaign) {
    await page.evaluate(() => { Math.random = () => .95; });
    await tapWater();
    assert.equal(await anglerMeter.getAttribute('data-outcome'), 'reel');
    await tick(180);
    const view = await fightView(page);
    assert.ok(view.centerGap < 1 && view.gap < 1, 'after rotation the camera follows the hook attached to the fish');
  } else {
    await press(loosen);
    assert.match(await status.textContent(), /reel it up toward the hole/i);
    assert.ok(await load.evaluate(el => el.value) < beforeRotation);
    const beforeScroll = await fightView(page);
    await page.evaluate(() => scrollBy(0, 24));
    await tick(32);
    const afterScroll = await fightView(page);
    assert.ok(Math.abs(afterScroll.fishTop - beforeScroll.fishTop + 24) < 10 && afterScroll.gap < 1,
      'manual scrolling still moves the view with the hook attached');
  }

  await leave();
  await openGame();
  await press(page.getByRole('button', { name: 'Tackle shop', exact: true }));
  const shop = page.getByRole('dialog', { name: 'Tackle shop' });
  const strongerLine = await selectTackle('stronger-line');
  await strongerLine.getByText('12 lb line. Fish take less line when they run.', { exact: true }).waitFor();
  await press(shop.getByRole('button', { name: 'Back to outings' }));
  await page.getByRole('dialog', { name: 'Choose an outing' }).waitFor();
  assert.equal(await shop.isHidden(), true);
  assert.deepEqual(errors, []);

  await page.close();
  console.log(`PASS: ${mode} fish, hook, controls, scroll, and shop at 720×320 ${JSON.stringify(landscape)}`);
}

await withBrowser(async browser => {
  for (const mode of ['Campaign', 'Practice']) await checkLandscape(browser, mode);
});
