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
        const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
        assert.ok(response?.ok());
        await check(page, page.getByRole('region', { name: 'Video library' }));
      } finally {
        await page.close();
      }
    }
  });
}

async function checkPlayer(page, action, id, source) {
  const player = page.getByRole('dialog');
  const frame = player.locator('iframe');
  await action.focus();
  await page.keyboard.press('Enter');
  await player.waitFor({ state: 'visible' });
  assert.equal(new URL(await frame.getAttribute('src')).pathname, '/embed/' + id);
  assert.equal(await player.getByRole('link', { name: /Open on YouTube/ }).getAttribute('href'), source);
  await page.keyboard.press('Escape');
  await frame.waitFor({ state: 'detached' });
  assert.equal(await action.evaluate(link => document.activeElement === link), true);
}

test('trip shortcuts select the matching library filter and show its results', async () => {
  await checkLibrary(async (page, library) => {
    const trip = library.getByRole('article', { name: 'Pick a trip' });
    assert.equal(await trip.isVisible(), true, 'the library has a trip picker');
    const videos = library.locator('#video-grid a');
    const allCount = await videos.count();
    const options = [
      ['Underwater strikes', 'Underwater', '20uLF46BQKk'],
      ['Kayak trips', 'Kayak fishing', 'toN7z2eNxEU'],
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
      assert.deepEqual([...new Set(categories)], [filter]);
    }
    await library.getByRole('button', { name: 'All', exact: true }).press('Enter');
    assert.equal(await videos.count(), allCount);
    assert.equal(await library.getByRole('link', { name: /See all uploads/ }).getAttribute('href'), 'https://www.youtube.com/@BryanProkuski/videos');
  });
});

test('the kayak presenter opens Bryan’s Mississippi smallmouth video with the keyboard', async () => {
  await checkLibrary(async (page, library) => {
    const trip = library.getByRole('article', { name: 'Smallmouth from the kayak' });
    assert.equal(await trip.isVisible(), true, 'the library has a kayak presenter');
    const watch = trip.getByRole('link', { name: 'Watch kayak trip' });
    const source = 'https://www.youtube.com/watch?v=toN7z2eNxEU';
    assert.equal(await watch.getAttribute('href'), source);
    await checkPlayer(page, watch, 'toN7z2eNxEU', source);
  });
});

test('the Short warns about gunfire before the keyboard Watch action opens its player', async () => {
  await checkLibrary(async (page, library) => {
    const short = library.getByRole('article', { name: 'Unexpected on the water' });
    assert.equal(await short.isVisible(), true, 'the library has the duck-hunter Short callout');
    const warning = short.getByText('Audio heads-up. This clip contains sudden gunfire.', { exact: true });
    const watch = short.getByRole('link', { name: /Watch the Short/ });
    const source = 'https://www.youtube.com/shorts/Qo7FSZc9S7I';
    assert.equal(await watch.getAttribute('href'), source);
    assert.equal(await page.locator('#player iframe').count(), 0);
    await watch.scrollIntoViewIfNeeded();
    const warningBounds = await warning.boundingBox();
    const watchBounds = await watch.boundingBox();
    assert.ok(warningBounds && watchBounds && warningBounds.y >= 0 &&
      warningBounds.y + warningBounds.height <= watchBounds.y &&
      watchBounds.y + watchBounds.height <= page.viewportSize().height,
    'the warning is on screen above the Watch action');
    await checkPlayer(page, watch, 'Qo7FSZc9S7I', source);
  });
});

test('the footer hot dog opens matching Bryan videos and the library lists the whole pool', async () => {
  const matches = ['NpQtS2wNDRc', 'L7Ub8BdT0Ws', 'W63YgKh-szs', 'gujypoDa-dc', 'GRJ1GOc6Pvk', 'aYJhIZhbeDg'];
  await checkLibrary(async (page, library) => {
    await page.route('https://www.youtube-nocookie.com/embed/**', route =>
      route.fulfill({ body: '<title>YouTube player</title>', contentType: 'text/html' }));
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
      assert.equal(new URL(await fallback.getAttribute('href')).searchParams.get('v'), id);
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
