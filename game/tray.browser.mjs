import assert from 'node:assert/strict';
import { practicePage, withBrowser } from './browser-qa.mjs';

async function attachedLine(page) {
  return page.locator('.fishing-line-path').evaluate(path => {
    const screen = point => point.matrixTransform(path.getScreenCTM());
    const start = screen(path.getPointAtLength(0));
    const end = screen(path.getPointAtLength(path.getTotalLength()));
    const eye = document.querySelector('.fishing-line-eye').getBoundingClientRect();
    const ice = document.querySelector('.dive-ceiling').getBoundingClientRect();
    const gap = Math.hypot(end.x - (eye.left + eye.width / 2), end.y - (eye.top + eye.height / 2));
    return { gap, startX: start.x - ice.left, startY: start.y - ice.top,
      holeX: ice.width * .62, holeY: ice.height * 20 / 110, depth: end.y - start.y, endY: end.y };
  });
}

function startsAtHole(line) {
  return Math.abs(line.startX - line.holeX) < 1 && Math.abs(line.startY - line.holeY) < 1;
}

async function assertAttached(page) {
  const line = await attachedLine(page);
  assert.ok(line.gap < 1, 'the line ends at the eye of the lure');
  assert.ok(startsAtHole(line),
    `the line starts at the ice hole: ${JSON.stringify(line)}`);
  return line;
}

async function scrollStep(page, direction, mobile) {
  const start = await page.evaluate(() => scrollY);
  if (mobile) {
    const touch = await page.context().newCDPSession(page);
    const send = (type, y) => touch.send('Input.dispatchTouchEvent', {
      type, touchPoints: y === undefined ? [] : [{ x: 160, y }],
    });
    const from = direction > 0 ? 350 : 170;
    await send('touchStart', from);
    for (const delta of [60, 120, 180]) await send('touchMove', from - direction * delta);
    await page.waitForTimeout(160);
    await send('touchEnd');
    await touch.detach();
  } else if (direction > 0) {
    await page.mouse.move(600, 250);
    await page.mouse.wheel(0, 250);
  } else {
    await page.keyboard.press('ArrowUp');
  }
  await page.waitForFunction(([y, dir]) => (scrollY - y) * dir > 0, [start, direction], { polling: 25 });
  await page.clock.runFor(40);
}

async function checkTray(browser, mobile) {
  const { page, tray, launch, action, button, status, press, tick, findFish, chooseMode, errors, reelToHole } =
    await practicePage(browser, { mobile });
  await press(launch);
  const picker = page.getByRole('dialog', { name: 'Choose an outing' });
  assert.equal(await picker.isVisible(), true, 'the site entry offers a choice of outings');
  assert.equal(await picker.getByRole('button', { name: 'Practice', exact: true }).isVisible(), true);
  assert.equal(await picker.getByRole('button', { name: 'Ranked', exact: true }).count(), 0);
  await chooseMode('Campaign');
  await tray.locator('[data-wallet]').waitFor();
  assert.match(await tray.locator('[data-score]').textContent(), /Mille Lacs.*Campaign/);
  assert.equal(await action.isDisabled(), true);
  assert.match(await status.textContent(), /scroll.*find the fish/i);

  const initial = await assertAttached(page);
  await scrollStep(page, 1, mobile);
  const deeper = await assertAttached(page);
  assert.ok(deeper.depth > initial.depth + 30, 'scrolling down pays out line');
  await scrollStep(page, -1, mobile);
  const shallower = await assertAttached(page);
  assert.ok(shallower.depth < deeper.depth - 15, 'scrolling up takes in line');
  if (!mobile) {
    await page.setViewportSize({ width: 1000, height: 660 });
    // Deliver the browser's resize and observer callbacks even when the test clock is paused.
    for (let frame = 0; frame < 12; frame++) {
      await tick(32);
      if (startsAtHole(await attachedLine(page))) break;
      await page.waitForTimeout(16);
    }
    await assertAttached(page);
  }

  await findFish();
  const box = await tray.boundingBox();
  assert.ok(box.x >= 0 && box.x + box.width <= (mobile ? 320 : 1000));
  const slots = await Promise.all(['Jig', 'Spoon', 'Minnow'].map(name =>
    tray.getByRole('group', { name: 'Lures' }).getByRole('button', { name, exact: true }).boundingBox()));
  assert.ok(slots.every(slot => slot && slot.width >= 44 && slot.height >= 44 && slot.x + slot.width <= box.x + box.width));

  await press(button('Spoon'));
  const still = await assertAttached(page);
  await press(action);
  await tick(110);
  const jiggled = await assertAttached(page);
  if (!mobile) assert.ok(jiggled.endY < still.endY - 3, 'the lure and line rise together during a jig');
  assert.match(await status.textContent(), /try a different lure/i);
  await press(tray.getByRole('group', { name: 'Lures' }).getByRole('button', { name: 'Jig', exact: true }));
  await tick(29350);
  assert.match(await tray.getByRole('timer').textContent(), /1s/);
  await press(action);
  await tick(700);
  assert.match(await status.textContent(), /yeah, reel it/i, 'a late bite keeps its hook window');
  await press(action);
  await reelToHole();
  await press(action);
  await tray.getByText(/Yellow perch.*points/i).waitFor();
  if (!mobile) {
    assert.equal(await action.evaluate(el => el === document.activeElement && el.matches(':focus-visible')), true);
    await page.keyboard.press('Escape');
    await press(page.locator('.fishing-pause').getByRole('button', { name: 'Leave outing', exact: true }));
    assert.equal(await launch.evaluate(el => el === document.activeElement), true);
  }
  assert.deepEqual(errors, []);
  await page.close();
}

await withBrowser(async browser => {
  for (const mobile of [false, true]) {
    await checkTray(browser, mobile);
    console.log(`PASS: Campaign tray and attached lure (${mobile ? '320 px touch' : 'desktop keyboard and wheel'})`);
  }
});
