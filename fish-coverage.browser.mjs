import assert from 'node:assert/strict';
import { withBrowser } from './game/browser-qa.mjs';

const url = process.env.FISHING_QA_URL ?? 'http://127.0.0.1:9867/';
const sceneSections = [
  ['#dive', 1], ['#perch', 1], ['#weeds', 1], ['#rocks', 1], ['#camera', 1],
  ['[data-dive="coldwater"]', 1], ['#videos', 3], ['#field-notes', 2], ['#merch', 2],
  ['[data-dive="bottomfish"]', 1], ['.lakebed-feature', 1],
];

await withBrowser(async browser => {
  const failures = [];
  for (const width of [320, 1200]) {
    const page = await browser.newPage({ viewport: { width, height: 720 }, reducedMotion: 'reduce' });
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.locator('.dive-actor[data-fish]').first().waitFor();
      const population = await page.evaluate(() => {
        const actors = [...document.querySelectorAll('.dive-actor[data-fish]')];
        return {
          swimmers: actors.length,
          scriptedPike: document.querySelectorAll('.lure-fish[data-fish="pike"]').length,
          species: new Set(actors.map(actor => actor.dataset.fish)).size,
        };
      });
      console.log(width, population);
      if (population.swimmers > 27) failures.push(`${width}px shows ${population.swimmers} background actors, expected at most 27`);
      assert.equal(population.scriptedPike, 1);
      assert.equal(population.species, 23);
      assert.equal(await page.locator('#motion').isDisabled(), true);
      assert.equal(await page.locator('.dive-actor[data-fish]').first().evaluate(el => getComputedStyle(el).transform), 'none');

      // Let hit testing reveal when foreground content covers the fish. Restore
      // the normal pointer behavior before checking the Fish Guide and game.
      const inspectFish = await page.addStyleTag({
        content: '.dive-actor[data-fish] { pointer-events: auto !important; }',
      });
      for (const [section, expected] of sceneSections) {
        const visible = await page.locator(section).evaluate(async region => {
          const scene = region.closest('[data-dive]');
          const actors = [...scene?.querySelectorAll('.dive-actor[data-fish]') ?? []];
          let visibleCount = 0;
          for (const actor of actors) {
            const sectionBounds = region.getBoundingClientRect();
            const { top, bottom } = actor.getBoundingClientRect();
            if (top < sectionBounds.top || bottom > sectionBounds.bottom) continue;
            actor.scrollIntoView({ block: 'center', behavior: 'instant' });
            await new Promise(resolve => requestAnimationFrame(resolve));
            const box = actor.getBoundingClientRect();
            if (box.left < 0 || box.right > innerWidth) continue;
            const x = box.left + box.width / 2;
            const y = box.top + box.height / 2;
            const stack = document.elementsFromPoint(x, y);
            const fishIndex = stack.findIndex(el => el.closest('.dive-actor') === actor);
            if (fishIndex < 0) continue;
            const covered = stack.slice(0, fishIndex).some(el => el.closest('[data-fish-overlay]'));
            if (!covered) visibleCount++;
          }
          return visibleCount;
        });
        if (visible < expected) failures.push(`${width}px shows ${visible} background fish in ${section}, expected at least ${expected}`);
      }
      await inspectFish.evaluate(element => element.remove());

      await page.evaluate(async () => {
        const { applyProfile } = await import('./game/profile.mjs?v=16');
        await applyProfile({ type: 'award', key: 'coverage-practice:0', mode: 'practice',
          outcome: 'landed', speciesId: 'pike', catch: { points: 35 } });
      });
      const toggle = page.locator('#fish-guide-toggle');
      await toggle.click();
      await page.locator('.fish-target[data-fish="pike"]:enabled').first().waitFor();
      assert.equal(await page.locator('#field-notes [data-fish-overlay]').isVisible(), false);
      assert.equal(await page.locator('.fish-target:enabled').evaluateAll(targets =>
        targets.every(target => target.dataset.fish === 'pike')), true);
      assert.equal(await page.locator('.fish-target:not([data-fish="pike"]):not([hidden])').count(), 0);
      await page.locator('#dive .fish-target[data-fish="pike"]').first().click();
      const card = page.getByRole('dialog');
      await card.waitFor();
      await card.getByRole('button', { name: 'Close fish card' }).click();
      await toggle.click();
      assert.equal(await page.locator('#field-notes [data-fish-overlay]').isVisible(), true);

      await page.getByRole('button', { name: 'Play fishing game' }).click();
      await page.getByRole('button', { name: 'Practice', exact: true }).click();
      await page.getByRole('button', { name: 'Exit fishing' }).click();
      assert.equal(await page.getByRole('button', { name: 'Play fishing game' }).isVisible(), true);

      await page.emulateMedia({ reducedMotion: 'no-preference' });
      const motion = page.locator('#motion');
      const fish = page.locator('#videos .dive-actor[data-fish]').first();
      await page.getByRole('button', { name: 'Reduce motion', pressed: false }).waitFor();
      assert.notEqual(await fish.evaluate(el => getComputedStyle(el).transform), 'none');
      await motion.click();
      assert.equal(await motion.getAttribute('aria-pressed'), 'true');
      assert.equal(await fish.evaluate(el => getComputedStyle(el).transform), 'none');
    } finally {
      await page.close();
    }
  }
  assert.deepEqual(failures, [], 'Fish population and open-water coverage');
});
