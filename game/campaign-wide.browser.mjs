import assert from 'node:assert/strict';
import { practicePage, withBrowser } from './browser-qa.mjs';

await withBrowser(async browser => {
  for (const width of [1200, 1920, 3440]) {
    const { page, enter, tick, timing, findFish, errors } = await practicePage(browser, {
      viewport: { width, height: 900 },
    });
    try {
      if (width === 3440) await page.emulateMedia({ reducedMotion: 'reduce' });
      // This pool contains one jig fish. The perch swims in the far-left lane.
      await page.evaluate(() => { Math.random = () => .3; });
      await enter('Campaign');
      const perch = page.locator('.fishing-swimmer[data-species="perch"][data-candidate="0"]');
      await perch.waitFor();
      await tick(500);
      await findFish({ species: 'perch' });
      await page.keyboard.press('j');
      for (let frame = 0; frame < 150 && !await timing.isVisible(); frame++) await tick(16);
      assert.ok(await timing.isVisible(),
        `the only perch must bite after a jig at its depth at ${width}px`);
      await page.locator('.fishing-target[data-species="perch"]').waitFor();
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px: left-lane perch reached the jig`);
    } finally {
      await page.close();
    }
  }
});
