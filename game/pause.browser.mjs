import assert from 'node:assert/strict';
import { practicePage, withBrowser } from './browser-qa.mjs';

// Catches wall-clock expiry, fight sampling and shortcuts running behind menus.
await withBrowser(async browser => {
  for (const mobile of [false, true]) {
    const { page, tray, action, enter, findFish, tick, press, reelToHole, errors } = await practicePage(browser, { mobile });
    // Scheduled work retains its remaining delay, even when queued or cancelled
    // during a nested hold. This also covers retraction and swim-away callbacks.
    await page.evaluate(async () => {
      const { createSuspensionClock } = await import('./game/suspension.mjs');
      const clock = createSuspensionClock();
      window.clockFixture = { clock, events: [] };
      clock.timeout(() => window.clockFixture.events.push('timeout'), 100);
      window.clockFixture.interval = clock.interval(() => window.clockFixture.events.push('interval'), 80);
    });
    await tick(40);
    await page.evaluate(() => {
      const fixture = window.clockFixture;
      fixture.releaseA = fixture.clock.acquire();
      fixture.releaseB = fixture.clock.acquire();
      fixture.frozen = [fixture.clock.now(), fixture.clock.dateNow()];
      fixture.clock.frame(() => fixture.events.push('frame'));
      fixture.clock.timeout(() => fixture.events.push('new'), 30);
      fixture.clock.cancel(fixture.clock.timeout(() => fixture.events.push('cancelled'), 20));
    });
    await tick(60000);
    await page.evaluate(() => { window.clockFixture.releaseA(); window.clockFixture.releaseA(); });
    await tick(60000);
    assert.deepEqual(await page.evaluate(() => {
      const { clock, frozen, events } = window.clockFixture;
      return { sameTime: clock.now() === frozen[0] && clock.dateNow() === frozen[1], events };
    }), { sameTime: true, events: [] });
    await page.evaluate(() => window.clockFixture.releaseB());
    await tick(29);
    assert.deepEqual(await page.evaluate(() => window.clockFixture.events), ['frame']);
    await tick(2);
    assert.deepEqual(await page.evaluate(() => window.clockFixture.events), ['frame', 'new']);
    await tick(50);
    assert.deepEqual(await page.evaluate(() => window.clockFixture.events), ['frame', 'new', 'interval', 'timeout']);
    await page.evaluate(() => window.clockFixture.clock.clearInterval(window.clockFixture.interval));
    await enter();
    const menu = tray.locator('[data-exit]');
    const pause = page.getByRole('dialog', { name: 'Paused' });
    const snapshot = () => tray.evaluate(el => ({
      countdown: el.querySelector('.fishing-countdown').textContent,
      phase: el.querySelector('[data-phase]').textContent,
      position: el.querySelector('.fishing-timing').style.getPropertyValue('--position'),
      load: el.querySelector('meter').value,
      lure: el.querySelector('[data-lure][aria-pressed="true"]').dataset.lure,
      action: el.querySelector('.fishing-action').textContent,
      fish: document.querySelector('.fishing-target')?.className ?? null,
    }));
    async function dwell(duration = 60000) {
      await press(menu);
      const before = await snapshot();
      await page.keyboard.press('j');
      await page.keyboard.press('r');
      await page.keyboard.press('l');
      await page.keyboard.press('3');
      await tick(duration);
      assert.deepEqual(await snapshot(), before, 'Pause freezes stage, time, lure and tension');
      await press(pause.getByRole('button', { name: 'Resume fishing', exact: true }));
      assert.equal(await menu.evaluate(el => el === document.activeElement), true, 'resume restores the opener');
    }
    await findFish();
    // Native dialogs supplied by another feature (including #player) must also
    // suppress keys; the shared guard cannot depend on a particular menu class.
    const guarded = await snapshot();
    await page.evaluate(() => {
      const dialog = document.createElement('dialog');
      dialog.id = 'external-dialog-fixture';
      dialog.innerHTML = '<button>Close footage</button>';
      document.body.append(dialog);
      dialog.showModal();
    });
    await page.keyboard.press('j');
    await page.keyboard.press('3');
    await page.keyboard.press('Escape');
    assert.deepEqual(await snapshot(), guarded);
    await page.evaluate(() => document.querySelector('#external-dialog-fixture').remove());
    // Menu dwell longer than the entire outing must not expire the run.
    await dwell(20 * 60 * 1000 + 1000);
    await page.keyboard.press('2');
    assert.equal(await tray.locator('[data-lure="spoon"]').getAttribute('aria-pressed'), 'true');
    await page.keyboard.press('1');
    await page.keyboard.press('j');
    await tick(650);
    await dwell();
    await page.keyboard.press('r');
    await tray.locator('.fishing-pressure').waitFor();
    await dwell();
    const load = await tray.locator('meter').evaluate(el => el.value);
    await tick(600);
    assert.notEqual(await tray.locator('meter').evaluate(el => el.value), load, 'fight resumes normally');

    // Independent callers, including video, cannot resume another caller’s pause.
    await page.evaluate(async () => {
      const { acquireSuspension } = await import(document.querySelector('script[src*="/game/fishing.mjs"]').src);
      window.pauseReleaseA = acquireSuspension();
      window.pauseReleaseB = acquireSuspension();
    });
    const nested = await snapshot();
    await tick(60000);
    await page.evaluate(() => { window.pauseReleaseA(); window.pauseReleaseA(); });
    await tick(60000);
    assert.deepEqual(await snapshot(), nested, 'idempotent release leaves the second suspension held');
    await page.evaluate(() => window.pauseReleaseB());
    await press(menu);
    await press(pause.getByRole('button', { name: 'Controls', exact: true }));
    await page.keyboard.press('Escape');
    assert.equal(await pause.isVisible(), true, 'nested Escape returns to Pause');
    await page.keyboard.press('Escape');
    assert.equal(await tray.isVisible(), true, 'Escape resumes without exiting');

    // Finish this fish and preserve its landed result without advancing it.
    await reelToHole();
    await press(action);
    await page.waitForFunction(() => !document.querySelector('[data-exit]').disabled);
    assert.match(await action.textContent(), /Next fish/);
    await dwell();
    await press(action);
    await findFish();
    await page.keyboard.press('2');
    for (let i = 0; i < 3; i++) { await page.keyboard.press('j'); await tick(300); }
    assert.equal(await page.locator('.fishing-target.is-escaping').count(), 1);
    await dwell();
    await tick(500);
    assert.equal(await page.locator('.fishing-target').count(), 0, 'pending swim-away removal completes only after resuming');
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('PASS: local Pause preserves search, bite, fight and nested suspension');
});
