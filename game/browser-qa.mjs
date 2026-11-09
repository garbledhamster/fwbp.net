import assert from 'node:assert/strict';

const defaultUrl = 'http://127.0.0.1:9867/';
const clockStart = Date.UTC(2026, 0, 1);

export function lineDepth(page) {
  return page.locator('.fishing-line-path').evaluate(path =>
    path.getPointAtLength(path.getTotalLength()).y - path.getPointAtLength(0).y);
}

// Standard perch, rock bass, walleye, muskie, perch, rock bass.
const outingSeed = [.05, .35, .55, .98, .05, .35].flatMap(species =>
  [species, .2, .5, .4, .1]);

export async function withBrowser(check) {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH,
    args: ['--mute-audio'],
  });
  try {
    await check(browser);
  } finally {
    await browser.close();
  }
}

export async function practicePage(browser, { mobile = false, viewport, configure, seeded = true, campaignLiveButtons = false } = {}) {
  const page = await browser.newPage({
    viewport: viewport ?? { width: mobile ? 320 : 1200, height: 720 },
    hasTouch: mobile,
    isMobile: mobile,
    reducedMotion: mobile ? 'reduce' : 'no-preference',
  });
  page.setDefaultTimeout(3000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install({ time: clockStart });
  await page.clock.pauseAt(clockStart + 1000);
  if (seeded) await page.addInitScript(seed => {
    let draw = 0;
    Math.random = () => seed[draw++ % seed.length];
  }, outingSeed);
  await configure?.(page);
  const url = new URL(process.env.FISHING_QA_URL ?? defaultUrl);
  if (campaignLiveButtons) url.searchParams.set('campaign-live-buttons', '1');
  const response = await page.goto(url.href, { waitUntil: 'domcontentloaded' });
  assert.ok(response?.ok(), 'the site must load');
  const tray = page.getByRole('region', { name: 'Fishing controls' });
  const button = name => tray.getByRole('button', { name, exact: true });
  const action = tray.locator('.fishing-action');
  const timing = tray.locator('.fishing-timing');
  const launch = page.getByRole('button', { name: 'Play fishing game', exact: true })
    .or(page.getByRole('link', { name: 'Fishing with Bryan, start fishing' }));

  async function press(locator, key = 'Space') {
    // Keyboard focus/touch dispatch do not auto-wait for enabled controls.
    await locator.and(page.locator(':not(:disabled)')).waitFor();
    if (mobile) {
      await locator.scrollIntoViewIfNeeded();
      const box = await locator.boundingBox();
      assert.ok(box, 'a touch control must be in view');
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    } else {
      await locator.focus();
      await page.keyboard.press(key);
    }
  }

  async function closeDialog(dialog, control, key = 'Enter') {
    // Native .close() removes [open] before its close event releases the hold
    // and restores the parent. Observe that event after the source handlers.
    const completion = await dialog.evaluateHandle(el => {
      const state = { closed: false };
      el.addEventListener('close', () => { state.closed = true; }, { once: true });
      return state;
    });
    try {
      await press(control, key);
      await page.waitForFunction(state => state.closed, completion, { polling: 25 });
    } finally {
      await completion.dispose();
    }
  }

  async function closeSavedCatch() {
    const popup = page.locator('.fishing-catch-popup');
    if (await tray.getAttribute('data-mode') !== 'campaign' || !await popup.count()) return;
    await popup.waitFor();
    await closeDialog(popup, popup.locator('[data-reward-close]'));
  }

  async function selectTackle(id) {
    const shop = page.getByRole('dialog', { name: 'Tackle shop' });
    const item = shop.locator(`[data-item="${id}"]`);
    if (await shop.locator('[data-shop-grid]').count() && !await item.isVisible()) {
      const back = shop.locator('[data-shop-grid-back]');
      if (await back.isVisible()) await press(back, 'Enter');
      await press(shop.locator(`[data-shop-select="${id}"]`), 'Enter');
    }
    await item.waitFor();
    return item;
  }

  async function chooseMode(name = 'Practice') {
    const picker = page.getByRole('dialog', { name: 'Choose an outing' });
    await press(picker.getByRole('button', { name, exact: true }), 'Enter');
    if (name === 'Campaign' || name === 'Deep Reef') {
      const map = page.locator('.fishing-map');
      const permit = page.locator('.fishing-permit');
      const drill = page.locator('.fishing-drill');
      const wallet = tray.locator('[data-wallet]');
      await map.waitFor();
      await press(map.locator('[data-map-drill]'), 'Enter');
      await permit.or(drill).or(wallet).filter({ visible: true }).first().waitFor();
      if (await permit.isVisible()) {
        await press(permit.getByRole('button', { name: 'Get this permit' }), 'Enter');
        const shop = page.getByRole('dialog', { name: 'Tackle shop' });
        await press(shop.locator('[data-item="starter-license"]').getByRole('button', { name: /^(?:Buy|Claim) Starter Shore permit$/ }), 'Enter');
        await shop.locator('[data-item="starter-license"]').getByText('Owned', { exact: true }).waitFor();
        await closeDialog(shop, shop.locator('[data-shop-back]'));
        await map.waitFor();
        await press(map.locator('[data-map-drill]'), 'Enter');
        await drill.or(wallet).filter({ visible: true }).first().waitFor();
      }
      if (await drill.isVisible()) await press(drill.locator('[data-drill-skip]'), 'Enter');
      await wallet.waitFor();
    }
    // Both local modes read the saved profile before the outing is ready.
    await tray.locator('[data-exit]:enabled').waitFor();
  }

  async function enter(name = 'Practice') {
    await press(launch, 'Enter');
    await chooseMode(name);
  }

  async function leave() {
    const reward = page.locator('.fishing-catch-popup[open]');
    if (await reward.count()) await closeSavedCatch();
    if (await button('Menu').isVisible()) {
      await press(button('Menu'), 'Enter');
      const pause = page.locator('.fishing-pause');
      await closeDialog(pause, pause.getByRole('button', { name: 'Leave outing', exact: true }));
    } else await press(button('Exit fishing'), 'Enter');
    await tray.waitFor({ state: 'hidden' });
  }

  async function findFish({ species, depthTolerance = 12 } = {}) {
    if (await tray.getAttribute('data-mode') === 'campaign') {
      const swimmers = page.locator(species
        ? `.fishing-swimmer[data-species="${species}"]`
        : '.fishing-swimmer');
      await swimmers.first().waitFor();
      // Aiming is setup for these checks. The jig, hook and reel still use
      // the same player inputs as the rest of the test.
      let alignment;
      for (let attempt = 0; attempt < 18; attempt++) {
        alignment = await swimmers.evaluateAll((fish, tolerance) => {
          const lake = document.querySelector('.lake').getBoundingClientRect();
          const rig = document.querySelector('.fishing-line-rig');
          const lure = new DOMPoint(0, 0).matrixTransform(rig.getScreenCTM());
          const positions = fish.map(el => ({
            x: lake.left + parseFloat(el.style.getPropertyValue('--x')),
            y: lake.top + parseFloat(el.style.getPropertyValue('--y')),
            species: el.dataset.species,
          }));
          const withinReach = positions.filter(fish => Math.abs(fish.x - lure.x) <= lake.width * .54);
          const nearest = withinReach.sort((a, b) => Math.abs(a.y - lure.y) - Math.abs(b.y - lure.y))[0]
            ?? positions.sort((a, b) => Math.abs(a.x - lure.x) - Math.abs(b.x - lure.x))[0];
          const depthGap = nearest.y - lure.y;
          if (Math.abs(depthGap) > tolerance) {
            document.querySelector('.fishing-route').dispatchEvent(new WheelEvent('wheel', {
              deltaY: depthGap / .54, bubbles: true, cancelable: true,
            }));
          }
          return { depthGap, horizontalGap: Math.abs(nearest.x - lure.x), width: lake.width, species: nearest.species };
        }, depthTolerance);
        if (Math.abs(alignment.depthGap) <= depthTolerance && alignment.horizontalGap <= alignment.width * .54) {
          return alignment.species;
        }
        await page.clock.runFor(Math.ceil(Math.abs(alignment.depthGap) / .82) + 650);
      }
      assert.fail(`could not bring the Campaign lure near ${species ?? 'a fish'}: ${JSON.stringify(alignment)}`);
    }
    await page.locator('.fishing-target').evaluate(el => {
      const box = el.getBoundingClientRect();
      window.scrollBy({ top: box.top + box.height / 2 - innerHeight * .35, behavior: 'instant' });
    });
    await page.waitForFunction(() => {
      const button = document.querySelector('.fishing-action');
      return !button.disabled && button.getAttribute('aria-disabled') !== 'true';
    }, null, { polling: 25 });
  }

  async function waitForBite() {
    // Campaign timing starts at the actual bite, after the fish swims to
    // the jig. Advance in frame increments so timing-boundary tests stay exact.
    for (let frame = 0; frame < 150; frame++) {
      if (await timing.isVisible()) return;
      await page.clock.runFor(16);
    }
    assert.fail(`the fish did not bite: ${await tray.getByRole('status').textContent()}`);
  }

  async function reelToHole({ keyboard = false } = {}) {
    let reels = 0;
    for (let move = 0; move < 24; move++) {
      await page.clock.runFor(300);
      const label = await action.textContent();
      if (label === 'Pull up') return reels;
      assert.equal(label, 'Reel', 'the fish is still hooked');
      const cue = await tray.getByRole('status').textContent();
      const tight = /line’s tight/i.test(cue);
      if (!tight) reels++;
      if (keyboard) await page.keyboard.press(tight ? 'l' : 'r');
      else await press(tight ? button('Loosen') : action);
    }
    assert.fail('the fish did not reach the ice hole');
  }

  return {
    page, tray, action, launch, button, press, closeDialog, closeSavedCatch, selectTackle, leave, errors, findFish, chooseMode, enter, reelToHole,
    status: tray.getByRole('status'),
    timing, waitForBite,
    tick: ms => page.clock.runFor(ms),
  };
}
