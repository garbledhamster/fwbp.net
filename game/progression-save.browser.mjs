import assert from 'node:assert/strict';
import { withBrowser } from './browser-qa.mjs';
const url = process.env.FISHING_QA_URL ?? 'http://127.0.0.1:9867/';
await withBrowser(async browser => {
  const page = await browser.newPage(); await page.goto(url);
  const legacy = { version: 2, revision: 12, coins: 75, awards: { 'old:0': 25, 'old:1': 75 },
    collectionAwards: { 'practice:0': 'perch' }, caughtSpecies: ['perch', 'pike'], studiedSpecies: ['perch'],
    owned: ['starter-line', 'starter-hook', 'stronger-line', 'line-control', 'deep-reef-license', 'starter-license'],
    equipped: { line: 'stronger-line', hook: 'starter-hook' }, elapsedMs: 12345 };
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
  const migrated = await command(); assert.deepEqual(migrated.profile, legacy);
  assert.equal(migrated.progress.level, 4); assert.equal(migrated.progress.points, 3); assert.equal(migrated.training.lineControlRank, 1);
  await page.reload(); assert.deepEqual(await command(), migrated);
  const replay = await command({ type: 'award', key: 'old:1', speciesId: 'pike', outcome: 'landed', catch: { points: 75 } });
  assert.equal(replay.status, 'duplicate-award'); assert.deepEqual(replay.profile, legacy);
  const learned = await command({ type: 'learn', id: 'line-control-2', revision: 12, betweenOutings: true });
  assert.equal(learned.status, 'learned'); assert.equal(learned.training.lineControlRank, 2); assert.equal(learned.progress.points, 1);
  const reset = await command({ type: 'reset-skills', revision: learned.profile.revision, betweenOutings: true });
  assert.equal(reset.training.lineControlRank, 1); assert.equal(reset.progress.points, 3);
  assert.equal(reset.profile.coins, 75); assert.deepEqual(reset.profile.equipped, legacy.equipped);
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
  assert.equal(saved.profile.coins, 87); assert.equal(saved.progress.xp, 112);
  assert.deepEqual(duplicate.profile, saved.profile); assert.equal(duplicate.progress.xp, 112);
  assert.deepEqual(saved.profile.caughtSpecies, ['perch', 'pike', 'walleye']);
  assert.equal(saved.profile.elapsedMs, legacy.elapsedMs); assert.deepEqual(saved.profile.owned, legacy.owned);
  console.log('PASS: v19 credit, reload/replay, retained gear/training/clock/collection, free reset, failed atomic XP/coin/collection retry');
  await page.close();
});
