import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { practicePage, withBrowser } from './browser-qa.mjs';

async function fightView(page) {
  return page.evaluate(() => {
    const fish = document.querySelector('.fishing-target').getBoundingClientRect();
    const tray = document.querySelector('.fishing-tray').getBoundingClientRect();
    const path = document.querySelector('.fishing-line-path');
    const hook = path.getPointAtLength(path.getTotalLength()).matrixTransform(path.getScreenCTM());
    return {
      trayTop: tray.top,
      fishTop: fish.top,
      fishBottom: fish.bottom,
      gap: Math.hypot(hook.x - fish.left - fish.width * 7 / 245,
        hook.y - fish.top - fish.height * 42 / 72),
    };
  });
}

async function checkLandscape(browser, mode) {
  const { page, tray, action, button, status, launch, press, enter, tick, findFish, errors } =
    await practicePage(browser, { mobile: true });
  await page.evaluate(() => {
    const rolls = [.98, .2, .5, .4, .1];
    let draw = 0;
    Math.random = () => rolls[draw++ % rolls.length];
  });

  await enter(mode);
  await findFish();
  await press(button('Spoon'));
  await press(action);
  await tick(700);
  await press(action);
  await tick(800);
  assert.match(await status.textContent(), /line’s tight/i);
  const portrait = await fightView(page);
  assert.ok(portrait.fishTop >= 0 && portrait.fishBottom < portrait.trayTop);
  const load = tray.locator('meter');
  const beforeRotation = await load.evaluate(el => el.value);
  const loosen = button('Loosen');

  await page.setViewportSize({ width: 720, height: 320 });
  for (let frame = 0; frame < 4; frame++) {
    await page.waitForTimeout(32);
    await tick(32);
  }
  const landscape = await fightView(page);
  assert.ok(landscape.fishTop >= 0 && landscape.fishBottom < landscape.trayTop,
    `rotation keeps the fish above the tray: ${JSON.stringify(landscape)}`);
  assert.ok(landscape.trayTop >= 160, 'leave at least half of the short screen for water');
  assert.ok(landscape.gap < 1, 'the line stays attached across rotation');
  assert.equal(await load.evaluate(el => el.value), beforeRotation, 'rotation preserves the load');
  for (const control of [action, loosen]) {
    const bounds = await control.boundingBox();
    assert.ok(bounds?.width >= 44 && bounds.height >= 44 && bounds.y + bounds.height <= 320,
      'Reel and Loosen remain on-screen touch targets');
  }

  if (process.env.FISHING_EVIDENCE_DIR && mode === 'Campaign') {
    await mkdir(process.env.FISHING_EVIDENCE_DIR, { recursive: true });
    await page.screenshot({
      path: join(process.env.FISHING_EVIDENCE_DIR, 'landscape-after.png'),
      animations: 'disabled',
    });
  }

  await press(loosen);
  assert.match(await status.textContent(), /reel it up toward the hole/i);
  assert.ok(await load.evaluate(el => el.value) < beforeRotation);
  const beforeScroll = await fightView(page);
  await page.evaluate(() => scrollBy(0, 24));
  await tick(32);
  const afterScroll = await fightView(page);
  assert.ok(afterScroll.fishTop < beforeScroll.fishTop - 15 && afterScroll.gap < 1,
    'manual scrolling still moves the view with the hook attached');

  await press(button('Exit fishing'));
  await press(launch, 'Enter');
  await press(page.getByRole('button', { name: 'Tackle shop', exact: true }));
  const shop = page.getByRole('dialog', { name: 'Tackle shop' });
  await shop.getByText('Stronger line').waitFor();
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
