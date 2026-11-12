import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { practicePage, withBrowser } from './browser-qa.mjs';

const luresBySpecies = {
  perch: 'Jig', 'rock-bass': 'Jig', walleye: 'Minnow',
  pike: 'Spoon', smallmouth: 'Minnow', muskie: 'Spoon',
};

async function checkOuting(browser) {
  const { page, tray, launch, button, press, enter, findFish, waitForBite, tick, closeDialog, reelToHole, errors } =
    await practicePage(browser);
  const meter = page.getByRole('meter', { name: 'Reel feedback' });
  const tapWater = async () => {
    const box = await tray.boundingBox();
    await page.mouse.click(30, box.y * .42);
  };
  const liveActions = tray.locator('.fishing-action, [data-loosen]');
  const lures = tray.getByRole('group', { name: 'Lures' });
  const lureButton = name => lures.getByRole('button', { name, exact: true });
  const pause = page.locator('.fishing-pause');
  const resultButton = name => tray.getByRole('button', { name, exact: true });
  const reward = page.locator('.fishing-catch-popup');
  const map = page.locator('.fishing-map');
  const nextFish = reward.locator('[data-reward-next]');
  const viewCatch = reward.getByRole('button', { name: 'My Lake', exact: true });
  const evidence = process.env.FISHING_EVIDENCE_DIR;
  const savedDay = () => page.evaluate(async () => {
    const { loadProfile } = await import('./game/profile.mjs');
    return (await loadProfile()).day;
  });

  async function capture(label) {
    if (!evidence) return;
    await mkdir(evidence, { recursive: true });
    await page.screenshot({ path: join(evidence, `campaign-tray-desktop-${label}.png`) });
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

    {
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
    assert.match(await pause.innerText(), /tap the water to jig.*keep tapping to reel/i);
    assert.match(await pause.locator('dl').innerText(), /R\s+Set the hook.*reel/i);
    await press(pause.getByRole('button', { name: 'Back to Pause', exact: true }), 'Enter');
    await closeDialog(pause, pause.getByRole('button', { name: 'Resume fishing', exact: true }));

    for (let attempt = 1; attempt <= 6; attempt++) {
      assert.match(await tray.locator('[data-run-progress]').innerText(), new RegExp(`${attempt}/6$`));
      const species = await findFish();
      const lure = luresBySpecies[species];
      assert.ok(lure, `the current fish has a known bait: ${species}`);
      if (attempt === 1) await press(lureButton(lure === 'Spoon' ? 'Jig' : 'Spoon'));
      await press(lureButton(lure));
      assert.equal(await lureButton(lure).getAttribute('aria-pressed'), 'true');
      if (attempt === 1) await capture('jig');
      await tapWater();
      await waitForBite();
      await tick(700);
      await tapWater();
      await meter.waitFor();
      assert.equal(await lureButton(lure).isDisabled(), true, 'bait locks once hooked');
      await assertLiveControlsHidden();
      if (attempt === 1) {
        await capture('fight');
        await page.evaluate(() => {
          const put = IDBObjectStore.prototype.put;
          IDBObjectStore.prototype.put = function (value, ...args) {
            const request = put.call(this, value, ...args);
            if (Object.keys(value?.landedFish ?? {}).length) {
              IDBObjectStore.prototype.put = put;
              queueMicrotask(() => this.transaction.abort());
            }
            return request;
          };
        });
      }
      await reelToHole();
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
        const lake = page.getByRole('dialog', { name: 'My Lake', exact: true });
        await lake.getByRole('heading', { name: species, exact: true }).waitFor();
        await capture('my-lake');
        await closeDialog(lake, lake.getByRole('button', { name: 'Back to catch', exact: true }));
        await nextFish.waitFor();
        assert.equal(await viewCatch.evaluate(el => el === document.activeElement), true,
          'My Lake returns to the same catch');
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
      await tick(300);
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

await withBrowser(checkOuting);
console.log('PASS: six Campaign catches, tap-only fights, save retry, My Lake focus and outing finish');
