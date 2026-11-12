import assert from 'node:assert/strict';
import { practicePage, withBrowser } from './browser-qa.mjs';

await withBrowser(async browser => {
  for (const viewport of [{ width: 1280, height: 800 }, { width: 320, height: 720 }, { width: 700, height: 320 }]) {
    const { page, tray, errors, launch: game, tick } = await practicePage(browser, { viewport, mobile: viewport.width === 320 });
    const nav = page.getByRole('navigation', { name: 'Main', exact: true });
    assert.equal(await nav.evaluate(element => element.scrollWidth <= element.clientWidth), true);
    const menu = page.getByRole('dialog', { name: 'Ice Fishing with Bryan', exact: true });
    const picker = page.getByRole('dialog', { name: 'Choose an outing' });
    const start = menu.getByRole('button', { name: 'Start Game', exact: true });
    const exit = menu.getByRole('button', { name: 'Exit Game', exact: true });

    const preview = page.getByRole('tooltip');
    if (viewport.width === 320) {
      const touch = await page.context().newCDPSession(page);
      const box = await game.boundingBox();
      const touchPoints = [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }];
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints });
      await tick(550);
      await preview.waitFor();
      await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      assert.equal(await preview.isVisible(), true);
      assert.equal(await menu.isVisible(), false);
      await page.touchscreen.tap(12, 220);
      await preview.waitFor({ state: 'hidden' });
      await game.tap();
    } else {
      await game.hover();
      await preview.waitFor();
      assert.match(await preview.innerText(), /free to play.*jigging.*Mille Lacs map.*another chance.*waiting for a bite/);
      await preview.hover();
      assert.equal(await preview.isVisible(), true);
      await page.keyboard.press('Escape');
      await preview.waitFor({ state: 'hidden' });
      await page.mouse.move(0, 0);
      await game.focus();
      await preview.waitFor();
      await page.keyboard.press('Enter');
    }
    await menu.waitFor();
    assert.equal(await picker.isVisible(), false);
    assert.equal(await preview.isVisible(), false);
    await page.keyboard.press('Escape');
    await menu.waitFor({ state: 'hidden' });
    assert.equal(await game.evaluate(element => document.activeElement === element), true);

    assert.equal(await nav.getByRole('link', { name: 'Merch', exact: true }).getAttribute('href'), '#merch');
    assert.equal(await nav.getByRole('link', { name: 'YouTube', exact: true }).getAttribute('href'), 'https://www.youtube.com/@BryanProkuski');
    await game.click();
    assert.equal(await start.evaluate(element => document.activeElement === element), true);
    await exit.click();
    await menu.waitFor({ state: 'hidden' });
    assert.equal(await game.evaluate(element => document.activeElement === element), true);

    await game.click();
    await start.click();
    await picker.waitFor();
    assert.equal(await menu.isVisible(), false);
    const openTutorial = picker.getByRole('button', { name: 'Tutorial', exact: true });
    const tutorial = page.getByRole('dialog', { name: 'Tutorial', exact: true });
    assert.equal(await picker.getByRole('button', { name: 'Practice', exact: true }).count(), 0);
    await openTutorial.click();
    await tutorial.waitFor();
    assert.equal(await tutorial.getByRole('heading', { name: 'Tutorial', exact: true }).evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('Escape');
    await picker.waitFor();
    assert.equal(await openTutorial.evaluate(el => el === document.activeElement), true);
    await openTutorial.click();
    await tutorial.getByRole('button', { name: 'Tutorial with Bryan', exact: true }).click();
    await tray.waitFor();
    await tick(100);
    assert.match(await tray.innerText(), /Bryan’s practice hole.*Tutorial/s);
    assert.deepEqual(errors, []);
    await page.close();
  }
});
await withBrowser(async browser => {
  for (const reducedMotion of ['no-preference', 'reduce']) {
    const page = await browser.newPage({
      reducedMotion,
      viewport: { width: reducedMotion === 'reduce' ? 390 : 1280, height: 840 },
    });
    await page.goto(process.env.FISHING_QA_URL ?? 'http://127.0.0.1:9867/', { waitUntil: 'domcontentloaded' });
    const surface = page.locator('#surface');
    const entry = surface.getByRole('button', { name: 'Enter Ice Fishing with Bryan through the ice hole' });
    const splash = page.getByRole('dialog', { name: 'Ice Fishing with Bryan' });
    await entry.click();
    if (reducedMotion === 'no-preference') await surface.locator('xpath=self::*[@data-game-descent]').waitFor();
    await splash.waitFor();
    assert.equal(await surface.getAttribute('data-game-descent'), null);
    assert.equal(await splash.getAttribute('data-from-ice'), '');
    await splash.getByRole('button', { name: 'Exit Game' }).click();
    assert.equal(await entry.evaluate(element => element === document.activeElement), true);
    await entry.click();
    await splash.getByRole('button', { name: 'Start Game' }).click();
    await page.getByRole('dialog', { name: 'Choose an outing' }).waitFor();
    await page.close();
  }
});
console.log('Navigation and ice hole entry, reduced motion, focus return and tutorial passed.');
