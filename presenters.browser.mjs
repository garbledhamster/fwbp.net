import assert from 'node:assert/strict';
import { withBrowser } from './game/browser-qa.mjs';

const url = process.env.FISHING_QA_URL ?? 'http://127.0.0.1:9867/';
const latest = '3dmUMd9oR88';
const muskrat = 'PHJOCTI5XUo';

await withBrowser(async browser => {
  for (const width of [320, 1280]) {
    const page = await browser.newPage({
      viewport: { width, height: 840 },
      reducedMotion: width === 320 ? 'reduce' : 'no-preference',
    });
    page.setDefaultTimeout(5000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://www.youtube-nocookie.com/embed/**', route =>
      route.fulfill({ body: '<title>YouTube player</title>', contentType: 'text/html' }));
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    const about = page.locator('#about');
    const note = page.locator('.latest-presenter');
    const lakebed = page.locator('#muskrat-presenter');
    const presenters = [[about, 'headshot'], [note, 'front-facing'], [lakebed, 'leaning-in']];
    const missing = [];
    for (const [card, pose] of presenters) {
      if (await card.locator('.presenter-cutout').count() !== 1) missing.push(pose);
    }
    assert.deepEqual(missing, [], `missing presenter poses at ${width}px: ${missing.join(', ')}`);
    for (const [card, pose] of presenters) {
      const cutout = card.locator('.presenter-cutout');
      assert.match(await cutout.getAttribute('src'), new RegExp(`bryan-${pose}\\.webp$`));
      await cutout.scrollIntoViewIfNeeded();
      await cutout.evaluate(img => img.decode());
      const art = await cutout.boundingBox();
      const copy = await card.locator('.presenter-copy').boundingBox();
      assert.ok(art && copy && art.x >= copy.x + copy.width, `art overlaps copy at ${width}px`);
      assert.ok(art.x + art.width <= width, `art exceeds viewport at ${width}px`);
    }

    assert.match(await about.innerText(), /Minnesota.*kayak.*ice/s);
    assert.match(await note.innerText(), /pike.*spoon/i);
    assert.match(await page.locator('#brand-mark').getAttribute('src'), /underwater-stamp\.svg$/);
    assert.equal(await page.locator('link[rel="icon"][href*="underwater-stamp"]').count(), 2);
    assert.equal(await page.locator('#channel-showcase .channel-logo').count(), 1);
    assert.match(await page.locator('#channel-showcase .channel-avatar').getAttribute('src'), /bryan-walleye\.webp/);
    assert.equal(await page.locator('#featured-grid .episode').count(), 2);
    assert.match(await page.locator('.footer-lure').getAttribute('href'), /\/shorts\/kgUSasaMays$/);
    assert.match(await page.locator('.hero-cover img').getAttribute('src'), new RegExp(latest));

    const player = page.locator('#player');
    assert.equal(await player.locator('iframe').count(), 0);
    for (const [trigger, id] of [[page.locator('.hero-cover'), latest], [lakebed.locator('.presenter-footage'), muskrat]]) {
      assert.match(await trigger.getAttribute('href'), new RegExp(id));
      await trigger.focus();
      await page.keyboard.press('Enter');
      await player.waitFor({ state: 'visible' });
      assert.match(await player.locator('iframe').getAttribute('src'), new RegExp(id));
      assert.match(await player.locator('#player-source').getAttribute('href'), new RegExp(id));
      await player.getByRole('button', { name: 'Close video' }).click();
      await player.locator('iframe').waitFor({ state: 'detached' });
      assert.equal(await trigger.evaluate(el => el === document.activeElement), true);
    }

    await page.locator('#fish-guide-toggle').click();
    for (const card of [about, note, lakebed]) assert.equal(await card.isVisible(), false);
    await page.locator('#fish-guide-toggle').click();
    for (const card of [about, note, lakebed]) assert.equal(await card.isVisible(), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
    assert.deepEqual(errors, []);
    await page.close();
  }
});
console.log('About, latest video, lakebed and Fish Guide verified at 320px and 1280px.');
