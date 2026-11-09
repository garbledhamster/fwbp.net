import assert from 'node:assert/strict';
import { fishProfiles } from '../assets/fish-profiles.js';
import { withBrowser } from './browser-qa.mjs';

const url = process.env.FISHING_QA_URL ?? 'http://127.0.0.1:9867/';
const viewports = [
  ['desktop', 1200, 720, false],
  ['320px touch', 320, 720, true],
  ['short landscape', 720, 320, true],
];
const contentSections = ['videos', 'field-notes', 'merch'];

await withBrowser(async browser => {
  const gaps = [];
  for (const [name, width, height, touch] of viewports) {
    const page = await browser.newPage({
      viewport: { width, height }, reducedMotion: 'reduce', hasTouch: touch, isMobile: touch,
    });
    page.setDefaultTimeout(3000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
      assert.ok(response?.ok(), 'the site must load');
      await page.locator('#dive .fish-target').first().waitFor();
      const hitTesting = await page.addStyleTag({
        content: '.dive-actor[data-fish] { pointer-events: auto !important; }',
      });
      const fish = await page.locator('.dive-actor[data-fish]').evaluateAll(actors => actors.map((actor, index) => {
        actor.scrollIntoView({ block: 'center', behavior: 'instant' });
        const { left, right, top, bottom, width, height } = actor.getBoundingClientRect();
        const x = left + width / 2;
        const stack = document.elementsFromPoint(x, top + height / 2);
        const ownIndex = stack.findIndex(el => el.closest('.dive-actor') === actor);
        const covered = ownIndex < 0 || stack.slice(0, ownIndex).some(el =>
          el.closest('[data-fish-overlay], .mast, .dive-actor'));
        return {
          index, x: x / innerWidth, key: actor.dataset.fish,
          section: actor.closest('[data-dive]').dataset.dive,
          visible: !covered && width > 0 && height > 0 &&
            left >= 0 && right <= innerWidth && top >= 0 && bottom <= innerHeight,
        };
      }));
      await hitTesting.evaluate(el => el.remove());

      const visible = fish.filter(actor => actor.visible);
      const shallow = visible.filter(actor => ['pike', 'perch'].includes(actor.section));
      if (shallow.length > 5) gaps.push(`${name}: ${shallow.length} fish crowd the first two stretches`);
      if (!shallow.some(actor => actor.x < .4) || !shallow.some(actor => actor.x > .6)) {
        gaps.push(`${name}: shallow fish need room on both sides of the lake`);
      }
      for (const id of contentSections) {
        const section = id === 'videos' ? 'library' : id;
        if (visible.filter(actor => actor.section === section).length < 2) {
          gaps.push(`${name}: missing open water fish around #${id}`);
        }
      }
      const deep = visible.filter(actor => ['bottomfish', 'lakebed', 'lakebed-feature'].includes(actor.section));
      if (!deep.some(actor => actor.x < .4) || !deep.some(actor => actor.x > .6)) {
        gaps.push(`${name}: deep fish need room on both sides of the lake`);
      }

      const representatives = new Map(visible.map(actor => [actor.key, actor]));
      const missing = Object.keys(fishProfiles).filter(key => !representatives.has(key));
      if (missing.length) {
        gaps.push(`${name}: no unobstructed illustration for ${missing.join(', ')}`);
      } else {
        const guide = page.locator('#fish-guide-toggle');
        await guide.click();
        const card = page.locator('#fish-card');
        const allFish = page.locator('.dive-actor[data-fish]');
        for (const [key, profile] of Object.entries(fishProfiles)) {
          const actor = allFish.nth(representatives.get(key).index);
          await (touch ? actor.tap() : actor.click());
          await card.getByRole('heading', { name: profile.name, exact: true }).waitFor();
          await card.getByRole('button', { name: 'Close fish card' }).click();
        }
        await guide.click();
        assert.equal(await page.locator('.fish-target:enabled').count(), 0);
      }
      assert.deepEqual(errors, []);
      console.log(`${name}: ${shallow.length} shallow fish and ${representatives.size} visible species`);
    } finally {
      await page.close();
    }
  }
  assert.deepEqual(gaps, [], 'fish should be visible across the whole site dive');
});
