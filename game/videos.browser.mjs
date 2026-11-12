import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { withBrowser } from './browser-qa.mjs';

const url = process.env.FISHING_QA_URL ?? 'http://127.0.0.1:9867/';
const viewports = [{ width: 1200, height: 800 }, { width: 320, height: 720 }, { width: 720, height: 320 }];
const matched = [
  ['walleye', 'Elu9m3JcOEM'], ['pike', 'gIUtx-C9pKs'],
  ['smallmouth', 'KL0F_23RvBo'], ['muskie', 'W41Btej9DnI'],
];
const references = [
  ['perch', 'https://www.dnr.state.mn.us/minnaqua/speciesprofile/yellowperch.html'],
  ['rock-bass', 'https://mdc.mo.gov/discover-nature/field-guide/northern-rock-bass'],
];

test('a game video card opens exact footage in a new tab and keeps its parent dialog open', async () => {
  await withBrowser(async browser => {
    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport, hasTouch: viewport.width === 320, reducedMotion: 'reduce' });
      page.setDefaultTimeout(4000);
      try {
        await page.context().route('https://www.youtube.com/watch?**', route =>
          route.fulfill({ body: '<title>YouTube watch page</title>', contentType: 'text/html' }));
        await page.route('https://www.youtube-nocookie.com/**', route => route.abort());
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        const dialog = page.locator('#fish-card');
        await dialog.evaluate(async el => {
          const { fillSpeciesCard } = await import('./game/collection.mjs');
          const frame = el.querySelector('.fish-card-frame');
          frame.innerHTML = '<div data-species-card></div>';
          fillSpeciesCard(frame.firstElementChild, 'walleye', { profile: { caughtSpecies: ['walleye'] } });
          el.showModal();
        });
        const resources = dialog.locator('[data-video]');
        async function render(species, options) {
          await resources.evaluate(async (container, { species, options }) => {
            const { renderSpeciesVideo } = await import('./game/species-video.mjs');
            renderSpeciesVideo(species, container, options);
          }, { species, options });
        }

        const card = resources.locator('[data-bryan-video]');
        for (const [species, id] of matched) {
          await render(species);
          assert.equal(await card.getAttribute('target'), '_blank');
          assert.equal(await card.getAttribute('rel'), 'noopener');
          assert.equal(await card.getAttribute('href'), 'https://www.youtube.com/watch?v=' + id);
          assert.equal(await card.getByText('Watch now', { exact: true }).count(), 1);
          assert.match(await card.locator('img').getAttribute('src'), new RegExp('/' + id + '/'));
        }
        await render('walleye');
        await card.scrollIntoViewIfNeeded();
        const box = await card.boundingBox();
        const thumbnail = await card.locator('.episode-art').boundingBox();
        assert.ok(box && box.width >= 44 && box.height >= 44 && box.x + box.width <= viewport.width);
        assert.ok(thumbnail?.width >= 64 && thumbnail.height >= 36, 'the thumbnail remains visible in the fish card');
        assert.equal(
          await card.evaluate(el => getComputedStyle(el).color),
          await page.locator('.hero-video').evaluate(el => getComputedStyle(el).color),
        );
        if (process.env.FISHING_EVIDENCE_DIR) {
          await mkdir(process.env.FISHING_EVIDENCE_DIR, { recursive: true });
          await dialog.screenshot({ path: join(process.env.FISHING_EVIDENCE_DIR, `species-video-${viewport.width}x${viewport.height}.png`) });
        }
        const [tab] = await Promise.all([
          page.waitForEvent('popup'),
          viewport.width === 320 ? card.tap() : card.press('Enter'),
        ]);
        await tab.waitForLoadState('domcontentloaded');
        assert.equal(tab.url(), 'https://www.youtube.com/watch?v=Elu9m3JcOEM');
        assert.equal(await tab.evaluate(() => window.opener), null);
        await tab.close();
        assert.equal(await dialog.evaluate(el => el.open), true);
        assert.equal(await page.locator('#player').isVisible(), false);
        assert.equal(await page.locator('#player iframe').count(), 0);

        for (const [species, href] of references) {
          await render(species);
          const fallback = resources.locator('[data-species-reference]');
          assert.equal(await card.count(), 0);
          assert.equal(await fallback.getAttribute('href'), href);
          assert.equal(await fallback.getAttribute('target'), '_blank');
          assert.equal(await fallback.getAttribute('rel'), 'noopener');
        }
        await render('perch', { reference: false });
        assert.equal(await resources.locator('a').count(), 0, 'a guide that already provides a reference can suppress the fallback');
        await render('__proto__');
        assert.equal(await resources.locator('a').count(), 0);
      } finally { await page.close(); }
    }
  });
});

// Prevent an accidental preventDefault on a modified library link.
test('library modified clicks keep native public-link navigation', async () => {
  await withBrowser(async browser => {
    const page = await browser.newPage();
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      assert.equal(await page.locator('#video-grid a').first().evaluate(link => {
        let prevented;
        document.addEventListener('click', event => {
          prevented = event.defaultPrevented;
          event.preventDefault(); // Inspect the site's decision without opening an external tab.
        }, { once: true });
        link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }));
        return prevented;
      }), false);
      assert.equal(await page.locator('#player').isVisible(), false);
    } finally { await page.close(); }
  });
});
