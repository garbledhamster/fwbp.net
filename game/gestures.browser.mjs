import assert from 'node:assert/strict';
import { lineDepth, practicePage, withBrowser } from './browser-qa.mjs';

await withBrowser(async browser => {
  const { page, enter, tray, tick, press, closeDialog, errors } = await practicePage(browser, {
    mobile: true, viewport: { width: 320, height: 720 },
  });
  await enter('Campaign');
  const cdp = await page.context().newCDPSession(page);
  const send = (type, ...points) => cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: points.map(([x, y], id) => ({ x, y, id })),
  });
  const depth = await lineDepth(page);
  await send('touchStart', [30, 85], [62, 85]);
  await send('touchMove', [30, 115], [62, 55]);
  await send('touchEnd');
  await tick(250);
  assert.ok(Math.abs(await lineDepth(page) - depth) < 2, 'a second finger cancels depth control');

  await send('touchStart', [30, 80]);
  await send('touchMove', [30, 126]);
  await send('touchCancel');
  const cancelled = await lineDepth(page);
  await tick(250);
  assert.ok(Math.abs(await lineDepth(page) - cancelled) < 2, 'cancellation does not launch a flick');
  await page.keyboard.press('Home');
  await tick(1200);
  await send('touchStart', [30, 80]);
  await send('touchMove', [30, 135]);
  await send('touchCancel');
  const resting = await lineDepth(page);
  await page.touchscreen.tap(32, 95);
  await tick(90);
  assert.ok(await lineDepth(page) < resting - 5, 'the next single tap jigs after cancellation');
  await tick(300);
  assert.ok(Math.abs(await lineDepth(page) - resting) < 2, 'the jig settles to its original depth');

  await press(tray.getByRole('button', { name: 'Menu', exact: true }));
  const pause = page.getByRole('dialog', { name: 'Paused' });
  await pause.waitFor();
  const pausedDepth = await lineDepth(page);
  await send('touchStart', [24, 75]);
  await send('touchMove', [24, 135]);
  await send('touchEnd');
  await tick(450);
  assert.equal(await lineDepth(page), pausedDepth, 'the modal keeps gestures outside the playfield');
  await closeDialog(pause, pause.getByRole('button', { name: 'Resume fishing' }));
  assert.deepEqual(errors, []);
  await cdp.detach();
  await page.close();
  console.log('PASS: Campaign touch cancellation, single jig, and modal input isolation');
});
