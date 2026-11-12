import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { practicePage } from './browser-qa.mjs';

const evidence = process.env.FISHING_RENDER_EVIDENCE_DIR;
const viewport = { width: 1324, height: 769 };
const phases = ['day', 'dusk', 'night'];
const engines = process.env.FISHING_RENDER_BROWSERS?.split(',') ?? ['webkit'];
const playwright = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const failures = [];

if (evidence) await mkdir(evidence, { recursive: true });

async function capture(page, fish, label) {
  await fish.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  const image = await fish.screenshot({ animations: 'disabled', scale: 'css' });
  const samples = await page.evaluate(async data => {
    const image = new Image();
    image.src = 'data:image/png;base64,' + data;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    return [.36, .46, .57, .67, .79].map(y =>
      [...context.getImageData(Math.round(canvas.width * .52), Math.round(canvas.height * y), 1, 1).data].slice(0, 3));
  }, image.toString('base64'));
  const artwork = await fish.evaluate(el => {
    const use = el.querySelector('use');
    const { width, height } = use.getBBox();
    return { href: use.getAttribute('href'), width, height, filter: getComputedStyle(el).filter };
  });
  assert.ok(artwork.width > 0 && artwork.height > 0, label + ' resolves the fish geometry');
  if (evidence) {
    await writeFile(join(evidence, label + '-fish.png'), image);
    await page.screenshot({ path: join(evidence, label + '.png'), animations: 'disabled', scale: 'css' });
  }
  return { ...artwork, samples };
}

