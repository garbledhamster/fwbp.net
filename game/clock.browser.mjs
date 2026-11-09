import assert from 'node:assert/strict';
import { practicePage, withBrowser } from './browser-qa.mjs';

await withBrowser(async browser => {
  const { page, tray, launch, action, button, status, press, enter, tick, findFish, errors, reelToHole } =
    await practicePage(browser);
  const label = tray.locator('[data-phase]');
  const lake = page.locator('.lake');
  const color = () => lake.evaluate(el => getComputedStyle(el).backgroundImage);
  const expectPhase = async name => {
    await label.filter({ hasText: name }).waitFor();
    assert.equal(await label.getAttribute('data-phase'), name.toLowerCase());
  };
  const savedProfile = () => page.evaluate(async () => {
    const { loadProfile } = await import('./game/profile.mjs?v=16');
    return loadProfile();
  });

  await enter('Campaign');
  assert.equal(await label.isVisible(), true, 'the phase is shown in the Campaign tray');
  await expectPhase('Day');
  const daylight = await color();
  await tick(29200);
  await findFish();
  await press(action);
  await tick(900);
  await expectPhase('Dusk');
  const dusk = await color();
  assert.notEqual(dusk, daylight);
  assert.match(await status.textContent(), /yeah, reel it/i, 'the phase change keeps the active bite window');
  await press(action);
  await reelToHole();
  await press(action);
  await status.filter({ hasText: /yellow perch.*10 coins/i }).waitFor();
  await press(button('Exit fishing'));

  await press(launch, 'Enter');
  await press(page.getByRole('button', { name: 'Tackle shop', exact: true }));
  const beforeShop = await savedProfile();
  await tick(90000);
  await page.reload();
  await enter('Campaign');
  await expectPhase('Dusk');
  assert.equal(await color(), dusk);
  assert.equal((await savedProfile()).elapsedMs, beforeShop.elapsedMs, 'the shop does not advance the saved clock');

  await tick(30000);
  await expectPhase('Night');
  const night = await color();
  assert.notEqual(night, dusk);
  assert.notEqual(night, daylight);

  await page.reload();
  await enter('Campaign');
  await expectPhase('Night');
  await tick(45000);
  await expectPhase('Day');
  assert.equal(await color(), daylight);

  await press(button('Exit fishing'));
  const beforePractice = await savedProfile();
  await enter('Practice');
  assert.equal(await label.isHidden(), true);
  await tick(120000);
  await press(button('Exit fishing'));
  assert.equal((await savedProfile()).elapsedMs, beforePractice.elapsedMs);
  assert.equal((await savedProfile()).revision, beforePractice.revision, 'clock saves do not change shop revisions');
  const afterStaleWrite = await page.evaluate(async elapsedMs => {
    const { applyProfile } = await import('./game/profile.mjs?v=16');
    return (await applyProfile({ type: 'clock', elapsedMs: elapsedMs - 5000 })).profile;
  }, beforePractice.elapsedMs);
  assert.equal(afterStaleWrite.elapsedMs, beforePractice.elapsedMs, 'older clock writes do not roll back the phase');
  await enter('Campaign');
  await tick(31000);
  await action.getByText('Next fish', { exact: true }).waitFor();
  await page.clock.fastForward(20 * 60 * 1000);
  assert.match(await action.textContent(), /Fish again/i, 'an idle campaign outing ends at expiry');
  const atExpiry = (await savedProfile()).elapsedMs;
  assert.ok(atExpiry <= beforePractice.elapsedMs + 20 * 60 * 1000);
  await tick(10000);
  assert.equal((await savedProfile()).elapsedMs, atExpiry, 'an expired outing no longer advances the clock');
  assert.deepEqual(errors, []);
  await page.close();
  console.log('PASS: Campaign lighting, active bite at dusk, and clock persistence');
});
