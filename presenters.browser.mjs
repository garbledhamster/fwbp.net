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
    const hero = page.locator('.surface-inner');
    const lakebed = page.locator('#muskrat-presenter');
    const picks = page.locator('.trip-picker');
    const kayak = page.locator('#kayak-presenter');
    const short = page.locator('#short-presenter');
    const presenters = [
      [about, 'headshot', 'right'],
      [picks, 'standing-welcome', 'left'],
      [kayak, 'kayak', 'right'],
      [short, 'over-the-shoulder', 'right'],
      [lakebed, 'leaning-in', 'left'],
    ];
    const missing = [];
    for (const [card, pose] of presenters) {
      if (await card.locator('.presenter-cutout').count() !== 1) missing.push(pose);
    }
    assert.deepEqual(missing, [], `missing presenter poses at ${width}px: ${missing.join(', ')}`);
    const artWidths = new Map();
    for (const [card, pose, side] of presenters) {
      const cutout = card.locator('.presenter-cutout');
      assert.match(await cutout.getAttribute('src'), new RegExp(`bryan-${pose}\\.webp$`));
      await cutout.scrollIntoViewIfNeeded();
      await cutout.evaluate(img => img.decode());
      const art = await cutout.boundingBox();
      const copy = await card.locator('.presenter-copy').boundingBox();
      assert.ok(art && copy, `missing ${pose} art or copy at ${width}px`);
      assert.ok(side === 'left' ? art.x + art.width <= copy.x : art.x >= copy.x + copy.width,
        `${pose} needs its own lane on the ${side} at ${width}px`);
      assert.ok(art.x >= 0 && art.x + art.width <= width, `art exceeds viewport at ${width}px`);
      artWidths.set(pose, art.width);
      if (width > 1000 && (pose === 'kayak' || pose === 'over-the-shoulder')) {
        const footage = await card.locator('.presenter-footage').boundingBox();
        assert.ok(footage && (pose === 'kayak' ? art.x + art.width <= footage.x : footage.x + footage.width <= art.x),
          `${pose} art should sit ${pose === 'kayak' ? 'between the copy and footage' : 'past the footage'}`);
      }
    }
    if (width > 1000) {
      const [pickBox, kayakBox, shortBox] = await Promise.all([picks.boundingBox(), kayak.boundingBox(), short.boundingBox()]);
      assert.ok(pickBox.x > shortBox.x && kayakBox.x > shortBox.x, 'Library callouts sit on different page alignments');
      assert.ok(artWidths.get('kayak') > artWidths.get('over-the-shoulder') * 1.4, 'The kayak feature gets the larger illustration');
    }

    assert.match(await about.innerText(), /Minnesota.*kayak.*ice/s);
    assert.match(await page.locator('#brand-mark').getAttribute('src'), /underwater-stamp\.svg$/);
    assert.equal(await page.locator('link[rel="icon"][href*="underwater-stamp"]').count(), 2);
    assert.equal(await page.locator('#channel-showcase .channel-logo').count(), 1);
    assert.equal(await hero.getByRole('heading', { level: 1 }).textContent(), 'Fishing with Bryan Prokuski');
    await hero.locator('.hero-portrait').evaluate(image => image.decode());
    assert.match(await hero.locator('.hero-portrait').getAttribute('src'), /bryan-pike\.webp/);
    assert.deepEqual(await hero.locator('.hero-actions a').allTextContents(),
      ['Watch the latest video', 'Video library ↘', 'Watch on YouTube ↗']);
    assert.equal(await page.locator('#featured-grid .episode').count(), 2);
    assert.match(await page.locator('.footer-lure').getAttribute('href'), /\/shorts\/kgUSasaMays$/);
    assert.match(await page.locator('.hero-cover img').getAttribute('src'), new RegExp(latest));

    const player = page.locator('#player');
    assert.equal(await player.locator('iframe').count(), 0);
    for (const [trigger, id] of [[page.locator('.hero-cover'), latest], [hero.getByRole('link', { name: 'Watch the latest video' }), latest], [lakebed.locator('.presenter-footage'), muskrat]]) {
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
    for (const card of [about, hero, lakebed]) assert.equal(await card.isVisible(), false);
    await page.locator('#fish-guide-toggle').click();
    for (const card of [about, hero, lakebed]) assert.equal(await card.isVisible(), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
    assert.deepEqual(errors, []);
    await page.close();
  }
});
console.log('About, latest video, lakebed and Your Lake verified at 320px and 1280px.');
