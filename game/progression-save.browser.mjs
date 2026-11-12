import assert from 'node:assert/strict';
import { withBrowser } from './browser-qa.mjs';
const url = process.env.FISHING_QA_URL ?? 'http://127.0.0.1:9867/';
await withBrowser(async browser => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
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
    return { ...result, progress: m.campaignProgress(result.profile), angler: m.anglerProgress(result.profile) };
  }, command);
  const migrated = await command();
  assert.deepEqual(migrated.profile, { ...legacy, version: 3, revision: 13, coins: 100, reefPermitRefunded: true,
    skillRanks: { lure: 0, control: 2, drilling: 1 },
    angler: { bonus: 4, ranks: { line: 2, rhythm: 0, hook: 0 } } });
  assert.equal(migrated.progress.level, 7);
  assert.deepEqual(migrated.angler, { earned: 6, spent: 2, points: 4 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  assert.deepEqual(await command(), migrated);
  const replay = await command({ type: 'award', key: 'old:1', speciesId: 'pike', outcome: 'landed', catch: { points: 75 } });
  assert.equal(replay.status, 'duplicate-award');
  assert.deepEqual(replay.profile, migrated.profile);
  const other = await page.context().newPage();
  await other.goto(url, { waitUntil: 'domcontentloaded' });
  const spend = { type: 'learn-angler', id: 'line', revision: migrated.profile.revision, betweenOutings: true };
  const results = await Promise.all([command(spend), other.evaluate(async spend =>
    (await import('./game/profile.mjs')).applyProfile(spend), spend)]);
  assert.deepEqual(results.map(result => result.status).sort(), ['learned', 'stale']);
  await other.close();
  const learned = await command();
  assert.equal(learned.profile.angler.ranks.line, 3);
  assert.deepEqual(learned.angler, { earned: 6, spent: 3, points: 3 });
  const reset = await command({ type: 'reset-angler', revision: learned.profile.revision, betweenOutings: true });
  assert.deepEqual(reset.angler, { earned: 6, spent: 0, points: 6 });
  assert.deepEqual(reset.profile.skillRanks, migrated.profile.skillRanks);
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
  assert.deepEqual(duplicate.profile, saved.profile);
  assert.deepEqual(duplicate.angler, { earned: 7, spent: 0, points: 7 });
  assert.deepEqual(saved.profile.caughtSpecies, ['perch', 'pike', 'walleye']);
  assert.equal(saved.profile.elapsedMs, legacy.elapsedMs); assert.deepEqual(saved.profile.owned, legacy.owned);
  const cap = await page.evaluate(async () => {
    const { applyProfile, anglerProgress, anglerSkillLimits, loadProfile } = await import('./game/profile.mjs');
    for (let index = 0; index < 5; index++) {
      await applyProfile({ type: 'award', key: `training:${index}`, outcome: 'landed', catch: { points: 10 } });
    }
    const { profile: started } = await applyProfile({ type: 'begin-day' });
    let profile = started;
    const rejected = {};
    for (const [id, count] of Object.entries(anglerSkillLimits)) {
      for (let rank = 0; rank < count; rank++) {
        const spent = await applyProfile({ type: 'learn-angler', id, revision: profile.revision, betweenOutings: true });
        if (spent.status !== 'learned') throw new Error(`Rank allocation failed: ${id} ${rank} ${spent.status}`);
        profile = spent.profile;
      }
      rejected[id] = (await applyProfile({ type: 'learn-angler', id, revision: profile.revision, betweenOutings: true })).status;
    }
    const saved = await loadProfile();
    return { progress: anglerProgress(saved), rejected, startedDay: started.day, savedDay: saved.day, ranks: saved.angler.ranks };
  });
  assert.deepEqual(cap.progress, { earned: 12, spent: 11, points: 1 });
  assert.deepEqual(cap.rejected, { line: 'capped', rhythm: 'capped', hook: 'capped' });
  assert.deepEqual(cap.ranks, { line: 5, rhythm: 3, hook: 3 });
  assert.deepEqual(cap.savedDay, cap.startedDay);
  console.log('PASS: legacy permit refund and rank migration, idempotent catch credit, concurrent spend, all caps, and atomic retry');
  await page.close();
});
