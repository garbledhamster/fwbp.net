import assert from 'node:assert/strict';
import { practicePage, withBrowser } from './browser-qa.mjs';

await withBrowser(async browser => {
  for (const viewport of [{ width: 1280, height: 800 }, { width: 320, height: 720 }, { width: 700, height: 320 }]) {
    const { page, tray, errors, launch, tick } = await practicePage(browser, { viewport, mobile: viewport.width === 320 });
    const nav = page.getByRole('navigation', { name: 'Main', exact: true });
    assert.equal(await nav.evaluate(element => element.scrollWidth <= element.clientWidth), true);
    const game = nav.getByRole('button', { name: 'Ice Fishing with Bryan', exact: true });
    const menu = page.getByRole('dialog', { name: 'Ice Fishing with Bryan', exact: true });
    const picker = page.getByRole('dialog', { name: 'Choose an outing' });
    const start = menu.getByRole('button', { name: 'Start Game', exact: true });
    const exit = menu.getByRole('button', { name: 'Exit Game', exact: true });

    await launch.click();
    await menu.waitFor();
    assert.equal(await picker.isVisible(), false);
    await page.keyboard.press('Escape');
    await menu.waitFor({ state: 'hidden' });
    assert.equal(await launch.evaluate(element => document.activeElement === element), true);

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
    await picker.getByRole('button', { name: 'Tutorial with Bryan', exact: true }).click();
    await tray.waitFor();
    await tick(100);
    assert.match(await tray.innerText(), /Bryan’s practice hole.*Tutorial/s);
    assert.deepEqual(errors, []);
    await page.close();
  }
});
console.log('Title screen, nav, focus return and tutorial entry passed at three viewport sizes.');
