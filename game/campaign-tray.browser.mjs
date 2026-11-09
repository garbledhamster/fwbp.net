import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { practicePage, withBrowser } from './browser-qa.mjs';

const luresBySymbol = {
  'bi-perch': 'Jig', 'rock-bass': 'Jig', 'bi-walleye': 'Minnow',
  'pike': 'Spoon', 'bass': 'Minnow', 'muskie': 'Spoon',
};

async function checkOuting(browser, mobile) {
  const { page, tray, launch, button, press, enter, findFish, tick, closeDialog, errors } =
    await practicePage(browser, { mobile });
  const touch = mobile && await page.context().newCDPSession(page);
  const marker = page.locator('[data-line-gesture-marker]');
  const up = marker.locator('[data-line-gesture-up]');
  const down = marker.locator('[data-line-gesture-down]');
  const liveActions = tray.locator('.fishing-action, [data-loosen]');
  const lures = tray.getByRole('group', { name: 'Lures' });
  const lureButton = name => lures.getByRole('button', { name, exact: true });
  const pause = page.locator('.fishing-pause');
  const resultButton = name => tray.getByRole('button', { name, exact: true });
  const reward = page.locator('.fishing-catch-popup');
  const nextFish = reward.locator('[data-reward-next]');
  const viewCatch = reward.getByRole('button', { name: 'View in Your Lake', exact: true });
  const advanceInput = () => Promise.all([tick(300), page.waitForTimeout(180)]);
  const evidence = process.env.FISHING_EVIDENCE_DIR;

  async function capture(label) {
    if (!evidence) return;
    await mkdir(evidence, { recursive: true });
    await page.screenshot({ path: join(evidence, `campaign-tray-${mobile ? 'phone' : 'desktop'}-${label}.png`) });
  }

  async function stroke(direction, atMarker = false) {
    const box = await (atMarker ? marker : tray).boundingBox();
    assert.ok(box, 'the stroke has a visible start area');
    const x = atMarker ? box.x + box.width / 2 : 30;
    const y = atMarker ? box.y + box.height / 2 : Math.max(75, box.y * .52);
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
    await enter('Campaign');
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
    assert.match(await pause.innerText(), /scroll or swipe up.*jig or set the hook/i);
    assert.match(await pause.locator('dl').innerText(), /R\s+Set the hook.*reel.*pull up/i);
    await press(pause.getByRole('button', { name: 'Back to Pause', exact: true }), 'Enter');
    await closeDialog(pause, pause.getByRole('button', { name: 'Resume fishing', exact: true }));

    for (let attempt = 1; attempt <= 6; attempt++) {
      assert.match(await tray.locator('[data-run-progress]').innerText(), new RegExp(`${attempt}/6$`));
      await findFish();
      await up.filter({ hasText: /Jig/ }).waitFor();
      assert.equal(await down.isVisible(), false, 'search only shows the upward guide');
      const art = (await page.locator('.fishing-target use').getAttribute('href')).split('#').at(-1)
        .replace(/^fwbp-(?:lake-life|fish|scenes)-/, '');
      const lure = luresBySymbol[art];
      assert.ok(lure, `the current fish has known art: ${art}`);
      if (attempt === 1) await press(lureButton(lure === 'Spoon' ? 'Jig' : 'Spoon'));
      await press(lureButton(lure));
      assert.equal(await lureButton(lure).getAttribute('aria-pressed'), 'true');
      if (attempt === 1) await capture('jig');
      await stroke(-1, true);
      assert.equal(await up.isVisible(), false, 'the marker withholds the hook arrow while waiting for gold');
      await tick(700);
      await up.filter({ hasText: /Set hook/ }).waitFor();
      assert.equal(await down.isVisible(), false, 'the bite only shows the upward guide');
      await stroke(-1, true);
      assert.equal(await lureButton(lure).isDisabled(), true, 'bait locks once hooked');
      await assertLiveControlsHidden();

      for (let strokeCount = 0; strokeCount < 30; strokeCount++) {
        await advanceInput();
        await down.filter({ hasText: /Loosen/ }).waitFor();
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
        await press(save, 'Enter');
      }
      await nextFish.waitFor();
      assert.equal(await nextFish.textContent(), attempt === 6 ? 'Finish outing' : 'Next fish');
      const savedKeys = await saves();
      assert.equal(savedKeys.length, attempt, 'each landed fish saves once');
      assert.equal(new Set(savedKeys).size, attempt, 'each landed fish has its own catch key');
      if (attempt === 1) {
        await capture('saved');
        await press(viewCatch, 'Enter');
        const lake = page.getByRole('dialog', { name: 'Your Lake', exact: true });
        await lake.waitFor();
        await closeDialog(lake, lake.getByRole('button', { name: 'Back to catch', exact: true }));
        await nextFish.waitFor();
        assert.equal(await viewCatch.evaluate(el => el === document.activeElement), true,
          'Your Lake returns to the same catch');
      }
      await press(nextFish, 'Enter');
      await advanceInput();
    }
    await press(tray.getByRole('button', { name: 'Fish again', exact: true }), 'Enter');
    assert.equal(await tray.isVisible(), false, 'the sixth result returns to the map');
    const map = page.locator('.fishing-map');
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
