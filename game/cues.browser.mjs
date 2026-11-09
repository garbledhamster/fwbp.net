import assert from 'node:assert/strict';
import { practicePage, withBrowser } from './browser-qa.mjs';

async function checkBite(browser) {
  const { enter, page, launch, action, status, timing, press, tick, errors, findFish, reelToHole } = await practicePage(browser);
  const keyboard = page.keyboard;
  const cue = () => status.textContent();
  await enter();
  assert.equal(await page.locator(':focus').textContent(), 'Exit fishing');
  await findFish();
  await keyboard.press('Tab');
  await keyboard.press('Tab');
  await keyboard.press('Space'); // Select Spoon for the perch.
  for (let i = 0; i < 2; i++) await keyboard.press('Tab');
  assert.equal(await action.evaluate(el => el === document.activeElement), true);
  await keyboard.press('Enter');
  assert.match(await cue(), /different lure/i);
  assert.equal(await timing.isHidden(), true);

  await keyboard.press('Enter');
  assert.match(await cue(), /give the line a moment/i);
  await tick(260);
  await keyboard.press('Shift+Tab');
  await keyboard.press('Shift+Tab');
  await keyboard.press('Shift+Tab');
  await keyboard.press('Space'); // Select Jig for the perch.
  for (let i = 0; i < 3; i++) await keyboard.press('Tab');

  await keyboard.press('Enter');
  assert.match(await cue(), /wait for gold/i);
  assert.equal(await timing.isVisible(), true);
  await keyboard.press('Enter');
  assert.match(await cue(), /slipped the hook.*jig again/i);
  assert.equal(await timing.isHidden(), true);

  await tick(260);
  await page.evaluate(() => {
    const live = document.querySelector('.fishing-status');
    window.liveRegionUpdates = [];
    new MutationObserver(() => window.liveRegionUpdates.push(live.textContent))
      .observe(live, { childList: true });
  });
  await keyboard.down('Enter');
  await keyboard.down('Enter'); // A held key must not reel automatically.
  await keyboard.up('Enter');
  assert.match(await cue(), /wait for gold/i);
  await tick(530);
  assert.match(await cue(), /wait for gold/i);
  await tick(45);
  assert.match(await cue(), /yeah, reel it!/i);
  await tick(1550);
  assert.match(await cue(), /window passed.*reel.*again/i);
  assert.equal(await timing.isVisible(), true);
  assert.deepEqual(await page.evaluate(() => window.liveRegionUpdates.map(text =>
    text.match(/wait for gold|yeah, reel it!|window passed/i)?.[0].toLowerCase())),
  ['wait for gold', 'yeah, reel it!', 'window passed']);
  await keyboard.press('Space');
  assert.match(await cue(), /slipped the hook.*jig again/i);

  await keyboard.press('Space');
  await tick(600);
  await keyboard.press('Space');
  await reelToHole();
  await press(action);
  assert.match(await cue(), /yellow perch.*\+10 points/i);
  assert.equal(await action.evaluate(el => el === document.activeElement), true);
  await keyboard.press('Escape');
  assert.equal(await launch.evaluate(el => el === document.activeElement), true);
  await enter();
  await findFish();
  await keyboard.press('Tab');
  for (let i = 0; i < 3; i++) await keyboard.press('Tab');
  await keyboard.press('Space');
  assert.match(await cue(), /wait for gold/i);
  await keyboard.press('Escape');
  await enter();
  await tick(2200);
  assert.match(await cue(), /scroll.*find the fish/i);
  assert.equal(await timing.isHidden(), true);
  assert.deepEqual(errors, []);
  await page.close();
}

await withBrowser(checkBite);
console.log('PASS: desktop keyboard bite and retry');
