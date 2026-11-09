import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { practicePage, withBrowser } from './browser-qa.mjs';

const luresBySpecies = {
  perch: 'Jig', 'rock-bass': 'Jig', walleye: 'Minnow',
  pike: 'Spoon', smallmouth: 'Minnow', muskie: 'Spoon',
};

async function checkOuting(browser, mobile) {
  const { page, tray, launch, button, press, enter, findFish, waitForBite, tick, closeDialog, errors } =
    await practicePage(browser, { mobile });
  const touch = mobile && await page.context().newCDPSession(page);
  const marker = page.locator('[data-line-gesture-marker]');
  const up = marker.locator('[data-line-gesture-up]');
  const down = marker.locator('[data-line-gesture-down]');
  const lureAction = marker.locator('button');
  const liveActions = tray.locator('.fishing-action, [data-loosen]');
  const lures = tray.getByRole('group', { name: 'Lures' });
  const lureButton = name => lures.getByRole('button', { name, exact: true });
  const pause = page.locator('.fishing-pause');
  const resultButton = name => tray.getByRole('button', { name, exact: true });
  const reward = page.locator('.fishing-catch-popup');
  const map = page.locator('.fishing-map');
  const nextFish = reward.locator('[data-reward-next]');
  const viewCatch = reward.getByRole('button', { name: 'View in Your Lake', exact: true });
  const advanceInput = () => Promise.all([tick(300), page.waitForTimeout(180)]);
  const evidence = process.env.FISHING_EVIDENCE_DIR;
  const savedDay = () => page.evaluate(async () => {
    const { loadProfile } = await import('./game/profile.mjs');
    return (await loadProfile()).day;
  });

  async function capture(label) {
    if (!evidence) return;
    await mkdir(evidence, { recursive: true });
    await page.screenshot({ path: join(evidence, `campaign-tray-${mobile ? 'phone' : 'desktop'}-${label}.png`) });
  }

  async function stroke(direction) {
    const box = await tray.boundingBox();
    assert.ok(box, 'the stroke has a visible start area');
    const x = 30;
    const y = Math.max(75, box.y * .52);
    if (!touch) {
      await page.mouse.move(x, y);
      await page.mouse.wheel(0, direction * 100);
      await page.waitForTimeout(25);
      return;
    }
    const dispatch = (type, touchPoints) => touch.send('Input.dispatchTouchEvent', { type, touchPoints });
    await dispatch('touchStart', [{ x, y }]);
    for (let step = 1; step <= 4; step++) {
      await page.waitForTimeout(23);
      await dispatch('touchMove', [{ x, y: y + direction * 16 * step }]);
    }
    await dispatch('touchEnd', []);
  }

  async function assertLiveControlsHidden() {
    assert.equal(await liveActions.count(), 2, 'both existing live controls still have definitions');
    for (const control of await liveActions.all()) {
      assert.equal(await control.boundingBox(), null, 'live actions have no visible or clickable box');
      assert.equal(await control.evaluate(el => {
        el.focus();
        return el === document.activeElement;
      }), false, 'a hidden live action cannot take focus');
    }
  }

  async function assertBaitTargets() {
    for (const name of ['Jig', 'Spoon', 'Minnow']) {
      const bounds = await lureButton(name).boundingBox();
      assert.ok(bounds?.width >= 44 && bounds.height >= 44, `${name} has a full-size target`);
      assert.ok(await lureButton(name).evaluate(el => {
        const { x, y, width, height } = el.getBoundingClientRect();
        return el.contains(document.elementFromPoint(x + width / 2, y + height / 2));
      }), `${name} is in the hit-test path`);
    }
  }

  try {
    await page.evaluate(() => {
      // Use small fish so this replay exercises saves and the hole transition.
      const rolls = [.05, .05, .4].flatMap(species => [species, .2, .5, .1, .1]);
      let draw = 0;
      Math.random = () => rolls[draw++ % rolls.length];
    });
    await enter('Campaign');
    const openedDay = await savedDay();
    assert.equal(openedDay?.opened.length, 1, 'the outing starts with one saved hole');
    await assertLiveControlsHidden();
    await assertBaitTargets();
    await page.evaluate(() => {
      window.campaignTraySaves = [];
      document.addEventListener('fishing:catch-saved', ({ detail }) => window.campaignTraySaves.push(detail.key));
    });
    const saves = () => page.evaluate(() => window.campaignTraySaves);

    if (!mobile) {
      await button('Menu').focus();
      const visited = new Set();
      for (let step = 0; step < 12; step++) {
        await page.keyboard.press('Tab');
        const focus = await page.evaluate(() => ({
          live: document.activeElement.matches('.fishing-action, [data-loosen]'),
          lure: document.activeElement.dataset.lure,
        }));
        assert.equal(focus.live, false, 'Tab skips live action controls');
        if (focus.lure) visited.add(focus.lure);
      }
      assert.deepEqual([...visited], ['jig', 'spoon', 'minnow'], 'Tab reaches all three bait slots');
    }

    await press(button('Menu'), 'Enter');
    await press(pause.getByRole('button', { name: 'Controls', exact: true }), 'Enter');
    assert.match(await pause.innerText(), /click or tap the jig.*set the hook/i);
    assert.match(await pause.locator('dl').innerText(), /R\s+Set the hook.*reel.*pull up/i);
    await press(pause.getByRole('button', { name: 'Back to Pause', exact: true }), 'Enter');
    await closeDialog(pause, pause.getByRole('button', { name: 'Resume fishing', exact: true }));

    for (let attempt = 1; attempt <= 6; attempt++) {
      assert.match(await tray.locator('[data-run-progress]').innerText(), new RegExp(`${attempt}/6$`));
      const species = await findFish();
      await marker.getByRole('button', { name: 'Jig lure' }).waitFor();
      assert.equal(await up.isVisible(), false, 'the jig has no callout');
      const lure = luresBySpecies[species];
      assert.ok(lure, `the current fish has a known bait: ${species}`);
      if (attempt === 1) await press(lureButton(lure === 'Spoon' ? 'Jig' : 'Spoon'));
      await press(lureButton(lure));
      assert.equal(await lureButton(lure).getAttribute('aria-pressed'), 'true');
      if (attempt === 1) await capture('jig');
      await (mobile ? lureAction.tap() : lureAction.click());
      await waitForBite();
      assert.equal(await lureAction.getAttribute('aria-disabled'), 'true', 'the lure waits for gold');
      await tick(700);
      await marker.getByRole('button', { name: 'Set hook' }).waitFor();
      await (mobile ? lureAction.tap() : lureAction.click());
      assert.equal(await lureButton(lure).isDisabled(), true, 'bait locks once hooked');
      await assertLiveControlsHidden();

      for (let strokeCount = 0; strokeCount < 30; strokeCount++) {
        await advanceInput();
        assert.equal(await down.isVisible(), true,
          `catch ${attempt}, stroke ${strokeCount}: ${await tray.getByRole('status').textContent()}`);
        if (await up.isVisible() && /Pull up/.test(await up.innerText())) break;
        await stroke(await up.isVisible() ? -1 : 1);
      }
      await up.filter({ hasText: /Pull up/ }).waitFor();
      if (attempt === 1) {
        await capture('pull-up');
        await page.evaluate(() => {
          const original = IDBDatabase.prototype.transaction;
          IDBDatabase.prototype.transaction = function (stores, mode, ...options) {
            const transaction = original.call(this, stores, mode, ...options);
            if (mode === 'readwrite') {
              IDBDatabase.prototype.transaction = original;
              queueMicrotask(() => transaction.abort());
            }
            return transaction;
          };
        });
      }
      await stroke(-1);
      await marker.waitFor({ state: 'hidden' });
      if (attempt === 1) {
        const save = resultButton('Save catch');
        await save.waitFor();
        assert.deepEqual(await saves(), [], 'a failed write has no saved catch');
        assert.equal(await reward.isVisible(), false, 'the reward opens only after a successful save');
        await capture('retry');
        await press(save, 'Enter');
      }
      await nextFish.waitFor();
      assert.equal(await nextFish.textContent(), attempt === 6 ? 'Finish outing' : attempt === 3 ? 'Move hole' : 'Next fish');
      const savedKeys = await saves();
      assert.equal(savedKeys.length, attempt, 'each landed fish saves once');
      assert.equal(new Set(savedKeys).size, attempt, 'each landed fish has its own catch key');
      if (attempt === 1) {
        await capture('saved');
        const species = await reward.getByRole('heading').innerText();
        await press(viewCatch, 'Enter');
        const lake = page.getByRole('dialog', { name: 'Your Lake', exact: true });
        await lake.getByRole('heading', { name: species, exact: true }).waitFor();
        await capture('your-lake');
        await closeDialog(lake, lake.getByRole('button', { name: 'Back to catch', exact: true }));
        await nextFish.waitFor();
        assert.equal(await viewCatch.evaluate(el => el === document.activeElement), true,
          'Your Lake returns to the same catch');
      }
      await closeDialog(reward, nextFish);
      if (attempt === 3) {
        await map.waitFor();
        assert.equal(await map.locator('[data-map-drill]').isDisabled(), true, 'the fished-out hole stays quiet');
        await press(map.locator('[data-map-cell="E4"]'), 'Enter');
        await press(map.locator('[data-map-drill]'), 'Enter');
        await press(page.locator('[data-drill-skip]'), 'Enter');
        await map.waitFor({ state: 'hidden' });
        await tray.locator('[data-water]').filter({ hasText: 'E4' }).waitFor();
      }
      await advanceInput();
    }
    await tray.getByRole('status').filter({ hasText: 'Outing complete.' }).waitFor();
    const deadline = Date.now() + 3000;
    let remainingDay = await savedDay();
    while (remainingDay && Date.now() < deadline) {
      await page.waitForTimeout(25);
      remainingDay = await savedDay();
    }
    assert.equal(remainingDay, undefined, 'Finish outing clears the saved day before Fish again');
    await press(resultButton('Fish again'), 'Enter');
    await tray.waitFor({ state: 'hidden' });
    await map.waitFor();
    await press(map.locator('[data-map-back]'), 'Enter');
    const picker = page.getByRole('dialog', { name: 'Choose an outing' });
    await picker.waitFor();
    await page.keyboard.press('Escape');
    await picker.waitFor({ state: 'hidden' });
    await launch.waitFor();
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
}

await withBrowser(async browser => {
  for (const mobile of [false, true]) {
    await checkOuting(browser, mobile);
    console.log(`PASS: six Campaign catches with hidden live buttons, save retry and Your Lake return (${mobile ? '320×720 touch' : '1200×720 wheel'})`);
  }
});
