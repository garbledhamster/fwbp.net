import assert from 'node:assert/strict';
import { practicePage, withBrowser } from './browser-qa.mjs';

async function checkBite(browser) {
  const { page, launch, action, status, timing, press, tick, errors, findFish } = await practicePage(browser);
  const keyboard = page.keyboard;
  const cue = () => status.textContent();
  await press(launch, 'Enter');
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
  assert.match(await cue(), /yellow perch.*\+10 points/i);
  assert.equal(await action.evaluate(el => el === document.activeElement), true);
  await keyboard.press('Escape');
  assert.equal(await launch.evaluate(el => el === document.activeElement), true);
  await press(launch, 'Enter');
  await findFish();
  await keyboard.press('Tab');
  for (let i = 0; i < 3; i++) await keyboard.press('Tab');
  await keyboard.press('Space');
  assert.match(await cue(), /wait for gold/i);
  await keyboard.press('Escape');
  await press(launch, 'Enter');
  await tick(2200);
  assert.match(await cue(), /scroll.*find the fish/i);
  assert.equal(await timing.isHidden(), true);
  assert.deepEqual(errors, []);
  await page.close();
}

async function checkFight(browser) {
  const { page, launch, action, status, button, tray, press, tick, errors, findFish } =
    await practicePage(browser, { mobile: true });
  const cue = () => status.textContent();
  const color = control => control.evaluate(el => getComputedStyle(el).backgroundColor);
  const loosen = button('Loosen');
  await press(launch);
  await findFish();
  const gold = await color(action);
  for (const fish of [/yellow perch.*\+10 points/i, /rock bass.*\+15 points/i]) {
    await press(action);
    await tick(600);
    await press(action);
    assert.match(await cue(), fish);
    await press(action); // Next fish, skipping any skill.
    await tick(260);
    await findFish();
  }
  await press(button('Minnow'));
  await press(action);
  await tick(600);
  await press(action);
  assert.match(await cue(), /tight line.*loosen/i);
  assert.equal(await color(loosen), gold, 'Loosen gets the gold emphasis');
  assert.notEqual(await color(action), gold, 'Reel stays available but loses emphasis');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  const positions = async () => (await Promise.all([action.boundingBox(), loosen.boundingBox()]))
    .map(({ x, y, width }) => [x, y, width]);
  const tightPositions = await positions();

  await press(action); // A standard walleye can survive one bad pull.
  assert.match(await cue(), /tight line.*loosen/i);
  await tick(260);
  await press(action); // A second bad pull snaps the line.
  assert.match(await cue(), /line snapped.*jig/i);
  assert.equal(await loosen.isHidden(), true);
  await tick(260);
  await press(action);
  await tick(600);
  await press(action);
  await press(loosen);
  assert.match(await cue(), /line clear.*reel/i);
  assert.equal(await color(action), gold);
  assert.deepEqual(await positions(), tightPositions);
  await press(action);
  assert.match(await cue(), /give the line a moment/i);
  await tick(260);
  await press(action);
  assert.match(await cue(), /tight line.*loosen/i);
  await tick(260);
  await press(loosen);
  assert.match(await cue(), /line clear.*pull up/i);
  assert.match(await action.textContent(), /pull up/i);
  assert.equal(await color(action), gold);
  assert.deepEqual(await positions(), tightPositions);
  await tick(260);
  await press(action);
  assert.match(await cue(), /walleye.*\+25 points/i);
  assert.match(await tray.locator('[data-score]').textContent(), /50 pts/);
  await press(button('Exit fishing'));
  assert.equal(await tray.isHidden(), true);
  assert.deepEqual(errors, []);
  await page.close();
}

const checks = [['desktop keyboard bite and retry', checkBite], ['320px reduced-motion touch fight', checkFight]];
await withBrowser(async browser => {
  const results = await Promise.allSettled(checks.map(([, check]) => check(browser)));
  for (const [i, result] of results.entries()) {
    if (result.status === 'fulfilled') console.log(`PASS: ${checks[i][0]}`);
    else console.error(`FAIL: ${checks[i][0]}`, result.reason);
  }
  if (results.some(result => result.status === 'rejected')) process.exitCode = 1;
});
