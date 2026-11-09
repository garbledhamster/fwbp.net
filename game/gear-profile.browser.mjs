import assert from 'node:assert/strict';
import { practicePage, withBrowser } from './browser-qa.mjs';

// Real IndexedDB writes establish old/current persisted records at the public save boundary.
async function storeProfile(page, saved) {
  await page.evaluate(saved => new Promise((resolve, reject) => {
    const request = indexedDB.open('fwbp-campaign', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('profile');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction('profile', 'readwrite');
      transaction.objectStore('profile').put(saved, 'campaign');
      transaction.oncomplete = () => { db.close(); resolve(); };
      transaction.onabort = () => { db.close(); reject(transaction.error); };
    };
  }), saved);
}

function command(page, input) {
  return page.evaluate(async input => {
    const module = await import('./game/profile.mjs?v=16');
    return input ? module.applyProfile(input) : module.loadProfile();
  }, input);
}

const legacy = {
  version: 1, revision: 9, coins: 40, elapsedMs: 64000,
  owned: ['starter-line', 'starter-hook', 'starter-license', 'stronger-line', 'finesse-hook', 'deep-reef-license', 'line-control'],
  equipped: { line: 'stronger-line', hook: 'finesse-hook' },
  awards: { 'old-outing:0': 10, 'old-outing:1': 25 },
};

await withBrowser(async browser => {
  const { leave, page, launch, tray, press, button, errors } = await practicePage(browser);
  const fresh = await command(page);
  assert.equal(fresh.coins, 0);
  assert.deepEqual(fresh.equipped, { line: 'starter-line', hook: 'starter-hook' });
  assert.equal(fresh.owned.includes('starter-license'), false, 'a fresh player claims the free permit explicitly');
  const claimed = await command(page, { type: 'buy', id: 'starter-license', revision: fresh.revision });
  assert.equal(claimed.status, 'bought');
  assert.equal(claimed.profile.coins, 0);
  assert.equal(claimed.profile.owned.includes('starter-license'), true);
  const duplicateClaim = await command(page, { type: 'buy', id: 'starter-license', revision: claimed.profile.revision });
  assert.equal(duplicateClaim.status, 'already-owned');
  assert.deepEqual(duplicateClaim.profile, claimed.profile);

  const payout = key => ({ type: 'award', key, outcome: 'landed', catch: { points: 10, id: 'perch' } });
  const first = await command(page, payout('new-outing:0'));
  assert.equal(Boolean(first.milestoneReached), false);
  const second = await command(page, payout('new-outing:1'));
  assert.equal(second.milestoneReached, true, 'the second committed Campaign payout crosses the badge in its transaction');
  const repeated = await command(page, payout('new-outing:1'));
  assert.equal(repeated.status, 'duplicate-award');
  assert.equal(Boolean(repeated.milestoneReached), false, 'a retry cannot repeat the badge');
  const third = await command(page, payout('other-outing:0'));
  assert.equal(Boolean(third.milestoneReached), false);
  assert.equal(third.profile.coins, 30, 'the badge grants no extra coins');

  await storeProfile(page, legacy);
  await page.reload({ waitUntil: 'domcontentloaded' });
  const migrated = await command(page);
  for (const field of ['coins', 'elapsedMs', 'equipped', 'awards', 'owned']) {
    assert.deepEqual(migrated[field], legacy[field], `migration preserves ${field}`);
  }
  const again = await command(page);
  assert.deepEqual(again, migrated, 'repeated reads do not change the migrated record');
  await press(launch, 'Enter');
  const picker = page.getByRole('dialog', { name: 'Choose an outing' });
  const reef = picker.getByRole('button', { name: 'Deep Reef', exact: true });
  await press(reef);
  await tray.locator('[data-wallet]').waitFor();
  assert.match(await tray.locator('[data-score]').textContent(), /Deep Reef/);
  await leave();

  // An area can become unavailable between rendering the picker and activation.
  await press(launch, 'Enter');
  await picker.waitFor();
  const saved = await command(page);
  await storeProfile(page, { ...saved, revision: saved.revision + 1, owned: saved.owned.filter(id => id !== 'deep-reef-license') });
  await press(reef);
  const guide = page.locator('.fishing-permit');
  await guide.waitFor();
  await page.waitForFunction(() => !document.querySelector('[data-permit-shop]').disabled);
  assert.match(await guide.textContent(), /Deep Reef needs the Deep Reef permit/);
  assert.equal(await tray.isHidden(), true, 'fresh ownership controls access even when the picker showed prior eligibility');
  await press(guide.getByRole('button', { name: 'Back to areas' }));
  assert.equal(await reef.evaluate(el => el === document.activeElement), true);
  assert.deepEqual(errors, []);
  await page.close();
  console.log('PASS: new/legacy permits, atomic once-only milestone and stale area access');
});
