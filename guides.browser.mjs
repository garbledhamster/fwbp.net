import assert from 'node:assert/strict';
import test from 'node:test';
import { withBrowser } from './game/browser-qa.mjs';

const url = process.env.FISHING_QA_URL ?? 'http://127.0.0.1:9867/';

for (const width of [320, 1200]) {
  test(`Field Notes at ${width}px`, async (t) => {
    await withBrowser(async (browser) => {
      const page = await browser.newPage({ viewport: { width, height: 800 }, hasTouch: width === 320, isMobile: width === 320, reducedMotion: 'reduce' });
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      const notes = page.locator('#field-notes');

      async function openGuide(title) {
        const summary = notes.locator('summary').filter({ hasText: title });
        await summary.scrollIntoViewIfNeeded();
        await summary.focus();
        await page.keyboard.press('Space');
        assert.equal(await summary.evaluate((el) => el.parentElement.open), true);
        return { summary, guide: summary.locator('..') };
      }

      async function checkIllustration(summary, file, side = 'right') {
        const avatar = summary.locator(`img[src*="${file}"]`);
        assert.equal(await avatar.count(), 1, `Missing illustrated presenter ${file}`);
        const picture = await avatar.boundingBox();
        const copy = await summary.locator('span').first().boundingBox();
        const chevron = await summary.locator('.chevron').boundingBox();
        assert.ok(picture && copy && chevron, 'Presenter, heading and chevron are visible');
        const separate = side === 'left' ? picture.x + picture.width <= copy.x : copy.x + copy.width <= picture.x;
        assert.ok(separate && Math.max(copy.x + copy.width, picture.x + picture.width) <= chevron.x,
          'The illustration has its own space beside the heading and chevron');
      }

      async function playFrom(link, id) {
        assert.equal(await link.count(), 1, `Missing Field Notes video ${id}`);
        await link.focus();
        await page.keyboard.press('Enter');
        const frame = page.locator('#player iframe');
        await frame.waitFor();
        assert.equal(new URL(await frame.getAttribute('src')).pathname, `/embed/${id}`);
        await page.getByRole('button', { name: 'Close video' }).press('Enter');
        await frame.waitFor({ state: 'detached' });
        assert.equal(await link.evaluate((el) => document.activeElement === el), true);
      }

      async function closeGuide(summary) {
        await summary.focus();
        await page.keyboard.press('Enter');
        assert.equal(await summary.evaluate((el) => el.parentElement.open), false);
      }

      await t.test('camera guide shows three sourced stills before its watch action', async () => {
        const { summary, guide } = await openGuide('Underwater camera setup');
        try {
          await checkIllustration(summary, 'bryan-camera.webp');
          const stills = guide.locator('.guide-stills img');
          assert.equal(await stills.count(), 3, 'Missing the three camera setup stills');
          for (const still of await stills.all()) {
            await still.scrollIntoViewIfNeeded();
            await still.evaluate((img) => img.decode());
          }
          await playFrom(guide.locator('a[data-watch="1mtyGF6wlDI"]'), '1mtyGF6wlDI');
        } finally {
          await closeGuide(summary);
        }
      });

      await t.test('camera previews play inline and hand off to the matching YouTube timestamp', async () => {
        const context = page.context();
        await context.route('https://www.youtube-nocookie.com/embed/**', route =>
          route.fulfill({ contentType: 'text/html', body: '<p>Embed fixture</p>' }));
        await context.route('https://www.youtube.com/watch?**', route =>
          route.fulfill({ contentType: 'text/html', body: '<p>YouTube fixture</p>' }));
        const { summary, guide } = await openGuide('Underwater camera setup');
        const player = guide.locator('iframe');
        const clips = guide.locator('.guide-stills a');
        assert.equal(await clips.count(), 3);
        try {
          for (const [index, start, end] of [[0, 215, 245], [1, 245, 255], [2, 255, 265]]) {
            const clip = clips.nth(index);
            if (width === 320) await clip.tap();
            else await clip.press('Enter');

            const embed = new URL(await player.getAttribute('src'));
            assert.equal(embed.pathname, '/embed/1mtyGF6wlDI');
            assert.equal(embed.searchParams.get('start'), String(start));
            assert.equal(embed.searchParams.get('end'), String(end));
            assert.equal(embed.searchParams.get('autoplay'), '1');
            assert.equal(embed.searchParams.get('playsinline'), '1');
            const box = await player.boundingBox();
            assert.ok(box.width >= 200 && box.height >= 200);
            assert.match(await clip.innerText(), /Continue on YouTube/);

            const opened = page.waitForEvent('popup');
            if (width === 320) await clip.tap();
            else await clip.press('Enter');
            const youtube = await opened;
            try {
              const destination = new URL(youtube.url());
              assert.equal(destination.hostname, 'www.youtube.com');
              assert.equal(destination.searchParams.get('v'), '1mtyGF6wlDI');
              assert.equal(destination.searchParams.get('t'), start + 's');
              assert.equal(await player.count(), 0);
            } finally {
              await youtube.close();
            }
          }

          await clips.first().press('Enter');
          await clips.nth(1).press('Enter');
          assert.equal(await player.count(), 1);
          assert.equal(new URL(await player.getAttribute('src')).searchParams.get('start'), '245');
          await closeGuide(summary);
          await player.waitFor({ state: 'detached' });
        } finally {
          if (await summary.evaluate(el => el.parentElement.open)) await closeGuide(summary);
        }
      });

      await t.test('jig guide shows two poses, its three diagrams, and a timestamped example', async () => {
        const { summary, guide } = await openGuide('How a jig moves');
        try {
          await checkIllustration(summary, 'bryan-full-body-jig.webp', 'left');
          assert.equal(await guide.locator('.guide-body img[src*="bryan-jig-portrait.webp"]').count(), 1);
          assert.deepEqual(await guide.locator('.guide-frames figcaption strong').allTextContents(), ['Lift', 'Pause', 'Lower']);
          const example = guide.getByRole('link', { name: /watch the spoon/i });
          assert.equal(await example.count(), 1);
          assert.equal(await example.getAttribute('href'), 'https://www.youtube.com/watch?v=3dmUMd9oR88&t=435s');
        } finally {
          await closeGuide(summary);
        }
      });

      await t.test('walleye guide retains both identification figures and opens Bryan’s walleye footage', async () => {
        const { summary, guide } = await openGuide('Walleye or yellow perch?');
        try {
          await checkIllustration(summary, 'bryan-walleye-portrait.webp');
          assert.deepEqual(await guide.locator('.fish-frames figcaption strong').allTextContents(), ['Walleye', 'Yellow perch']);
          await playFrom(guide.locator('a[data-watch="i5TfAtufo7U"]'), 'i5TfAtufo7U');
        } finally {
          await closeGuide(summary);
        }
      });
    });
  });
}
