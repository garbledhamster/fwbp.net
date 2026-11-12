import assert from 'node:assert/strict';
import { lineDepth, practicePage, withBrowser } from './browser-qa.mjs';

await withBrowser(async browser => {
  const { page, enter, findFish, waitForBite, tick, errors } = await practicePage(browser);
  await enter('Campaign');
  await findFish({ species: 'perch' });
  await page.keyboard.press('j');
  await waitForBite();
  await tick(620);
  await page.keyboard.press('r');
  const meter = page.getByRole('meter', { name: 'Reel feedback' });
  await meter.waitFor();

  await page.evaluate(() => { Math.random = () => .2; });
  const beforeWheel = await lineDepth(page);
  await page.mouse.move(35, 120);
  await page.mouse.wheel(0, -600);
  await page.waitForTimeout(25);
  await tick(700);
  assert.ok(await lineDepth(page) > beforeWheel + 10, 'a wheel stroke does not reel a hooked fish');
  assert.equal(await meter.getAttribute('data-outcome'), 'reel');
  await page.mouse.down();
  await page.mouse.move(35, 55, { steps: 4 });
  await page.mouse.up();
  assert.equal(await meter.getAttribute('data-outcome'), 'reel', 'a drag release does not count as a reel tap');
  await tick(2050);

  await page.evaluate(() => { Math.random = () => .95; });
  const start = await lineDepth(page);
  await page.mouse.click(35, 100);
  assert.equal(await meter.getAttribute('data-outcome'), 'reel');
  assert.ok(Math.abs(await lineDepth(page) - start) < 3, 'the reel does not jump on input');
  const positions = [await lineDepth(page)];
  for (let frame = 0; frame < 12; frame++) {
    await tick(16);
    positions.push(await lineDepth(page));
  }
  assert.ok(positions.at(-1) < start - 5, `a successful tap winds in line: ${start} → ${positions.at(-1)}`);
  assert.ok(positions.filter((value, index) => index > 0 && value < positions[index - 1] - .2).length >= 4,
    'the retrieve progresses over successive frames');
  assert.deepEqual(errors, []);
  await page.close();
  console.log('PASS: Campaign tap-only reeling and smooth retrieve');
});
