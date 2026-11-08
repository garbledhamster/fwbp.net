import assert from 'node:assert/strict';
import { practicePage, withBrowser } from './browser-qa.mjs';

async function checkOuting(browser, mobile) {
  const { page, tray, launch, action, button, status, press, tick, findFish, errors } =
    await practicePage(browser, { mobile });
  const countdown = tray.getByRole('timer');
  const target = page.locator('.fishing-target');
  const score = tray.locator('[data-score]');
  const advance = ms => page.clock.fastForward(ms);
  const expectSeconds = async seconds => {
    assert.equal(await countdown.isVisible(), true, 'the seek countdown must be visible');
    assert.match(await countdown.textContent(), new RegExp(`\\b${seconds}\\s*s\\b`));
  };

  await press(launch, 'Enter');
  assert.equal(await action.isDisabled(), true);
  await expectSeconds(30);
  await advance(10000);
  await expectSeconds(20);
  await findFish();
  await press(button('Spoon'));
  await press(action);
  assert.match(await status.textContent(), /different lure/i);
  await expectSeconds(20);
  await advance(19999);
  await expectSeconds(1);
  await advance(1);
  assert.match(await status.textContent(), /fish swam away/i);
  assert.equal(await countdown.isHidden(), true);
  assert.match(await score.textContent(), /0 pts.*1\/6/);
  if (!mobile) {
    assert.match(await target.getAttribute('class'), /is-escaping/);
    await tick(600);
  }
  assert.equal(await target.count(), 0);
  await page.setViewportSize({ width: mobile ? 330 : 1100, height: 720 });
  await tick(100);
  assert.equal(await target.count(), 0, 'resizing must not restore an expired fish');
  assert.match(await status.textContent(), /fish swam away/i);

  for (const seconds of [30, 25, 20, 30, 30]) {
    await press(action); // Next fish after each miss.
    await expectSeconds(seconds);
    await advance(seconds * 1000);
    assert.match(await status.textContent(), /fish swam away/i);
  }
  assert.match(await status.textContent(), /outing complete/i);
  assert.match(await score.textContent(), /0 pts.*6\/6/);
  assert.match(await action.textContent(), /fish again/i);
  assert.match(await tray.locator('.fishing-practice-progress').textContent(), /^0 \/ 20 XP/);

  await press(action);
  await expectSeconds(30);
  await advance(29000);
  await press(button('Exit fishing'));
  assert.equal(await tray.isHidden(), true);
  await press(launch, 'Enter');
  await advance(1000);
  await expectSeconds(29);
  assert.match(await status.textContent(), /scroll.*find/i);
  assert.equal(await target.count(), 1);
  assert.deepEqual(errors, []);
  await page.close();
}

async function checkLateJig(browser) {
  const { page, launch, action, press, findFish, status, timing, errors } = await practicePage(browser);
  await press(launch, 'Enter');
  await findFish();
  // Simulate a late callback by moving wall time without running any timers.
  const started = await page.evaluate(() => Date.now());
  await page.clock.setSystemTime(started + 30000);
  await press(action, 'Enter');
  assert.match(await status.textContent(), /fish swam away/i);
  assert.equal(await timing.isHidden(), true);
  assert.deepEqual(errors, []);
  await page.close();
}

async function checkExpiredOuting(browser) {
  const { page, tray, launch, action, press, status, errors } = await practicePage(browser);
  await press(launch, 'Enter');
  await page.clock.fastForward(20 * 60 * 1000);
  assert.match(await status.textContent(), /outing expired/i);
  assert.match(await action.textContent(), /fish again/i);
  assert.equal(await tray.getByRole('timer').isHidden(), true);
  assert.equal(await page.locator('.fishing-target').count(), 0);
  await press(action, 'Enter');
  assert.match(await tray.getByRole('timer').textContent(), /30s/);
  assert.deepEqual(errors, []);
  await page.close();
}

const checks = [
  ['desktop countdown and escape', browser => checkOuting(browser, false)],
  ['phone countdown and reduced-motion escape', browser => checkOuting(browser, true)],
  ['late Jig before the timer callback', checkLateJig],
  ['return after the entire outing expires', checkExpiredOuting],
];
await withBrowser(async browser => {
  const results = await Promise.allSettled(checks.map(([, check]) => check(browser)));
  for (const [i, result] of results.entries()) {
    if (result.status === 'fulfilled') console.log(`PASS: ${checks[i][0]}`);
    else console.error(`FAIL: ${checks[i][0]}`, result.reason);
  }
  if (results.some(result => result.status === 'rejected')) process.exitCode = 1;
});
