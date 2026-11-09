import assert from 'node:assert/strict';
import { practicePage, withBrowser } from './browser-qa.mjs';

await withBrowser(async browser => {
  for (const mode of ['Campaign', 'Practice']) {
    for (const viewport of [
      { width: 1200, height: 720 },
      { width: 320, height: 720 },
      { width: 720, height: 320 },
    ]) {
      const mobile = viewport.width !== 1200;
      const { leave, page, action, enter, findFish, button, press, tick, errors } = await practicePage(browser, { mobile });
      await page.setViewportSize(viewport);
      const ambient = page.locator('.fishing-background-fish');
      assert.equal(await ambient.filter({ visible: true }).count(), 0, 'the site keeps its own illustrated fish');

      await enter(mode);
      const water = await page.locator('.lake > .dive:visible').evaluateAll(bands => bands.map(band =>
        [...band.querySelectorAll('.fishing-background-fish')].filter(fish =>
          fish.getClientRects().length && getComputedStyle(fish).visibility === 'visible')
          .map(fish => {
            const { left, right, width, top, height } = fish.getBoundingClientRect();
            return { left, right, width, center: (left + width / 2) / innerWidth, y: top + height / 2,
              decorative: fish.getAttribute('aria-hidden') === 'true'
                && getComputedStyle(fish).pointerEvents === 'none' };
          })));
      assert.equal(water.length, mode === 'Campaign' ? 2 : 7, 'the water ends at the selected hole depth in Campaign');
      assert.ok(water.every(band => band.length > 0), 'background fish appear through every playable band');
      assert.ok(water.flat().some(fish => fish.center < .35) && water.flat().some(fish => fish.center > .65),
        'background fish use both sides of the lake');
      assert.ok(water.flat().every(fish => fish.decorative && fish.left >= 0 && fish.right <= viewport.width),
        'background fish stay inside the water and are decorative');

      const target = page.locator('.fishing-target');
      await target.waitFor();
      const targetBand = await target.evaluate(fish => [...fish.parentElement.parentElement.children]
        .filter(row => row.matches('.dive')).indexOf(fish.parentElement));
      const scenery = water[targetBand === 0 ? 1 : 0][0];
      await page.evaluate(y => {
        const openWater = document.querySelector('.fishing-tray').getBoundingClientRect().top;
        scrollTo({ top: scrollY + y - openWater / 2, behavior: 'instant' });
      }, scenery.y);
      await tick(64);
      assert.equal(await action.isDisabled(), true, 'a visible background fish does not enable Jig');
      await findFish();
      assert.equal(await target.count(), 1);
      assert.equal(await action.isEnabled(), true);
      const cue = await target.evaluate(fish => getComputedStyle(fish, '::before').content);
      assert.equal(cue, '""', 'the active fish has a distinct marker while searching');
      const active = await target.boundingBox();
      assert.ok(water.flat().every(fish => fish.width < active.width), 'the active fish is larger than the background fish');

      await leave();
      assert.equal(await ambient.filter({ visible: true }).count(), 0, 'leaving restores the illustrated site');
      assert.deepEqual(errors, []);
      await page.close();
      console.log(`PASS: ${mode} lake coverage and active fish at ${viewport.width}×${viewport.height}`);
    }
  }
});