async function check(browser, engine, gilded) {
  const network = [];
  const { page, tray, action, press, enter, leave, findFish, reelToHole, tick, errors } =
    await practicePage(browser, { viewport, configure: async page => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      page.on('response', response => {
        if (/\/assets\/(?:lake-life|scenes|fish)\.svg$/.test(response.url())) {
          network.push([response.status(), response.url()]);
        }
      });
      page.on('requestfailed', request => {
        if (/\.svg$/.test(request.url())) network.push([request.failure().errorText, request.url()]);
      });
    } });
  const records = {};
  const recordPaint = (label, result, pixel, ranges) => {
    if (!result.samples[pixel].every((channel, index) =>
      channel >= ranges[index][0] && channel <= ranges[index][1])) {
      failures.push(prefix + ' did not paint ' + label + ' with the expected body color');
    }
  };
  const prefix = engine + '-' + (gilded ? 'gilded' : 'normal');
  const artwork = async (label, selector) => {
    const result = await capture(page, page.locator(selector).first(), prefix + '-' + label);
    records[label] = result;
    return result;
  };
  try {
    await page.waitForLoadState('load');
    if (!gilded) {
      const pike = await artwork('site-pike', '.lure-fish[data-fish="pike"] svg');
      // The middle of the pike body is olive above and pale yellow below.
      // Transparent paint leaves only the dark lake behind its outline.
      if (pike.samples[0][0] < 85 || pike.samples[3][0] - pike.samples[0][0] < 45) {
        failures.push(engine + ' did not paint the Northern pike body gradient');
      }
      recordPaint('the site rock bass', await artwork('site-rock-bass', '.dive-actor[data-fish="rock-bass"] svg'),
        1, [[125, 165], [110, 145], [55, 95]]);
      await press(page.locator('#fish-guide-toggle'), 'Enter');
      await page.locator('.fish-mode-hint').filter({ hasText: /0 \/ 6/ }).waitFor();
      assert.equal(await page.locator('.fish-target:visible').count(), 0, 'uncaught site collection fish are hidden');
      await press(page.locator('#fish-guide-toggle'), 'Enter');
    }

    // Use the same fish in each real Practice phase. Rock bass weights differ
    // under dusk and night, so the seeded draw changes with the pool.
    await page.evaluate(gilded => {
      const rolls = [.35, .18, .1].flatMap(species => [species, .53, .48, .4, gilded ? .99 : .1]);
      let draw = 0;
      Math.random = () => rolls[draw++ % rolls.length];
    }, gilded);
    await enter('Practice');
    for (const phase of phases) {
      await tray.locator(`[data-phase="${phase}"]`).waitFor();
      const result = await artwork('live-' + phase, '.fishing-target svg');
      assert.match(result.href, /rock-bass$/);
      assert.equal(result.filter.includes('sepia'), gilded, 'only gilded targets use the gilded filter');
      recordPaint('the ' + phase + ' rock bass', result, 2, gilded
        ? [[175, 235], [140, 195], [80, 125]]
        : [[135, 190], [115, 165], [65, 105]]);
      if (phase === 'night') {
        await findFish();
        await press(action);
        await tick(700);
        await press(action);
        await reelToHole();
        await press(action);
        await press(tray.getByRole('button', { name: 'My Lake', exact: true }), 'Enter');
        const collection = page.getByRole('dialog', { name: 'My Lake', exact: true });
        await collection.getByRole('heading', { name: 'Rock bass', exact: true }).waitFor();
        recordPaint('the saved rock bass', await artwork('caught-your-lake', '#your-lake .collection-fish-art'),
          1, [[125, 170], [110, 150], [55, 105]]);
        await press(collection.getByRole('button', { name: 'Return to outing', exact: true }), 'Enter');
        await collection.waitFor({ state: 'detached' });
      }
      if (phase !== 'night') {
        await tick(31000);
        await action.filter({ hasText: 'Next fish' }).waitFor();
        await press(action);
      }
    }
    await leave();
    if (!gilded) {
      await press(page.locator('#fish-guide-toggle'), 'Enter');
      await page.locator('.fish-mode-hint').filter({ hasText: /1 \/ 6/ }).waitFor();
      assert.equal(await page.locator('.fish-target:visible:not([data-fish="rock-bass"])').count(), 0,
        'site collection hides uncaught species after a save');
      const savedFish = page.locator('.fish-target[data-fish="rock-bass"]:visible').first();
      await press(savedFish, 'Enter');
      await page.locator('#fish-card[open]').waitFor();
      recordPaint('the site collection rock bass', await artwork('site-your-lake', '#fish-card .collection-fish-art'),
        2, [[135, 190], [115, 165], [65, 105]]);
    }
    const references = await page.evaluate(() => {
      const ids = [...document.querySelectorAll('[id]')].map(el => el.id);
      const seen = new Set();
      const duplicates = ids.filter(id => {
        if (seen.has(id)) return true;
        seen.add(id);
        return false;
      });
      const localUses = [...document.querySelectorAll('use[href^="#fwbp-"]')];
      const brokenUses = localUses.map(use => use.getAttribute('href').slice(1))
        .filter(id => !document.getElementById(id));
      return { duplicates, brokenUses };
    });
    assert.deepEqual(references, { duplicates: [], brokenUses: [] });
    assert.deepEqual(errors, []);
    for (const asset of ['lake-life', 'fish', 'scenes']) {
      assert.ok(network.some(([status, url]) => status === 200 && url.endsWith('/' + asset + '.svg')),
        asset + ' SVG loaded successfully');
    }
  } finally {
    console.log(prefix, JSON.stringify({ records, network, errors }));
    if (evidence) await writeFile(join(evidence, prefix + '.json'),
      JSON.stringify({ version: browser.version(), viewport, records, network, errors }, null, 2));
    await page.close();
  }
}

for (const engine of engines) {
  assert.ok(['webkit', 'chromium'].includes(engine), 'choose webkit or chromium');
  const browser = await playwright[engine].launch(engine === 'chromium'
    ? { executablePath: process.env.CHROME_PATH } : {});
  try {
    for (const gilded of [false, true]) await check(browser, engine, gilded);
  } finally {
    await browser.close();
  }
}
assert.deepEqual(failures, []);
console.log('PASS: site fish gradients, live normal and gilded fish, and saved collection art');
