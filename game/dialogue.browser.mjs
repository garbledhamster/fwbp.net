import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { practicePage, withBrowser } from './browser-qa.mjs';

async function checkDialogue(browser, mobile) {
  const { page, tray, status, enter, action, button, press, tick, findFish, reelToHole, errors } =
    await practicePage(browser, { mobile });
  if (mobile) await page.setViewportSize({ width: 320, height: 568 });
  const speech = tray.locator('.fishing-speech');
  const portrait = tray.locator('.fishing-portrait img');
  const path = page.locator('.fishing-line-path');
  const fish = page.locator('.fishing-target');
  const evidence = process.env.FISHING_DIALOGUE_EVIDENCE_DIR;
  const capture = async name => {
    if (!evidence) return;
    await mkdir(evidence, { recursive: true });
    await page.screenshot({ path: join(evidence, `${mobile ? 'phone' : 'desktop'}-${name}.png`) });
  };
  const lineLength = () => path.evaluate(el => el.getTotalLength());
  const expectPortrait = async name => {
    const loaded = await portrait.evaluate(async (el, name) => {
      await el.decode();
      return el.currentSrc.endsWith(`/bryan-${name}.webp`);
    }, name);
    assert.ok(loaded, `Bryan uses his ${name} portrait`);
  };

  await enter();
  assert.equal(await portrait.isVisible(), true, 'Bryan is visible in a framed portrait during play');
  await expectPortrait('front-facing');
  const extended = await lineLength();
  if (mobile) {
    const touch = await page.context().newCDPSession(page);
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 100, y: 70 }] });
    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 100, y: 145 }] });
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await touch.detach();
  } else {
    await page.keyboard.press('ArrowUp');
  }
  await tick(450);
  assert.equal(await page.locator('.fishing-line').isVisible(), true);
  assert.ok(await lineLength() > 5 && await lineLength() < extended / 2, 'the rig retracts but stays visible at the hole');

  await findFish();
  await press(action);
  await press(action);
  assert.match(await status.textContent(), /slipped the hook/i);
  assert.equal(await speech.getByRole('button', { name: 'Try again' }).count(), 1);
  await expectPortrait('leaning-in');
  await capture('slipped');
  await tick(260);
  await press(action);
  await tick(700);
  await press(action);
  await reelToHole();
  await press(action);
  assert.equal(await speech.getByRole('button', { name: 'Next fish' }).count(), 1);
  await expectPortrait('walleye-portrait');
  await capture('caught');
  await press(action);

  await findFish();
  await page.clock.fastForward(30000);
  assert.match(await status.textContent(), /the fish swam away/i);
  assert.equal(await speech.getByRole('button', { name: 'Next fish' }).count(), 1);
  await expectPortrait('headshot');
  await capture('expired');
  await press(button('Exit fishing'));

  await page.evaluate(() => {
    const rolls = [.98, .2, .5, .4, .1];
    let draw = 0;
    Math.random = () => rolls[draw++ % rolls.length];
  });
  await enter();
  await findFish();
  const x = (await fish.boundingBox()).x;
  await press(action);
  await tick(400);
  assert.match(await status.textContent(), /backed off/i);
  assert.ok((await fish.boundingBox()).x < x - 12, 'a wrong lure moves the fish farther from the line');
  await press(action);
  assert.match(await status.textContent(), /spooked/i);
  assert.equal(await speech.getByRole('button', { name: 'Next fish' }).count(), 1);
  if (!mobile) {
    const before = (await fish.boundingBox()).x;
    await fish.evaluate(el => {
      const animation = el.getAnimations().find(item => item.animationName === 'fishing-escape');
      animation.pause();
      animation.currentTime = 450;
    });
    assert.ok((await fish.boundingBox()).x < before - 12, 'the departing fish travels off screen');
    await tick(750);
  }
  assert.equal(await fish.count(), 0);
  assert.deepEqual(errors, []);
  await page.close();
}

await withBrowser(async browser => {
  for (const mobile of [false, true]) await checkDialogue(browser, mobile);
});
console.log('PASS: Bryan dialogue, outcome portraits, lure retraction, and fish retreat on desktop and touch.');
