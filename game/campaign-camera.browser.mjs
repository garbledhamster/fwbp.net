import assert from 'node:assert/strict';
import { practicePage, withBrowser } from './browser-qa.mjs';

await withBrowser(async browser => {
  const { page, enter, leave, tick, errors } = await practicePage(browser);
  await enter('Campaign');
  const measure = () => page.evaluate(() => {
    const path = document.querySelector('.fishing-line-path');
    const viewport = document.querySelector('.fishing-route');
    const start = path.getPointAtLength(0);
    const end = path.getPointAtLength(path.getTotalLength());
    const matrix = path.getScreenCTM();
    const hook = end.matrixTransform(matrix);
    const hole = start.matrixTransform(matrix);
    return {
      page: scrollY, nativeDepth: viewport.scrollTop,
      width: viewport.clientWidth, tray: document.querySelector('.fishing-tray').getBoundingClientRect().top,
      x: hook.x, y: hook.y, holeY: hole.y, line: end.y - start.y,
    };
  });
  const initial = await measure();
  await page.mouse.move(35, 120);
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(45);
  const frames = [];
  for (let i = 0; i < 34; i++) {
    await tick(16);
    frames.push(await measure());
  }
  assert.ok(frames.every(frame => frame.page === initial.page && frame.nativeDepth === 0),
    'the webpage and the game viewport both stay at zero native scroll');
  assert.ok(frames.every(frame => Math.abs(frame.x - frame.width / 2) < 2),
    'the camera stays centered horizontally');
  const lead = frames.map(frame => frame.y - frame.tray / 2);
  const maxLead = Math.max(...lead);
  assert.ok(maxLead > 16 && maxLead < 42, `the hook leads the pan by a little: ${maxLead}px`);
  assert.ok(frames.some(frame => frame.y > initial.y + 5 && Math.abs(frame.holeY - initial.holeY) < 1),
    'the hook drops before the scenery starts to pan');
  const travel = frames.at(-1).line - initial.line;
  assert.ok(travel > 180 && travel < 320, `line travel is slower than the 500px wheel input: ${travel}`);
  const steps = frames.map((frame, i) => frame.line - (frames[i - 1] ?? initial).line);
  assert.ok(steps.filter(step => step > 2).length > 8, 'line travel spans successive animation frames');
  assert.ok(Math.max(...steps.map(Math.abs)) < 32, 'line travel never jumps a full wheel step');
  await tick(850);
  const settled = await measure();
  assert.ok(Math.abs(settled.y - settled.tray / 2) < 2, 'the camera settles back on the hook');

  await page.evaluate(() => { document.querySelector('.fishing-route').scrollTop = 80; });
  assert.equal((await measure()).nativeDepth, 0, 'the playfield cannot be scrolled programmatically');
  await page.keyboard.press('Home');
  await tick(1100);
  const surface = await measure();
  assert.ok(surface.line < 15 && Math.abs(surface.y - surface.tray / 2) < 2,
    'the line draws up into the hole with the hook still centered');
  console.log(JSON.stringify({ travel, maxLead, maxLineStep: Math.max(...steps.map(Math.abs)), surfaceLine: surface.line }));
  assert.deepEqual(errors, []);
  await leave();
  assert.equal(await page.locator('body').getAttribute('data-campaign-camera'), null);
  console.log('PASS: static Campaign viewport and a camera that follows the hook');
});
