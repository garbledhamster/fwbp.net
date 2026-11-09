import assert from 'node:assert/strict';

const defaultUrl = 'http://127.0.0.1:9867/';
const clockStart = Date.UTC(2026, 0, 1);

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

export async function practicePage(browser, { mobile = false, viewport, configure } = {}) {
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
  await page.addInitScript(seed => {
    let draw = 0;
    Math.random = () => seed[draw++ % seed.length];
  }, outingSeed);
  await configure?.(page);
  const response = await page.goto(process.env.FISHING_QA_URL ?? defaultUrl, { waitUntil: 'domcontentloaded' });
  assert.ok(response?.ok(), 'the site must load');
  const tray = page.getByRole('region', { name: 'Fishing controls' });
  const button = name => tray.getByRole('button', { name, exact: true });
  const action = tray.locator('.fishing-action');
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

  async function chooseMode(name = 'Practice') {
    const picker = page.getByRole('dialog', { name: 'Choose an outing' });
    await press(picker.getByRole('button', { name, exact: true }), 'Enter');
    if (name === 'Campaign' || name === 'Deep Reef') {
      const map = page.locator('.fishing-map');
      const permit = page.locator('.fishing-permit');
      await map.waitFor();
      await press(map.locator('[data-map-drill]'), 'Enter');
      await page.waitForFunction(() => document.querySelector('.fishing-permit[open], .fishing-drill[open]'));
      if (await permit.isVisible()) {
        await press(permit.getByRole('button', { name: 'Get this permit' }), 'Enter');
        const shop = page.getByRole('dialog', { name: 'Tackle shop' });
        await press(shop.locator('[data-item="starter-license"]').getByRole('button', { name: /^(?:Buy|Claim) Starter Shore permit$/ }), 'Enter');
        await shop.locator('[data-item="starter-license"]').getByText('Owned', { exact: true }).waitFor();
        await closeDialog(shop, shop.locator('[data-shop-back]'));
        await map.waitFor();
        await press(map.locator('[data-map-drill]'), 'Enter');
      }
      await press(page.locator('[data-drill-skip]'), 'Enter');
      await tray.locator('[data-wallet]').waitFor();
    }
    // Both local modes read the saved profile before the outing is ready.
    await tray.locator('[data-exit]:enabled').waitFor();
  }

  async function enter(name = 'Practice') {
    await press(launch, 'Enter');
    await chooseMode(name);
  }

  async function leave() {
    if (await button('Menu').isVisible()) {
      await press(button('Menu'), 'Enter');
      const pause = page.locator('.fishing-pause');
      await closeDialog(pause, pause.getByRole('button', { name: 'Leave outing', exact: true }));
    } else await press(button('Exit fishing'), 'Enter');
  }

  async function findFish() {
    await page.locator('.fishing-target').evaluate(el => {
      const box = el.getBoundingClientRect();
      window.scrollBy({ top: box.top + box.height / 2 - innerHeight * .35, behavior: 'instant' });
    });
    await page.waitForFunction(() => {
      const button = document.querySelector('.fishing-action');
      return !button.disabled && button.getAttribute('aria-disabled') !== 'true';
    }, null, { polling: 25 });
  }

  async function reelToHole() {
    let reels = 0;
    for (let move = 0; move < 24; move++) {
      await page.clock.runFor(300);
      const label = await action.textContent();
      if (label === 'Pull up') return reels;
      assert.equal(label, 'Reel', 'the fish is still hooked');
      const cue = await tray.getByRole('status').textContent();
      const tight = /line’s tight/i.test(cue);
      if (!tight) reels++;
      await press(tight ? button('Loosen') : action);
    }
    assert.fail('the fish did not reach the ice hole');
  }

  return {
    page, tray, action, launch, button, press, closeDialog, leave, errors, findFish, chooseMode, enter, reelToHole,
    status: tray.getByRole('status'),
    timing: tray.locator('.fishing-timing'),
    tick: ms => page.clock.runFor(ms),
  };
}
