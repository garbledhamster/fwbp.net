import assert from 'node:assert/strict';
import { withBrowser } from './browser-qa.mjs';

const url = process.env.FISHING_QA_URL ?? 'http://127.0.0.1:9867/';
const command = (page, value) => page.evaluate(async value => {
  const save = await import('./game/profile.mjs?v=16');
  return value ? save.applyProfile(value) : save.loadProfile();
}, value);
const landing = (key, speciesId, mode = 'campaign') => ({
  type: 'award', key, speciesId, mode, outcome: 'landed', catch: { points: 10 },
});

await withBrowser(async browser => {
  const context = await browser.newContext();
  try {
    const first = await context.newPage();
    const second = await context.newPage();
    await Promise.all([first.goto(url), second.goto(url)]);
    const initial = await command(first);
    assert.deepEqual(initial.caughtSpecies, []);
    assert.equal((await command(first, { type: 'study', speciesId: 'perch' })).status, 'not-caught');
    assert.equal((await command(first, landing('bad:0', 'carp'))).status, 'no-award');
    assert.equal((await command(first, { ...landing('hooked:0', 'perch'), outcome: 'fight' })).status, 'no-award');

    // Aborting the real transaction must roll back wallet, ledger and collection together.
    await first.evaluate(() => {
      const original = IDBDatabase.prototype.transaction;
      IDBDatabase.prototype.transaction = function (...args) {
        const transaction = original.apply(this, args);
        IDBDatabase.prototype.transaction = original;
        queueMicrotask(() => transaction.abort());
        return transaction;
      };
    });
    await assert.rejects(command(first, landing('retry:0', 'perch')));
    assert.deepEqual(await command(first), initial);
    const simultaneous = await Promise.all([
      command(first, landing('retry:0', 'perch')), command(second, landing('retry:0', 'perch')),
    ]);
    assert.deepEqual(simultaneous.map(result => result.status).sort(), ['awarded', 'duplicate-award']);
    assert.equal((await command(first)).coins, 10);
    await Promise.all([
      command(first, landing('practice:0', 'walleye', 'practice')),
      command(second, { type: 'study', speciesId: 'perch' }),
    ]);
    let saved = await command(first);
    assert.equal(saved.coins, 10, 'Practice earns collection only');
    assert.deepEqual(saved.caughtSpecies.sort(), ['perch', 'walleye']);
    assert.deepEqual(saved.studiedSpecies, ['perch']);
    const duplicate = await command(first, landing('practice:0', 'walleye', 'practice'));
    assert.equal(duplicate.status, 'duplicate-award');
    assert.equal((await command(first, landing('ranked:0', 'pike', 'ranked'))).status, 'no-award');
    const secondCatch = await Promise.all([
      command(first, landing('second:0', 'perch')), command(second, landing('second:0', 'perch')),
    ]);
    assert.equal(secondCatch.filter(result => result.milestoneReached).length, 1, 'only the committed second Campaign award announces the milestone');
    assert.equal((await command(first)).coins, 15, 'a second perch earns half once Bryan asks for pike');
    const beforeStudy = await command(first);
    const learned = await command(first, { type: 'study', speciesId: 'walleye' });
    assert.equal(learned.status, 'studied');
    assert.equal((await command(first, { type: 'buy', id: 'stronger-line', revision: beforeStudy.revision })).status, 'stale');
    for (const [index, id] of ['rock-bass', 'pike', 'smallmouth', 'muskie'].entries()) {
      await command(first, landing(`six:${index}`, id, 'practice'));
    }
    await first.reload();
    saved = await command(first);
    assert.equal(saved.caughtSpecies.length, 6);

    await first.evaluate(async () => {
      const { openYourLake } = await import('./game/collection.mjs');
      openYourLake();
    });
    await first.locator('#your-lake button[data-species="perch"]').click();
    assert.match(await first.locator('#your-lake').textContent(), /Yellow perch/);
    assert.equal(await first.locator('#your-lake .collection-guide-portrait').count(), 1);
    await first.locator('#your-lake [data-back]').click();
    assert.equal(await first.locator('#your-lake [data-species]').count(), 6);
    await first.locator('#your-lake [data-close]').click();

    // A stored v1 payout never reconstructs a catch, even when replayed with metadata.
    const legacy = { version: 1, revision: 8, coins: 91, awards: { 'old:0': 25 },
      owned: ['starter-line', 'starter-hook', 'starter-license', 'deep-reef-license'],
      equipped: { line: 'starter-line', hook: 'starter-hook' }, elapsedMs: 4567, custom: 'retained' };
    await first.evaluate(legacy => new Promise((resolve, reject) => {
      const open = indexedDB.open('fwbp-campaign', 1);
      open.onsuccess = () => {
        const tx = open.result.transaction('profile', 'readwrite');
        tx.objectStore('profile').put(legacy, 'campaign');
        tx.oncomplete = () => { open.result.close(); resolve(); };
        tx.onabort = () => reject(tx.error);
      };
    }), legacy);
    const migrated = await command(first);
    assert.equal(migrated.version, 2);
    assert.equal(migrated.coins, 91);
    assert.equal(migrated.elapsedMs, 4567);
    assert.equal(migrated.custom, 'retained');
    assert.deepEqual(migrated.owned, legacy.owned);
    assert.deepEqual(migrated.caughtSpecies, []);
    assert.equal(migrated.revision, 9);
    assert.deepEqual(await command(second), migrated, 'migration runs once');
    assert.equal((await command(first, landing('old:0', 'walleye'))).status, 'duplicate-award');
    assert.deepEqual((await command(first)).caughtSpecies, []);

    await first.locator('#fish-guide-toggle').click();
    await first.locator('body[data-fish-mode]').waitFor();
    assert.equal(await first.locator('.fish-target:visible').count(), 0);
    assert.equal(await first.locator('.fish-target:not([disabled])').count(), 0);
    await first.locator('#fish-guide-toggle').click();
    assert.equal(await first.locator('.fish-target:visible').evaluateAll(nodes => new Set(nodes.map(node => node.dataset.fish)).size), 23);
    console.log('PASS: collection atomicity, Practice, study, migration, nested cards and lake filtering');
  } finally { await context.close(); }
});
