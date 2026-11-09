import assert from 'node:assert/strict';
import { practicePage, withBrowser } from './browser-qa.mjs';
import { apply, publicRun, start } from './rules.mjs';

async function checkOuting(browser, mobile) {
  const { enter, page, tray, action, button, status, press, tick, findFish, errors } =
    await practicePage(browser, { mobile });
  const countdown = tray.getByRole('timer');
  const target = page.locator('.fishing-target');
  const score = tray.locator('[data-score]');
  const advance = ms => page.clock.fastForward(ms);
  const expectSeconds = async seconds => {
    assert.equal(await countdown.isVisible(), true, 'the seek countdown must be visible');
    assert.match(await countdown.textContent(), new RegExp(`\\b${seconds}\\s*s\\b`));
  };

  await enter();
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
    await tick(750);
  }
  assert.equal(await target.count(), 0);
  await page.setViewportSize({ width: mobile ? 330 : 1100, height: 720 });
  await tick(100);
  assert.equal(await target.count(), 0, 'resizing must not restore an expired fish');
  assert.match(await status.textContent(), /fish swam away/i);

  // The seeded second encounter draws a walleye at dusk.
  for (const seconds of [25, 25, 20, 30, 30]) {
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
  await leave();
  assert.equal(await tray.isHidden(), true);
  await enter();
  await advance(1000);
  await expectSeconds(29);
  assert.match(await status.textContent(), /scroll.*find/i);
  assert.equal(await target.count(), 1);
  assert.deepEqual(errors, []);
  await page.close();
}

async function checkLateJig(browser) {
  const { leave, enter, page, action, press, findFish, status, timing, errors } = await practicePage(browser);
  await enter();
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

async function checkHeldJig(browser, mobile) {
  const { enter, page, tray, action, press, findFish, status, errors } = await practicePage(browser, { mobile });
  const score = tray.locator('[data-score]');
  await enter();
  await findFish();
  await page.clock.fastForward(29999);
  const touch = mobile ? await page.context().newCDPSession(page) : null;
  if (touch) {
    const box = await action.boundingBox();
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }],
    });
  } else {
    await action.focus();
    await page.keyboard.down('Space');
  }
  await page.clock.fastForward(1);
  assert.match(await action.textContent(), /next fish/i);
  if (touch) await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  else await page.keyboard.up('Space');
  assert.match(await score.textContent(), /1\/6/, 'releasing Jig must leave the missed encounter in place');
  assert.match(await status.textContent(), /fish swam away/i);
  await press(action);
  assert.match(await score.textContent(), /2\/6/, 'a new press can advance to the next fish');
  assert.deepEqual(errors, []);
  await page.close();
}

async function checkRankedDelay(browser) {
  const url = process.env.FISHING_QA_URL ?? 'http://127.0.0.1:9867/';
  const token = 'a'.repeat(43);
  const actions = [];
  let run, holdResponse, releaseResponse;
  const responseHeld = new Promise(resolve => { holdResponse = resolve; });
  const release = new Promise(resolve => { releaseResponse = resolve; });
  const { enter, page, tray, action, press, tick, findFish, errors } = await practicePage(browser, {
    async configure(page) {
      await page.route(url, async route => {
        const response = await route.fetch();
        const body = (await response.text()).replace('<head>', '<head><meta name="fishing-api" content="/ranked-fixture">');
        await route.fulfill({ response, body });
      });
      await page.route('**/ranked-fixture', async route => {
        const { action, version, ...move } = route.request().postDataJSON();
        const now = (await page.evaluate(() => Date.now())) + 2 * 60 * 60 * 1000;
        actions.push(action);
        if (action === 'start') {
          run = start(now, () => 0);
          return route.fulfill({ json: { token, state: publicRun(run), serverNow: now } });
        }
        assert.equal(route.request().headers().authorization, 'Bearer ' + token);
        assert.equal(version, run.version);
        const state = apply(run, { action, ...move }, now);
        if (action === 'jig') {
          holdResponse();
          await release;
        }
        return route.fulfill({ json: { state, serverNow: now } });
      });
    },
  });

  await enter('Ranked');
  await tray.getByText(/Ranked/).waitFor();
  await findFish();
  await tick(10000);
  await press(tray.locator('[data-lure="spoon"]'), 'Enter');
  await press(action, 'Enter');
  await responseHeld;
  await tick(3000);
  const countdown = tray.getByRole('timer');
  assert.match(await countdown.textContent(), /17s/);
  releaseResponse();
  await tray.getByText(/different lure/).waitFor();
  assert.match(await countdown.textContent(), /17s/, 'the delayed ranked response cannot add time');
  await tick(16999);
  assert.deepEqual(actions, ['start', 'jig']);
  await tick(1);
  await tray.getByText(/fish swam away/i).waitFor();
  assert.deepEqual(actions, ['start', 'jig', 'expire']);
  assert.deepEqual(errors, []);
  await page.close();
}

async function checkExpiredOuting(browser) {
  const { enter, page, tray, action, press, status, errors } = await practicePage(browser);
  await enter();
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
  ['held Space release at expiry', browser => checkHeldJig(browser, false)],
  ['held touch release at expiry', browser => checkHeldJig(browser, true)],
  ['delayed ranked response preserves the deadline', checkRankedDelay],
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
