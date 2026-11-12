import assert from 'node:assert/strict';
import { withBrowser } from './browser-qa.mjs';
const url = process.env.FISHING_QA_URL ?? 'http://127.0.0.1:9867/';
await withBrowser(async browser => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(url);
  const legacy = { version: 2, revision: 12, coins: 75, awards: { 'old:0': 25, 'old:1': 375 },
    collectionAwards: { 'practice:0': 'perch' }, caughtSpecies: ['perch', 'pike'], studiedSpecies: ['perch'],
    owned: ['starter-line', 'starter-hook', 'stronger-line', 'line-control', 'deep-reef-license', 'starter-license'],
    equipped: { line: 'stronger-line', hook: 'starter-hook' }, elapsedMs: 12345, techniques: ['line-control-2', 'drilling-1'] };
  await page.evaluate(async legacy => {
    const m = await import('./game/profile.mjs'); await m.loadProfile();
    await new Promise((resolve, reject) => {
      const open = indexedDB.open('fwbp-campaign', 1); open.onsuccess = () => {
        const tx = open.result.transaction('profile', 'readwrite'); tx.objectStore('profile').put(legacy, 'campaign');
        tx.oncomplete = () => { open.result.close(); resolve(); }; tx.onabort = () => reject(tx.error);
      };
    });
  }, legacy);
  const command = command => page.evaluate(async command => {
    const m = await import('./game/profile.mjs');
    const result = command ? await m.applyProfile(command) : { profile: await m.loadProfile() };
    return { ...result, progress: m.campaignProgress(result.profile), training: m.campaignTraining(result.profile) };
  }, command);
  const migrated = await command();
  assert.deepEqual(migrated.profile, { ...legacy, revision: 13, coins: 100, reefPermitRefunded: true,
    skillRanks: { lure: 0, control: 2, drilling: 1 } });
  assert.equal(migrated.progress.level, 7);
  assert.equal(migrated.progress.points, 3);
  assert.equal(migrated.training.hookLateMs, 700);
  await page.reload();
  assert.deepEqual(await command(), migrated);
  const replay = await command({ type: 'award', key: 'old:1', speciesId: 'pike', outcome: 'landed', catch: { points: 75 } });
  assert.equal(replay.status, 'duplicate-award');
  assert.deepEqual(replay.profile, migrated.profile);
  const other = await page.context().newPage();
  await other.goto(url);
  const spend = { type: 'learn', id: 'control', revision: migrated.profile.revision, betweenOutings: true };
  const results = await Promise.all([command(spend), other.evaluate(async spend =>
    (await import('./game/profile.mjs')).applyProfile(spend), spend)]);
  assert.deepEqual(results.map(result => result.status).sort(), ['learned', 'stale']);
  await other.close();
  const learned = await command();
  assert.equal(learned.profile.skillRanks.control, 3);
  assert.equal(learned.progress.points, 2);
  const reset = await command({ type: 'reset-skills', revision: learned.profile.revision, betweenOutings: true });
  assert.equal(reset.training.hookLateMs, 350);
  assert.equal(reset.progress.points, 6);
  assert.equal(reset.profile.coins, 100);
  assert.deepEqual(reset.profile.equipped, legacy.equipped);
  assert.equal((await command({ type: 'buy', id: 'pro-line', revision: reset.profile.revision })).status, 'locked');
  await page.evaluate(() => {
    const original = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (...args) {
      const tx = original.apply(this, args); IDBDatabase.prototype.transaction = original; queueMicrotask(() => tx.abort()); return tx;
    };
  });
  const award = { type: 'award', key: 'retry:0', speciesId: 'walleye', outcome: 'landed', catch: { points: 25 } };
  await assert.rejects(command(award)); assert.deepEqual((await command()).profile, reset.profile);
  const saved = await command(award); const duplicate = await command(award);
  assert.equal(saved.profile.coins, 112); assert.equal(saved.progress.xp, 412);
  assert.deepEqual(duplicate.profile, saved.profile); assert.equal(duplicate.progress.xp, 412);
  assert.deepEqual(saved.profile.caughtSpecies, ['perch', 'pike', 'walleye']);
  assert.equal(saved.profile.elapsedMs, legacy.elapsedMs); assert.deepEqual(saved.profile.owned, legacy.owned);
  const cap = await page.evaluate(async () => {
    const { applyProfile, campaignProgress, loadProfile } = await import('./game/profile.mjs');
    const { profile: funded } = await applyProfile({
      type: 'award', key: 'training:0', outcome: 'landed', catch: { points: 12000 },
    });
    const { profile: started } = await applyProfile({ type: 'begin-day' });
    let profile = started;
    for (const [id, count] of [['control', 100], ['drilling', 20]]) {
      for (let rank = 0; rank < count; rank++) {
        const spent = await applyProfile({ type: 'learn', id, revision: profile.revision, betweenOutings: true });
        if (spent.status !== 'learned') throw new Error(`Rank allocation failed: ${id} ${rank} ${spent.status}`);
        profile = spent.profile;
      }
    }
    const rejected = await applyProfile({ type: 'learn', id: 'control', revision: profile.revision, betweenOutings: true });
    const saved = await loadProfile();
    await applyProfile({ type: 'end-day', dayId: saved.day.id });
    const { profile: next } = await applyProfile({ type: 'begin-day' });
    return { earned: campaignProgress(funded).earned, rejected: rejected.status, spent: campaignProgress(saved).spent,
      startedDay: started.day, savedDay: saved.day, nextDay: next.day, ranks: saved.skillRanks };
  });
  assert.equal(cap.earned, 121);
  assert.equal(cap.rejected, 'capped');
  assert.equal(cap.spent, 120);
  assert.equal(cap.ranks.control, 100);
  assert.deepEqual(cap.savedDay, cap.startedDay);
  assert.equal(cap.nextDay.allowance, 3);
  assert.equal(cap.nextDay.drillReduction, 1);
  console.log('PASS: v19 credit, reload/replay, retained gear/training/clock/collection, free reset, failed atomic XP/coin/collection retry');
  await page.close();
});
