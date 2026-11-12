import assert from 'node:assert/strict';
import { withBrowser, practicePage } from './browser-qa.mjs';

await withBrowser(async browser => {
  for (const viewport of [{ width: 1200, height: 720 }, { width: 320, height: 720 }, { width: 720, height: 320 }]) {
    const { page, openGame, press, closeDialog, errors } = await practicePage(browser, { viewport, mobile: viewport.width < 900 });
    const result = await page.evaluate(async () => {
      const { applyProfile, anglerProgress, loadProfile } = await import('./game/profile.mjs');
      const landing = { type: 'award', key: 'legacy:0', outcome: 'landed', catch: { points: 100 }, speciesId: 'perch' };
      const { profile } = await applyProfile(landing);
      const before = anglerProgress(profile);
      const learned = await applyProfile({ type: 'learn-angler', id: 'line', revision: profile.revision, betweenOutings: true });
      const stale = await applyProfile({ type: 'learn-angler', id: 'hook', revision: profile.revision, betweenOutings: true });
      const blocked = await applyProfile({ type: 'reset-angler', revision: learned.profile.revision, betweenOutings: false });
      const reset = await applyProfile({ type: 'reset-angler', revision: learned.profile.revision, betweenOutings: true });
      const replay = await applyProfile(landing);
      return { before, learned, stale, blocked, reset, replay, after: anglerProgress(await loadProfile()) };
    });
    assert.equal(result.learned.status, 'learned');
    assert.equal(result.stale.status, 'stale');
    assert.equal(result.blocked.status, 'outing-active');
    assert.equal(result.reset.profile.coins, result.learned.profile.coins);
    assert.equal(result.replay.status, 'duplicate-award');
    assert.equal(result.after.points, result.before.points);
    await openGame();
    const entry = page.getByRole('button', { name: 'Angler Skills', exact: true });
    await press(entry, 'Enter');
    const sheet = page.getByRole('dialog', { name: 'Angler Skills', exact: true });
    for (const name of ['Line control', 'Reel rhythm', 'Hook timing']) {
      const control = sheet.getByRole('button', { name: `Add one rank to ${name}` });
      await control.waitFor();
      const box = await control.boundingBox();
      assert.ok(box && box.width >= 44 && box.height >= 44);
    }
    await press(sheet.getByRole('button', { name: 'Add one rank to Hook timing' }), 'Enter');
    await sheet.getByText('Rank added.', { exact: true }).waitFor();
    await closeDialog(sheet, sheet.getByRole('button', { name: 'Back', exact: true }));
    assert.equal(await entry.evaluate(el => el === document.activeElement), true);
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('PASS: Angler skill transactions, focus and touch targets on desktop, portrait and landscape');
});
