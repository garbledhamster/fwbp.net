import assert from 'node:assert/strict';
import { test } from 'node:test';
import { withBrowser } from './browser-qa.mjs';

const url = process.env.FISHING_QA_URL ?? 'http://127.0.0.1:9867/';
const viewports = [{ width: 1200, height: 800 }, { width: 320, height: 720 }, { width: 720, height: 320 }];

async function videoPage(browser, viewport) {
  const page = await browser.newPage({ viewport, hasTouch: viewport.width === 320, reducedMotion: 'reduce' });
  await page.route('https://www.youtube-nocookie.com/**', route => route.abort());
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const { openBryanVideo } = await import('./game/bryan-videos.mjs');
    window.closedVideoCount = 0;
    const trigger = document.createElement('button');
    trigger.id = 'context-watch';
    trigger.textContent = 'Watch Bryan';
    trigger.addEventListener('click', () => {
      window.videoOpened = openBryanVideo(trigger.dataset.species || 'walleye', {
        trigger, onClose: () => window.closedVideoCount++,
      });
    });
    document.querySelector('#fish-card').append(trigger);
    document.querySelector('#fish-card').showModal();
  });
  return page;
}

// Removing cleanup, callback, source URL or trigger restoration must fail this case.
test('contextual footage stacks above a card and closes cleanly even when embeds fail', async () => {
  await withBrowser(async browser => {
    for (const viewport of viewports) {
      const page = await videoPage(browser, viewport);
      try {
        const trigger = page.locator('#context-watch');
        for (const [species, id] of [['walleye', 'Elu9m3JcOEM'], ['pike', 'gIUtx-C9pKs'], ['smallmouth', 'KL0F_23RvBo'], ['muskie', 'W41Btej9DnI']]) {
          await trigger.evaluate((button, species) => button.dataset.species = species, species);
          await trigger.click();
          const player = page.locator('#player');
          assert.equal(await player.isVisible(), true);
          assert.equal(await page.evaluate(async () => {
            const { openBryanVideo } = await import('./game/bryan-videos.mjs');
            return openBryanVideo('muskie', { onClose: () => window.closedVideoCount += 100 });
          }), false, 'an active player keeps its original session and callback');
          assert.equal(await page.locator('#fish-card').evaluate(card => card.open), true);
          assert.equal(await player.locator('iframe').count(), 1);
          assert.equal(new URL(await player.locator('iframe').getAttribute('src')).pathname, '/embed/' + id);
          assert.equal(await player.locator('#player-source').getAttribute('href'), 'https://www.youtube.com/watch?v=' + id);
          assert.equal(await player.locator('#player-source').isVisible(), true);
          // Keyboard Escape and touch close both retain the parent card.
          if (viewport.width === 320) await player.getByRole('button', { name: 'Close video' }).tap();
          else await page.keyboard.press('Escape');
          await player.waitFor({ state: 'hidden' });
          await player.locator('iframe').waitFor({ state: 'detached' });
          assert.equal(await player.locator('iframe').count(), 0);
          assert.equal(await page.locator('#fish-card').evaluate(card => card.open), true);
          assert.equal(await trigger.evaluate(button => document.activeElement === button), true);
        }
        assert.equal(await page.evaluate(() => window.closedVideoCount), 4);
        await trigger.evaluate(button => button.dataset.species = 'perch');
        await trigger.click();
        assert.equal(await page.evaluate(() => window.videoOpened), false);
        assert.equal(await page.locator('#player').isVisible(), false);
        assert.equal(await page.evaluate(() => window.closedVideoCount), 4);
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
