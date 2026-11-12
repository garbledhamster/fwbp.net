import assert from 'node:assert/strict';
import { practicePage, withBrowser } from './browser-qa.mjs';

await withBrowser(async browser => {
  const { page, enter, findFish, waitForBite, tick, reelToHole, action, closeDialog, errors } = await practicePage(browser);
  await page.evaluate(() => { Math.random = () => .3; });
  await enter('Campaign');
  await page.locator('.fishing-swimmer[data-candidate="0"]').waitFor();

  await page.evaluate(() => {
    const fish = document.querySelector('.fishing-swimmer[data-candidate="0"]');
    const samples = [];
    window.campaignSwimSamples = samples;
    const started = performance.now();
    function sample(now) {
      const box = fish.getBoundingClientRect();
      const scale = parseFloat(getComputedStyle(fish.querySelector('svg')).scale);
      const anchor = parseFloat(fish.style.getPropertyValue('--x'));
      samples.push({ x: box.left + box.width / 2, y: box.top + box.height / 2, scale, anchor });
      if (now - started < 7200) requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  });
  await tick(7250);
  const samples = await page.evaluate(() => window.campaignSwimSamples);
  assert.ok(samples.length > 300);
  const biggestStep = Math.max(...samples.slice(1).map((sample, index) =>
    Math.hypot(sample.x - samples[index].x, sample.y - samples[index].y)));
  const width = Math.max(...samples.map(point => point.anchor)) - Math.min(...samples.map(point => point.anchor));

  await findFish({ species: 'perch' });
  await page.keyboard.press('j');
  await waitForBite();
  await tick(700);
  await page.keyboard.press('r');
  assert.equal(await action.textContent(), 'Reel');
  await reelToHole({ keyboard: true });
  await tick(280);
  await page.keyboard.press('r');
  const reward = page.locator('.fishing-catch-popup[open]');
  await reward.waitFor();
  await page.evaluate(() => { window.fishBeforeNext = [...document.querySelectorAll('.fishing-swimmer')]; });
  await closeDialog(reward, reward.locator('[data-reward-next]'));
  await page.locator('.fishing-tray [data-lure=jig]:enabled').waitFor();
  const survivors = await page.evaluate(() => window.fishBeforeNext.map(fish => fish.isConnected));
  console.log(JSON.stringify({ biggestStep, width, survivors }));
  assert.ok(biggestStep < 18, `the fish body should never jump during a turn: ${biggestStep.toFixed(1)}px`);
  assert.ok(samples.some(point => Math.abs(point.scale) > .15 && Math.abs(point.scale) < .85),
    'a turn shows the body between its full left and right profiles');
  assert.ok(width > 330, `the perch should patrol over a quarter of the water: ${width.toFixed(1)}px`);
  assert.deepEqual(survivors, [true, true], 'remaining fish keep swimming when the angler chooses Next fish');
  assert.deepEqual(errors, []);
  console.log('PASS: wide swim path, continuous turns, and remaining fish persist after a catch');
});
