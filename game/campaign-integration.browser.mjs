import assert from 'node:assert/strict';
import { lineDepth, practicePage, withBrowser } from './browser-qa.mjs';

async function playfieldInput(browser, viewport, mobile) {
  const { page, enter, tick, errors } = await practicePage(browser, { viewport, mobile });
  await enter('Campaign');
  const surface = page.locator('.fishing-route');
  const spoon = page.getByRole('button', { name: 'Spoon', exact: true });
  const minnow = page.getByRole('button', { name: 'Minnow', exact: true });
  const reelUp = page.getByRole('button', { name: 'Reel up', exact: true });
  await spoon.click();
  assert.equal(await spoon.getAttribute('aria-pressed'), 'true');
  const start = await lineDepth(page);
  if (mobile) {
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, y) => cdp.send('Input.dispatchTouchEvent', {
      type, touchPoints: y === undefined ? [] : [{ x: 36, y }],
    });
    await touch('touchStart', 78);
    await tick(25);
    await touch('touchMove', 138);
    await tick(25);
    const held = await lineDepth(page);
    assert.ok(held - start > 45 && held - start < 65, 'the hook follows the finger during a drag');
    await touch('touchMove', 178);
    await touch('touchEnd');
    const released = await lineDepth(page);
    await tick(250);
    assert.ok(await lineDepth(page) > released + 35, 'a fast touch flick coasts after release');
  } else {
    await page.mouse.move(36, 78);
    await page.mouse.down();
    await page.mouse.move(36, 158, { steps: 4 });
    const held = await lineDepth(page);
    assert.ok(held - start > 75 && held - start < 85, 'mouse drag changes depth continuously');
    await page.mouse.up();
    await page.mouse.wheel(0, 280);
    await tick(450);
    assert.ok(await lineDepth(page) > held + 90, 'the wheel lowers the hook');
  }
  await surface.locator('.campaign-scene canvas').waitFor();
  const framing = await page.locator('.fishing-line-rig').evaluate(rig => ({
    y: new DOMPoint().matrixTransform(rig.getScreenCTM()).y,
    target: document.querySelector('.fishing-tray').getBoundingClientRect().top / 2,
    scroll: scrollY,
  }));
  assert.ok(Math.abs(framing.y - framing.target) < 2);
  assert.equal(framing.scroll, 0);
  assert.equal(await minnow.isEnabled(), false);
  await page.keyboard.press('3');
  assert.equal(await spoon.getAttribute('aria-pressed'), 'true', 'keyboard shortcuts cannot swap a submerged lure');
  await reelUp.click();
  await tick(2000);
  assert.ok(Math.abs(await lineDepth(page) - start) < 1, 'the line returns to the ice before the lure unlocks');
  assert.equal(await reelUp.isVisible(), false);
  await minnow.click();
  assert.equal(await minnow.getAttribute('aria-pressed'), 'true');
  assert.deepEqual(errors, []);
  await page.close();
}

await withBrowser(async browser => {
  await playfieldInput(browser, { width: 1200, height: 800 }, false);
  await playfieldInput(browser, { width: 360, height: 740 }, true);
  console.log('PASS: Campaign entry, mouse drag, wheel, touch flick and hook-following camera');
});

