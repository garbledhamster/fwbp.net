import assert from 'node:assert/strict';
import { withBrowser } from './game/browser-qa.mjs';

const url = process.env.FISHING_QA_URL ?? 'http://127.0.0.1:9867/';
const latest = '3dmUMd9oR88';
const muskrat = 'PHJOCTI5XUo';

await withBrowser(async browser => {
  for (const width of [320, 1280]) {
    const page = await browser.newPage({
      viewport: { width, height: width === 320 ? 840 : 620 },
      hasTouch: width === 320,
      isMobile: width === 320,
      reducedMotion: width === 320 ? 'reduce' : 'no-preference',
    });
    page.setDefaultTimeout(5000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://www.youtube-nocookie.com/embed/**', route =>
      route.fulfill({ body: '<title>YouTube player</title>', contentType: 'text/html' }));
    await page.route('https://www.youtube.com/iframe_api', route => route.fulfill({
      contentType: 'application/javascript',
      body: `
        window.featuredPlayback = [];
        window.YT = {
          Player: function (iframe, options) {
            options.events.onReady({ target: {
              getPlayerState: () => -1,
              mute: () => window.featuredPlayback.push('mute'),
              playVideo: () => window.featuredPlayback.push('play'),
            } });
          },
        };
        window.onYouTubeIframeAPIReady();
      `,
    }));
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    const featuredPlayer = page.locator('.hero-player iframe');
    await featuredPlayer.waitFor();
    const featuredUrl = new URL(await featuredPlayer.getAttribute('src'));
    assert.equal(featuredUrl.pathname, '/embed/' + latest);
    assert.equal(featuredUrl.searchParams.get('autoplay'), '0');
    assert.equal(featuredUrl.searchParams.get('playsinline'), '1');
    assert.equal(await page.locator('.hero-video button, .hero-video a').count(), 0);
    assert.equal(await page.locator('.tent-game').innerText(), '');
    assert.equal(await page.getByRole('link', { name: 'Through the hole', exact: true }).count(), 0);
    if (width === 320) {
      assert.equal(featuredUrl.searchParams.has('enablejsapi'), false);
      assert.equal(await page.evaluate(() => typeof window.onYouTubeIframeAPIReady), 'undefined');
    } else {
      assert.equal(featuredUrl.searchParams.get('enablejsapi'), '1');
      await page.waitForFunction(() => Array.isArray(window.featuredPlayback));
      assert.deepEqual(await page.evaluate(() => window.featuredPlayback), []);
      await featuredPlayer.scrollIntoViewIfNeeded();
      await page.waitForFunction(() => window.featuredPlayback.length === 2);
      assert.deepEqual(await page.evaluate(() => window.featuredPlayback), ['mute', 'play']);
    }

    const about = page.locator('#about');
    const hero = page.locator('.surface-inner');
    const lakebed = page.locator('#muskrat-presenter');
    const picks = page.locator('.trip-picker');
    const presenters = [
      [about, 'headshot', 'right'],
      [picks, 'standing-welcome', 'left'],
      [lakebed, 'leaning-in', 'left'],
    ];
    const missing = [];
    for (const [card, pose] of presenters) {
      if (await card.locator('.presenter-cutout').count() !== 1) missing.push(pose);
    }
    assert.deepEqual(missing, [], `missing presenter poses at ${width}px: ${missing.join(', ')}`);
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
    }

    assert.match(await about.innerText(), /Minnesota.*kayak.*ice/s);
    assert.match(await page.locator('#brand-mark').getAttribute('src'), /underwater-stamp\.svg$/);
    assert.equal(await page.locator('link[rel="icon"][href*="underwater-stamp"]').count(), 2);
    assert.equal(await page.locator('#channel-showcase .channel-logo').count(), 1);
    assert.equal(await hero.getByRole('heading', { level: 1 }).textContent(), 'Fishing with Bryan Prokuski');
    await hero.locator('.hero-portrait').evaluate(image => image.decode());
    assert.match(await hero.locator('.hero-portrait').getAttribute('src'), /bryan-pike\.webp/);
    assert.equal(await page.locator('#featured-grid .episode').count(), 2);
    assert.match(await page.locator('.footer-lure').getAttribute('href'), /\/shorts\/kgUSasaMays$/);

    const player = page.locator('#player');
    assert.equal(await player.locator('iframe').count(), 0);
    for (const [trigger, id] of [[lakebed.locator('.presenter-footage'), muskrat]]) {
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
console.log('Verified mobile tap-to-play configuration, visible muted desktop autoplay, and the lakebed video dialog.');
