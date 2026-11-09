import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { practicePage, withBrowser } from './browser-qa.mjs';

// Catches broken catch→card→video return, premature credit, lost study state,
// parent-pause release, duplicate payouts and accidental next-outing gear application.
async function connected(browser, viewport, mobile) {
  const { page, tray, action, status, launch, enter, leave, press, tick, findFish, reelToHole, errors } =
    await practicePage(browser, { mobile, viewport, configure: async page => {
      // Playback availability is separately audited against public YouTube. Here a
      // blocked embed exercises our real dialog, public fallback and cleanup.
      await page.route('https://www.youtube-nocookie.com/embed/**', route => route.abort());
    } });
  const saved = () => page.evaluate(async () =>
    (await import('./game/profile.mjs?v=connected-rpg')).loadProfile());
  const seed = roll => page.evaluate(roll => {
    const values = [roll, .2, .5, .4, .1];
    let index = 0;
    Math.random = () => values[index++ % values.length];
  }, roll);
  const selected = () => tray.locator('[data-lure][aria-pressed="true"]').getAttribute('data-lure');
  const lake = page.locator('#your-lake');
  const player = page.locator('#player');
  const pause = page.locator('.fishing-pause');
  const view = tray.getByRole('button', { name: 'View in Your Lake', exact: true });
  const capture = async name => {
    if (!process.env.FISHING_EVIDENCE_DIR) return;
    await mkdir(process.env.FISHING_EVIDENCE_DIR, { recursive: true });
    await page.screenshot({ path: join(process.env.FISHING_EVIDENCE_DIR,
      `connected-${viewport.width}x${viewport.height}-${name}.png`), animations: 'disabled' });
  };
  const onscreen = async control => {
    await control.scrollIntoViewIfNeeded();
    const box = await control.boundingBox();
    assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 &&
      box.y + box.height <= viewport.height + 1, 'the connected action stays within the viewport');
    if (mobile) assert.ok(box.width >= 44 && box.height >= 44, 'touch action has a 44px target');
  };
  async function land(lure = 'Minnow', fail = false) {
    await findFish();
    await press(tray.getByRole('group', { name: 'Lures' }).getByRole('button', { name: lure, exact: true }));
    await press(action);
    await tick(700);
    await press(action);
    await reelToHole();
    if (fail) await page.evaluate(() => {
      const transaction = IDBDatabase.prototype.transaction;
      IDBDatabase.prototype.transaction = function (...args) {
        const tx = transaction.apply(this, args);
        if (args[1] === 'readwrite') {
          IDBDatabase.prototype.transaction = transaction;
          queueMicrotask(() => tx.abort());
        }
        return tx;
      };
    });
    await press(action);
  }

  // The empty collection is reached from the site's ordinary player entry.
  await press(page.locator('#fish-guide-toggle'), 'Enter');
  await page.locator('.fish-mode-hint').filter({ hasText: /0 \/ 6/ }).waitFor();
  assert.equal(await page.locator('.fish-target:visible').count(), 0);
  await press(page.locator('#fish-guide-toggle'), 'Enter');
  await seed(.55); // Walleye in the shipped day pool; no profile/award injection.
  await enter('Campaign'); // Real officer → free permit → selected area → outing.
  assert.ok((await saved()).owned.includes('starter-license'));
  await land('Minnow', true);
  await action.filter({ hasText: 'Save catch' }).waitFor();
  assert.equal(await view.isVisible(), false, 'a failed save cannot claim a collection entry');
  const unsaved = await saved();
  assert.equal(unsaved.coins, 0);
  assert.deepEqual(unsaved.caughtSpecies, []);
  await press(action);
  await view.waitFor();
  assert.equal(await action.textContent(), 'Next fish');
  const credited = await saved();
  assert.equal(credited.coins, 25);
  assert.deepEqual(credited.caughtSpecies, ['walleye']);
  assert.equal(Object.keys(credited.awards).length, 1);
  const result = await status.textContent();
  assert.equal(await selected(), 'minnow');
  await capture('saved-catch');
  await onscreen(action);
  await onscreen(tray.locator('[data-bryan-video]'));
  await onscreen(view);
  await press(view);
  await lake.getByRole('heading', { name: 'Walleye', exact: true }).waitFor();
  await press(lake.getByRole('button', { name: 'Learn this tip', exact: true }));
  await lake.getByRole('button', { name: 'Tip learned', exact: true }).waitFor();
  await capture('studied-card');
  const watch = lake.locator('[data-bryan-video]');
  await onscreen(watch);
  await press(watch, 'Enter');
  await player.waitFor();
  assert.match(await player.locator('iframe').getAttribute('src'), /Elu9m3JcOEM/);
  assert.match(await player.locator('#player-source').getAttribute('href'), /watch\?v=Elu9m3JcOEM/);
  await tick(60000);
  await capture('video-fallback');
  await press(player.getByRole('button', { name: 'Close video', exact: true }));
  await player.locator('iframe').waitFor({ state: 'detached' });
  assert.equal(await player.locator('iframe').count(), 0);
  assert.equal(await watch.evaluate(el => el === document.activeElement), true);
  assert.equal(await lake.getByRole('heading', { name: 'Walleye', exact: true }).isVisible(), true);
  await press(lake.getByRole('button', { name: 'Return to outing', exact: true }));
  await lake.waitFor({ state: 'detached' });
  assert.equal(await view.evaluate(el => el === document.activeElement), true);
  assert.equal(await status.textContent(), result, 'return keeps the same landed result');
  assert.equal(await selected(), 'minnow');
  assert.deepEqual((await saved()).awards, credited.awards);
  assert.equal((await saved()).coins, 25);
  assert.equal((await saved()).elapsedMs, credited.elapsedMs, 'nested browsing consumes no Campaign time');

  // Catch entry uses the same player and returns to its own exact trigger.
  const catchWatch = tray.locator('[data-bryan-video]');
  await press(catchWatch, 'Enter');
  await press(player.getByRole('button', { name: 'Close video', exact: true }));
  await player.locator('iframe').waitFor({ state: 'detached' });
  assert.equal(await catchWatch.evaluate(el => el === document.activeElement), true);
  await press(action); // Later fish, same outing and lure; newly studied cue appears.
  await tick(300);
  await findFish();
  await page.locator('.fishing-studied-cue').filter({ hasText: /Minnow/ }).waitFor();
  assert.equal(await selected(), 'minnow');
  await press(tray.getByRole('button', { name: 'Menu', exact: true }));
  const pauseLake = pause.getByRole('button', { name: 'Your Lake', exact: true });
  const timer = await tray.getByRole('timer').textContent();
  await press(pauseLake);
  await lake.getByRole('heading', { name: 'Your Lake', exact: true }).waitFor();
  await tick(60000);
  await press(lake.getByRole('button', { name: 'Return to outing', exact: true }));
  await lake.waitFor({ state: 'detached' });
  assert.equal(await pause.isVisible(), true, 'collection leaves the original Pause open');
  assert.equal(await pauseLake.evaluate(el => el === document.activeElement), true);
  await tick(60000);
  assert.equal(await tray.getByRole('timer').textContent(), timer, 'parent Pause still owns its hold');
  await press(pause.getByRole('button', { name: 'Tackle shop', exact: true }));
  const shop = page.locator('.fishing-shop');
  const stronger = shop.locator('[data-item="stronger-line"]');
  await press(stronger.getByRole('button', { name: 'Buy Stronger line', exact: true }));
  await press(stronger.getByRole('button', { name: 'Equip Stronger line', exact: true }));
  await press(shop.getByRole('button', { name: 'Back to Pause', exact: true }));
  await press(pause.getByRole('button', { name: 'Gear', exact: true }));
  assert.match(await pause.locator('.fishing-loadout').textContent(), /This outing.*Starter line.*Next Campaign outing.*Stronger line/s);
  await capture('next-outing-gear');
  await press(pause.getByRole('button', { name: 'Back to Pause', exact: true }));
  await press(pause.getByRole('button', { name: 'Resume fishing', exact: true }));
  assert.equal(await selected(), 'minnow');
  await leave();
  await page.reload({ waitUntil: 'domcontentloaded' });
  const returning = await saved();
  assert.equal(returning.coins, 15);
  assert.equal(returning.equipped.line, 'stronger-line');
  assert.deepEqual(returning.studiedSpecies, ['walleye']);
  assert.deepEqual(returning.awards, credited.awards);
  await press(page.locator('#fish-guide-toggle'), 'Enter');
  await page.locator('.fish-mode-hint').filter({ hasText: /1 \/ 6/ }).waitFor();
  await press(page.locator('.fish-target[data-fish="walleye"]:visible').first(), 'Enter');
  const siteCard = page.locator('#fish-card');
  const siteWatch = siteCard.locator('[data-bryan-video]');
  await press(siteWatch, 'Enter');
  await press(player.getByRole('button', { name: 'Close video', exact: true }));
  await player.locator('iframe').waitFor({ state: 'detached' });
  assert.equal(await siteWatch.evaluate(el => el === document.activeElement), true);
  assert.equal(await siteCard.getByRole('heading', { name: 'Walleye', exact: true }).isVisible(), true);
  await press(siteCard.getByRole('button', { name: 'Close fish card', exact: true }));
  await press(page.locator('#fish-guide-toggle'), 'Enter');
  await seed(.05); // Unsupported exact-species video: yellow perch.
  await enter('Campaign');
  await land('Jig');
  await view.waitFor();
  assert.equal(await tray.locator('[data-bryan-video]').count(), 0);
  await press(view);
  await lake.getByRole('heading', { name: 'Yellow perch', exact: true }).waitFor();
  assert.equal(await lake.locator('[data-bryan-video]').count(), 0);
  assert.equal(await lake.getByRole('link', { name: 'Species reference' }).count(), 1);
  await press(lake.getByRole('button', { name: 'Return to outing', exact: true }));
  await leave();
  assert.equal(await launch.isVisible(), true);
  assert.deepEqual(errors, []);
  await page.close();
}

await withBrowser(async browser => {
  for (const [viewport, mobile] of [
    [{ width: 1200, height: 720 }, false],
    [{ width: 320, height: 720 }, true],
    [{ width: 720, height: 320 }, true],
  ]) {
    await connected(browser, viewport, mobile);
    console.log(`PASS: connected outing ${viewport.width}×${viewport.height}`);
  }
});
