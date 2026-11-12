import assert from 'node:assert/strict';
import { test } from 'node:test';
import { withBrowser } from './game/browser-qa.mjs';

const url = process.env.FISHING_QA_URL ?? 'http://127.0.0.1:9867/';
const viewports = [{ width: 320, height: 720 }, { width: 1200, height: 800 }];

async function checkLibrary(check) {
  await withBrowser(async browser => {
    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport, hasTouch: viewport.width === 320, reducedMotion: 'reduce' });
      try {
        await page.route('https://www.youtube-nocookie.com/embed/**', route =>
          route.fulfill({ body: '<title>YouTube player</title>', contentType: 'text/html' }));
        await page.route('https://www.youtube.com/iframe_api', route => route.fulfill({
          contentType: 'application/javascript',
          body: `
            window.YT = { Player: class {
              constructor(frame, { events }) {
                this.frame = frame;
                this.events = events;
                if (frame.closest('#player')) window.testPlayer = this;
              }
              loadVideoById(id) { this.id = id; }
              destroy() { this.frame.remove(); }
              finish() { this.events.onStateChange({ target: this, data: 0 }); }
              unavailable() { this.events.onError({ target: this, data: 150 }); }
            }};
            window.onYouTubeIframeAPIReady();
          `
        }));
        const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
        assert.ok(response?.ok());
        await check(page, page.getByRole('region', { name: 'Video library' }));
      } finally {
        await page.close();
      }
    }
  });
}

test('trip shortcuts select the matching library filter and show its results', async () => {
  await checkLibrary(async (page, library) => {
    const trip = library.getByRole('article', { name: 'Pick a trip' });
    assert.equal(await trip.isVisible(), true, 'the library has a trip picker');
    const videos = library.locator('#video-grid a');
    const options = [
      ['Underwater strikes', 'Underwater', '3dmUMd9oR88'],
      ['Mille Lacs trips', 'Mille Lacs', 'sXRoaFLDS10'],
      ['Gear setups', 'Gear', '1mtyGF6wlDI']
    ];
    for (const [shortcut, filter, id] of options) {
      await trip.getByRole('button', { name: shortcut, exact: true }).focus();
      await page.keyboard.press('Enter');
      const selected = library.getByRole('button', { name: filter, exact: true });
      assert.equal(await selected.getAttribute('aria-pressed'), 'true');
      assert.equal(await selected.evaluate(button => document.activeElement === button), true);
      assert.ok((await videos.evaluateAll(links => links.map(link => link.dataset.watch))).includes(id));
      const categories = await videos.locator('.episode-meta').allTextContents();
      assert.ok(categories.every(tags => tags.split(' · ').includes(filter)));
    }
    await library.getByRole('button', { name: 'All', exact: true }).press('Enter');
    assert.ok(await library.getByRole('button', { name: 'Show more videos' }).isVisible());
    assert.equal(await library.getByRole('link', { name: /See all uploads/ }).getAttribute('href'), 'https://www.youtube.com/@BryanProkuski/videos');
  });
});

test('the footer hot dog opens matching Bryan videos and the library lists the whole pool', async () => {
  const matches = ['NpQtS2wNDRc', 'L7Ub8BdT0Ws', 'W63YgKh-szs', 'gujypoDa-dc', 'GRJ1GOc6Pvk', 'aYJhIZhbeDg'];
  await checkLibrary(async (page, library) => {
    const footer = page.getByRole('contentinfo');
    const hotDog = footer.getByRole('link', { name: 'Watch a random hot dog video' });
    await hotDog.waitFor({ timeout: 2500 });
    await page.evaluate(() => { Math.random = () => 0; });
    const player = page.locator('#player');
    const frame = player.locator('iframe');
    const played = [];
    const point = () => page.viewportSize().width === 320 ? hotDog.tap() : hotDog.click();
    for (const activate of [point, () => hotDog.press('Enter')]) {
      await activate();
      await player.waitFor({ state: 'visible', timeout: 2500 });
      const id = new URL(await frame.getAttribute('src')).pathname.split('/').at(-1);
      assert.ok(matches.includes(id), 'the hot dog plays a verified match');
      const fallback = player.getByRole('link', { name: /Open on YouTube/ });
      assert.match(await fallback.getAttribute('href'), new RegExp(id + '$'));
      played.push(id);
      await page.keyboard.press('Escape');
      await frame.waitFor({ state: 'detached' });
      assert.equal(await hotDog.evaluate(link => document.activeElement === link), true);
    }
    assert.notEqual(...played, 'two consecutive clicks play different videos');
    assert.equal(await footer.locator('.footer-rig').getByRole('link', { name: /Dardevle/ }).getAttribute('href'),
      'https://www.youtube.com/shorts/kgUSasaMays');

    await library.getByRole('button', { name: 'Hot dog', exact: true }).click();
    const shown = await library.locator('#video-grid a').evaluateAll(links => links.map(link => link.dataset.watch));
    assert.deepEqual(shown.sort(), matches.sort());
  });
});

test('the library opens on underwater ice fishing and includes eligible Shorts under All', async () => {
  await checkLibrary(async (page, library) => {
    const underwater = library.getByRole('button', { name: 'Underwater', exact: true });
    assert.equal(await underwater.getAttribute('aria-pressed'), 'true');
    const grid = library.locator('#video-grid');
    assert.ok(await grid.locator('[data-watch="3dmUMd9oR88"]').count());
    await library.getByRole('button', { name: 'All', exact: true }).click();
    assert.ok(await grid.locator('a[href*="/shorts/"]').count());
    const before = await grid.locator('a').count();
    await library.getByRole('button', { name: 'Show more videos' }).click();
    assert.ok(await grid.locator('a').count() > before);
    assert.equal(await library.getByRole('button', { name: 'Kayak fishing', exact: true }).count(), 0);
  });
});

test('the random button plays the selected category and loops its queue', async () => {
  await checkLibrary(async (page, library) => {
    await library.getByRole('button', { name: 'Hot dog', exact: true }).click();
    const random = library.getByRole('button', { name: 'Pick a random video' });
    await random.waitFor({ timeout: 2500 });
    const expected = await library.locator('#video-grid a').evaluateAll(links =>
      links.map(link => link.dataset.watch));
    assert.ok(expected.length >= 3);
    await page.evaluate(() => { Math.random = () => .999; });
    await random.press('Enter');
    await page.waitForFunction(() => window.testPlayer);
    const source = page.locator('#player-source');
    assert.match(await source.getAttribute('href'), new RegExp(expected.at(-1) + '$'));
    await page.evaluate(() => window.testPlayer.finish());
    assert.equal(await page.evaluate(() => window.testPlayer.id), expected[0]);
    assert.match(await source.getAttribute('href'), new RegExp(expected[0] + '$'));
    await page.evaluate(() => window.testPlayer.unavailable());
    assert.equal(await page.evaluate(() => window.testPlayer.id), expected[1]);
    await page.keyboard.press('Escape');
    await page.locator('#player iframe').waitFor({ state: 'detached' });
    assert.equal(await random.evaluate(button => document.activeElement === button), true);

    await library.getByRole('button', { name: 'All', exact: true }).click();
    await random.press('Enter');
    await page.waitForFunction(() => window.testPlayer?.frame === document.querySelector('#player iframe'));
    // The last catalog entry is outside the first visible batch.
    assert.match(await source.getAttribute('href'), /oXallEXVMjg$/);
    await page.evaluate(() => window.testPlayer.finish());
    assert.match(await source.getAttribute('href'), /3dmUMd9oR88$/);
  });
});
