import assert from 'node:assert/strict';
import { practicePage, withBrowser } from './browser-qa.mjs';

async function checkMilestone(browser, choice) {
  const mobile = choice === 'Lift';
  const { enter, page, tray, action, button, status, errors, press, tick, findFish } =
    await practicePage(browser, { mobile });
  const celebration = page.locator('.fishing-celebration');
  const levelOne = tray.getByText(/0\s*\/\s*20 XP to Level 2/);
  const levelTwo = tray.getByText(/Level 2 · 20 XP/);
  const control = tray.getByRole('button', { name: /^Line Control\b/ });
  const lift = tray.getByRole('button', { name: /^Lift\b/ });
  const landCommon = async () => {
    await press(action);
    await tick(600);
    await press(action);
  };

  await enter();
  await findFish();
  await press(action);
  await press(action);
  assert.match(await status.textContent(), /slipped the hook/i);
  assert.equal(await levelOne.isVisible(), true, 'a missed reel earns zero XP');
  await tick(260);
  await landCommon();
  assert.match(await status.textContent(), /Yellow perch.*\+10 points/);
  assert.equal(await tray.getByText(/10\s*\/\s*20 XP to Level 2/).isVisible(), true);
  assert.equal(await celebration.isHidden(), true, 'catch one earns XP without a ribbon');
  assert.equal(await control.isHidden(), true);
  await press(action);
  await tick(260);
  await findFish();

  await landCommon();
  assert.match(await status.textContent(), /Rock bass.*\+15 points.*Level 2.*choose a skill/i);
  assert.equal(await levelTwo.isVisible(), true);
  assert.equal(await celebration.getByText('Level 2', { exact: true }).isVisible(), true);
  assert.equal(await control.getByText(/350 ms/).isVisible(), true);
  assert.equal(await lift.getByText(/one fewer pull/i).isVisible(), true);
  if (mobile) {
    assert.equal(await celebration.evaluate(el => getComputedStyle(el).animationName), 'none');
    assert.equal(await celebration.locator('img').isVisible(), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  }
  await tick(3650);
  assert.equal(await celebration.isHidden(), true);
  assert.equal(await control.isVisible(), true, 'the choice outlasts the ribbon');
  assert.equal(await lift.isVisible(), true);
  if (choice) {
    if (mobile) {
      await press(lift);
    } else {
      assert.equal(await action.evaluate(el => el === document.activeElement), true);
      await page.keyboard.press('Tab');
      assert.equal(await control.evaluate(el => el === document.activeElement), true);
      await page.keyboard.press('Enter');
    }
    assert.equal(await action.evaluate(el => el === document.activeElement), true);
    assert.match(await status.textContent(), /Rock bass.*\+15 points/);
    assert.equal(await control.isHidden(), true);
    assert.equal(await lift.isHidden(), true);
  }
  assert.match(await action.textContent(), /Next fish/);
  await press(action);
  assert.equal(await control.isHidden(), true);
  await tick(260);
  await findFish();
  await press(button('Minnow'));
  await press(action);
  await tick(2250);
  if (choice !== 'Line Control') {
    assert.match(await status.textContent(), /window passed/i);
    await press(action);
    assert.match(await status.textContent(), /slipped the hook/i);
    assert.equal(await levelTwo.isVisible(), true);
    await press(action);
    await tick(600);
  }
  assert.match(await status.textContent(), /yeah, reel it!/i);
  await press(action);
  assert.match(await status.textContent(), /tight line.*loosen/i);
  assert.equal(await levelTwo.isVisible(), true, 'hooking a fighter earns no XP yet');
  const pullCount = choice === 'Lift' ? 1 : 2;
  for (let i = 0; i < pullCount; i++) {
    await tick(260);
    await press(button('Loosen'));
    assert.match(await action.textContent(), i === pullCount - 1 ? /Pull up/ : /Reel/);
    await tick(260);
    await press(action);
  }
  assert.match(await status.textContent(), /Walleye.*\+25 points/);
  assert.equal(await tray.getByText(/Level 2 · 30 XP/).isVisible(), true);
  assert.match(await tray.locator('[data-score]').textContent(), /50 pts/);
  assert.equal(await celebration.isHidden(), true, 'there is only one milestone per outing');
  assert.equal(await control.isHidden(), true);

  if (choice === 'Line Control') {
    await press(button('Exit fishing'));
    await enter();
    await findFish();
    assert.equal(await levelOne.isVisible(), true);
    assert.match(await tray.locator('[data-score]').textContent(), /0 pts/);
    await press(action);
    await tick(2250);
    assert.match(await status.textContent(), /window passed/i, 'a new outing resets Line Control');
  }
  assert.deepEqual(errors, []);
  await page.close();
}

await withBrowser(async browser => {
  const choices = ['Line Control', 'Lift', null];
  const results = await Promise.allSettled(choices.map(choice => checkMilestone(browser, choice)));
  for (const [i, result] of results.entries()) {
    const label = choices[i] ?? 'skip';
    if (result.status === 'fulfilled') console.log(`PASS: Level 2 · ${label}`);
    else console.error(`FAIL: Level 2 · ${label}`, result.reason);
  }
  if (results.some(result => result.status === 'rejected')) process.exitCode = 1;
});
