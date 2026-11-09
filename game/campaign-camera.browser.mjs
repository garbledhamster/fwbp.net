import assert from 'node:assert/strict';
import { practicePage, withBrowser } from './browser-qa.mjs';

await withBrowser(async browser => {
  const { page, enter, leave, tick, errors } = await practicePage(browser);
  await enter('Campaign');
  const measure = () => page.evaluate(() => {
    const path = document.querySelector('.fishing-line-path');
    return {
      page: scrollY,
      depth: document.querySelector('.fishing-route').scrollTop,
      line: path.getPointAtLength(path.getTotalLength()).y - path.getPointAtLength(0).y,
      overflow: getComputedStyle(document.querySelector('.fishing-route')).overflowY,
    };
  });
  const initial = await measure();
  await page.mouse.move(35, 170);
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(45);
  const frames = [];
  for (let i = 0; i < 30; i++) {
    await tick(16);
    frames.push(await measure());
  }
  assert.ok(frames.every(frame => frame.page === initial.page), 'depth input leaves the webpage scroll position locked');
  assert.equal(initial.overflow, 'hidden', 'the fishing viewport has no scrollbar');
  const travel = frames.at(-1).depth - initial.depth;
  assert.ok(travel > 180 && travel < 320, `depth travel is slower than the 500px wheel input: ${travel}`);
  const steps = frames.map((frame, i) => frame.line - (frames[i - 1] ?? initial).line);
  assert.ok(steps.filter(step => step > 2).length > 8, 'line travel spans successive animation frames');
  assert.ok(Math.max(...steps.map(Math.abs)) < 32, 'line travel never jumps a full wheel step');
  console.log(JSON.stringify({ travel, maxLineStep: Math.max(...steps.map(Math.abs)), pageScroll: initial.page }));
  assert.deepEqual(errors, []);
  await leave();
  assert.equal(await page.locator('body').getAttribute('data-campaign-camera'), null);
  console.log('PASS: fixed Campaign viewport, slower depth input, and smooth line travel');
});