async function catchPerch(browser, { viewport, mobile = false, trophy = false, saveEvidence = false, escape = false }) {
  const { page, enter, findFish, waitForBite, tick, timing, press, closeDialog, errors } = await practicePage(browser, { viewport, mobile });
  const spot = trophy ? 'C4' : 'A3';
  await page.evaluate(async ({ spot, trophy }) => {
    const { applyProfile, loadProfile } = await import('./game/profile.mjs');
    const profile = await loadProfile();
    await applyProfile({ type: 'buy', id: 'starter-license', revision: profile.revision });
    const { profile: { day } } = await applyProfile({ type: 'begin-day' });
    const { profile: opened } = await applyProfile({ type: 'open-hole', dayId: day.id, cellId: spot });
    // The saved roster makes the same real hole replayable without relying
    // on unrelated random draws from the site or scene boot.
    opened.day.rosters[spot] = ['perch', 'pike', 'walleye'].map((speciesId, lane) => ({
      key: `${spot}:0:${lane}`, lane, speciesId, sizeRoll: trophy ? .95 : .4, colorRoll: .1,
    }));
    await new Promise((resolve, reject) => {
      const request = indexedDB.open('fwbp-campaign', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('profile', 'readwrite');
        tx.objectStore('profile').put(opened, 'campaign');
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onabort = () => { db.close(); reject(tx.error); };
      };
    });
  }, { spot, trophy });
  const tap = async () => {
    const y = await page.locator('.fishing-tray').evaluate(el => el.getBoundingClientRect().top * .43);
    await (mobile ? page.touchscreen.tap(38, y) : page.mouse.click(38, y));
  };
  const capture = async name => {
    if (saveEvidence && process.env.FISHING_SCREENSHOTS) {
      await page.screenshot({ path: `${process.env.FISHING_SCREENSHOTS}/${name}.png` });
    }
  };
  await enter('Campaign', spot);
  await findFish({ species: 'perch' });
  await tap();
  await waitForBite();
  const meter = page.getByRole('meter', { name: 'Reel feedback' });
  const callout = page.locator('.fishing-bryan-callout');
  await tick(350);
  assert.equal(await meter.isVisible(), false, 'an early tap begins inside the buffer');
  await tap();
  await tick(225);
  await meter.waitFor();
  assert.equal(await timing.isVisible(), false);
  await callout.getByText('Keep jigging!', { exact: true }).waitFor();
  if (escape) {
    await page.evaluate(() => { Math.random = () => .1; });
    await tick(4000);
    await page.getByText('The fish got away.', { exact: true }).waitFor();
    assert.equal(await meter.isVisible(), false);
    assert.equal(await page.locator('.fishing-catch-popup').isVisible(), false);
    await page.getByRole('button', { name: 'Next fish', exact: true }).click();
    assert.match(await page.locator('[data-run-progress]').textContent(), /0 pts · 2\/6/);
    await page.close();
    return;
  }
  await capture(trophy ? 'trophy-fight' : viewport.width > viewport.height ? 'landscape-fight' : 'standard-fight');

  const attachment = () => page.locator('.fishing-target').evaluate(fish => {
    const box = fish.getBoundingClientRect();
    const scale = parseFloat(fish.style.getPropertyValue('--fight-facing'));
    const mouth = {
      x: box.left + box.width * (.5 + (16 / 172 - .5) * scale),
      y: box.top + box.height * 37 / 66,
    };
    const rig = document.querySelector('.fishing-line-rig');
    const hook = new DOMPoint().matrixTransform(rig.getScreenCTM());
    return Math.hypot(hook.x - mouth.x, hook.y - mouth.y);
  });
  assert.ok(await attachment() < 1, 'the hook tip starts in the fish’s mouth');
  // Confirm a player who stops tapping gives line to the fish.
  const beforePause = await lineDepth(page);
  await tick(500);
  assert.ok(await attachment() < 1, 'the tip stays in the mouth through the dive');
  assert.ok(await lineDepth(page) > beforePause + 8, 'the hooked fish takes line during a pause');
  await page.evaluate(() => { Math.random = () => .2; });
  await tap();
  assert.equal(await meter.getAttribute('data-outcome'), 'hold');
  await page.evaluate(() => { Math.random = () => .46; });
  await tap();
  assert.equal(await meter.getAttribute('data-outcome'), 'slip');
  await page.evaluate(() => { Math.random = () => .92; });
  await tap();
  assert.equal(await meter.getAttribute('data-outcome'), 'reel');

  const catchDialog = page.locator('.fishing-catch-popup');
  let taps = 0;
  for (; taps < 145 && !await catchDialog.isVisible(); taps++) {
    await tick(trophy ? 220 : 300);
    if (!await catchDialog.isVisible()) await tap();
  }
  await catchDialog.waitFor();
  assert.equal(await catchDialog.getAttribute('data-grade'), trophy ? 'trophy' : 'standard');
  for (const label of ['Size', 'Age', 'Quality', 'Grade', 'Hook', 'Line']) {
    await catchDialog.getByText(label, { exact: true }).waitFor();
  }
  assert.equal(await callout.isVisible(), false);
  await capture(trophy ? 'trophy-catch' : viewport.width > viewport.height ? 'landscape-catch' : 'phone-catch');
  const wallet = page.locator('.fishing-tray [data-wallet]');
  assert.equal(await wallet.textContent(), '0 coins', 'Campaign coins wait for the My Lake claim');
  const before = await lineDepth(page);
  await page.keyboard.press('r');
  assert.equal(await lineDepth(page), before, 'the modal blocks gameplay input');

  await press(catchDialog.getByRole('button', { name: 'My Lake', exact: true }), 'Enter');
  const lake = page.getByRole('dialog', { name: 'My Lake', exact: true });
  const collect = lake.getByRole('button', { name: 'Collect Reward', exact: true });
  await press(collect, 'Enter');
  await page.waitForFunction(() => document.querySelector('.fishing-tray [data-wallet]').textContent !== '0 coins', null, { polling: 25 });
  const reference = lake.locator('[data-source]');
  assert.equal(await reference.getAttribute('target'), '_blank');
  assert.match(await reference.getAttribute('href'), /dnr\.state\.mn\.us/);
  await capture(trophy ? 'trophy-my-lake' : viewport.width > viewport.height ? 'landscape-my-lake' : 'phone-my-lake');
  await closeDialog(lake, lake.locator('[data-close]'));
  await closeDialog(catchDialog, catchDialog.locator('[data-reward-next]'));
  await page.getByRole('button', { name: 'Jig', exact: true }).and(page.locator(':enabled')).waitFor();
  assert.deepEqual(errors, []);
  await page.close();
  return taps;
}

await withBrowser(async browser => {
  const standard = await catchPerch(browser, { viewport: { width: 360, height: 740 }, mobile: true, saveEvidence: true });
  const trophy = await catchPerch(browser, { viewport: { width: 1200, height: 800 }, trophy: true, saveEvidence: true });
  await catchPerch(browser, { viewport: { width: 740, height: 360 }, mobile: true, saveEvidence: true });
  await catchPerch(browser, { viewport: { width: 390, height: 700 }, mobile: true, escape: true });
  assert.ok(trophy > standard * 1.4, `the trophy needs more taps (${trophy} vs ${standard})`);
  console.log(`PASS: standard (${standard} taps) and trophy (${trophy} taps) through Campaign, catch and My Lake on desktop and phone`);
});
