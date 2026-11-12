import assert from 'node:assert/strict';
import { join } from 'node:path';
import { practicePage, withBrowser } from './browser-qa.mjs';

async function checkTutorial(browser, input) {
  const mobile = input === 'touch' || input === 'landscape';
  const viewport = input === 'landscape' ? { width: 720, height: 320 } : undefined;
  const { page, tray, action, button, status, enter, press, tick, waitForBite, errors } =
    await practicePage(browser, { mobile, viewport });
  const baseline = await page.evaluate(async () => {
    const { applyProfile, loadProfile } = await import('./game/profile.mjs');
    const initial = await loadProfile();
    const { profile: withPermit } = await applyProfile({ type: 'buy', id: 'starter-license', revision: initial.revision });
    const { profile } = await applyProfile({ type: 'begin-day' });
    if (!withPermit.owned.includes('starter-license')) throw new Error('The tutorial fixture needs a Mille Lacs permit.');
    return (await applyProfile({ type: 'open-hole', dayId: profile.day.id, cellId: 'A3', elapsedMs: profile.elapsedMs })).profile;
  });
  const readSave = () => page.evaluate(async () => (await import('./game/profile.mjs')).loadProfile());
  const cue = () => status.textContent();
  const marker = page.locator('[data-line-gesture-marker]');
  const balance = marker.getByRole('meter', { name: 'Line balance' });
  const touch = mobile && await page.context().newCDPSession(page);
  const capture = async stage => {
    if (process.env.FISHING_EVIDENCE_DIR) {
      await page.screenshot({ path: join(process.env.FISHING_EVIDENCE_DIR, `tutorial-${input}-${stage}.png`) });
    }
  };
  async function gesture(direction, distance = 100) {
    const box = await tray.boundingBox();
    const x = 35;
    const y = Math.max(50, box.y / 2);
    if (!touch) {
      await page.mouse.move(x, y);
      await page.mouse.wheel(0, direction * distance);
    } else {
      const send = (type, touchPoints) => touch.send('Input.dispatchTouchEvent', { type, touchPoints });
      const length = Math.min(distance, Math.max(40, Math.floor(box.y / 2) - 10));
      await send('touchStart', [{ x, y }]);
      for (const part of [.25, .5, .75, 1]) {
        await send('touchMove', [{ x, y: y + part * direction * length }]);
      }
      await send('touchEnd', []);
    }
    await page.waitForTimeout(30);
  }

  await enter('Tutorial with Bryan');
  await tick(100);
  assert.match(await tray.innerText(), /Bryan’s practice hole.*Tutorial/s);
  assert.equal(await tray.getByRole('timer').isVisible(), false);
  assert.deepEqual(baseline.day.opened, ['A3']);
  await page.locator('.fishing-swimmer[data-species="perch"]').waitFor();
  for (let stroke = 0; stroke < 12 && /bring the lure near/i.test(await cue()); stroke++) {
    const down = /(?:scroll|swipe) down/i.test(await cue());
    if (input === 'keyboard') await page.keyboard.press(down ? 'ArrowDown' : 'ArrowUp');
    else await gesture(down ? 1 : -1, 65);
    await tick(460);
  }
  const workLure = async () => {
    if (/coming in/i.test(await cue())) return;
    assert.match(await cue(), /to jig/i);
    if (input === 'keyboard') await page.keyboard.press('j');
    else await gesture(-1, 42);
  };
  await workLure();
  await waitForBite();
  assert.match(await cue(), /wait for.*gold/i);
  const setHook = async () => {
    if (input === 'keyboard') await page.keyboard.press('r');
    else await press(marker.locator('button'));
  };
  if (input === 'wheel') {
    await tick(5400);
    assert.match(await cue(), /missed gold/i);
    await setHook();
    await tick(350);
    assert.match(await cue(), /try again/i);
    await workLure();
    await waitForBite();
  }
  await tick(1000);
  assert.match(await cue(), /gold!.*set the hook/i);
  await capture('gold');
  await setHook();
  await balance.waitFor();
  assert.match(await balance.getAttribute('aria-valuetext'), /tight/i);
  assert.match(await cue(), /down.*loosen/i);
  const guide = await marker.locator('[data-fight-guide]').boundingBox();
  const fish = await page.locator('.fishing-target.is-hooked').boundingBox();
  assert.ok(guide.x + guide.width <= fish.x - 11, 'the line balance guide leaves a gap beside the perch');
  await capture('tight');
  const fightMove = direction => input === 'keyboard'
    ? page.keyboard.press(direction > 0 ? 'l' : 'r') : gesture(direction);
  if (input === 'wheel') {
    await tick(320);
    await fightMove(-1);
    assert.match(await cue(), /line snapped.*try again/i);
    assert.match(await balance.getAttribute('aria-valuetext'), /tight/i);
  }
  await tick(350);
  await fightMove(1);
  assert.doesNotMatch(await balance.getAttribute('aria-valuetext'), /tight/i);
  for (let move = 0; move < 14 && !(await cue()).includes('Tutorial complete'); move++) {
    await tick(320);
    await fightMove((await balance.getAttribute('aria-valuetext')).includes('Tight') ? 1 : -1);
  }
  assert.match(await cue(), /landed a yellow perch/i);
  assert.match(await cue(), /tutorial complete/i);
  await capture('landed');
  assert.deepEqual(await readSave(), baseline, 'practice does not save a catch, award, or time');
  if (input === 'wheel') {
    await press(button('Replay tutorial'));
    await tick(100);
    assert.doesNotMatch(await cue(), /tutorial complete/i);
    await press(button('Skip tutorial'));
  } else await press(action);
  await page.locator('.fishing-map').waitFor();
  assert.deepEqual(await readSave(), baseline, 'the map opens the same Campaign day');
  assert.deepEqual(errors, []);
  await page.close();
}

await withBrowser(async browser => {
  for (const input of ['wheel', 'touch', 'landscape', 'keyboard']) {
    await checkTutorial(browser, input);
    console.log(`PASS Bryan’s tutorial from the outing picker to a landed perch and Campaign map (${input})`);
  }
});
