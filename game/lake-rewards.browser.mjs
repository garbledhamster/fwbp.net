import assert from 'node:assert/strict';
import { withBrowser } from './browser-qa.mjs';

const url = process.env.FISHING_QA_URL ?? 'http://127.0.0.1:9867/';
const command = (page, input) => page.evaluate(async input => {
  const { applyProfile, loadProfile } = await import('./game/profile.mjs?v=campaign-ranks');
  return input ? applyProfile(input) : loadProfile();
}, input);
const openLake = page => page.evaluate(async () => {
  const { openYourLake } = await import('./game/collection.mjs?v=campaign-ranks');
  openYourLake();
});
const landing = (key, quality) => ({
  type: 'award', key, mode: 'campaign', outcome: 'landed', speciesId: 'perch',
  catch: {
    points: 10, speciesId: 'perch', length: quality === 1 ? 8 : 12, quality,
    age: quality === 1 ? 4 : 8, offense: quality === 1 ? 8 : 18,
    grade: quality === 1 ? 'Standard' : 'Trophy',
    line: { id: 'starter-line', name: 'Starter line' },
    hook: { id: 'starter-hook', name: 'Standard hooks' },
  },
});

await withBrowser(async browser => {
  const context = await browser.newContext();
  try {
    const [first, second] = await Promise.all([context.newPage(), context.newPage()]);
    for (const page of [first, second]) {
      // Before midnight in Chicago, even though the UTC date has changed.
      await page.clock.setFixedTime(new Date('2026-11-13T05:50:00Z'));
      await page.goto(url, { waitUntil: 'domcontentloaded' });
    }
    const legacy = await command(first, { ...landing('legacy:0', 1), speciesId: 'pike', catch: { points: 10 } });
    assert.equal(legacy.profile.coins, 5);
    const discovery = await command(first, landing('day:0', 1));
    assert.equal(discovery.profile.coins, 5, 'landing a specimen defers coins until the claim');
    assert.equal(discovery.pendingCoins, 18);
    assert.equal(discovery.profile.awards['day:0'], 10);
    const duplicates = await Promise.all([first, second].map(page => command(page, landing('day:1', 2))));
    const repeat = duplicates.find(result => result.status === 'awarded');
    assert.equal(repeat.pendingCoins, 24);
    assert.deepEqual(duplicates.map(result => result.status).sort(), ['awarded', 'duplicate-award']);
    assert.deepEqual(repeat.profile.fishRewards.perch, { coins: 42, discovery: true });

    await first.reload({ waitUntil: 'domcontentloaded' });
    await openLake(first);
    const lake = first.getByRole('dialog', { name: 'My Lake', exact: true });
    await lake.locator('[data-species="perch"]').click();
    assert.match(await lake.locator('[data-fish-reward]').textContent(), /42 coins.*first catch bonus/i);
    await lake.getByRole('button', { name: 'Collect Reward', exact: true }).click();
    const claimedFish = lake.locator('[data-fish-reward] [data-reward-summary]').filter({ hasText: '42 coins collected' });
    await claimedFish.waitFor();
    assert.ok(await claimedFish.evaluate(summary => summary === document.activeElement),
      'focus moves from the disabled claim button to the reward confirmation');
    assert.equal((await command(first)).coins, 47);
    await lake.locator('[data-back]').click();
    await lake.getByRole('button', { name: 'Collect Quest Reward', exact: true }).click();
    await lake.locator('[data-quest-reward]').filter({ hasText: '15 coins collected' }).waitFor();
    assert.equal((await command(first)).coins, 62);

    await first.reload({ waitUntil: 'domcontentloaded' });
    assert.equal((await command(first, { type: 'collect-fish', speciesId: 'perch' })).status, 'nothing-to-claim');
    assert.equal((await command(second, { type: 'collect-quest' })).status, 'nothing-to-claim');
    assert.equal((await command(first)).coins, 62);
    assert.equal((await command(first)).dailyQuest.day, '2026-11-12');
    await openLake(first);
    await lake.getByRole('heading', { name: 'My Lake', exact: true }).waitFor();
    assert.ok(await lake.locator('[data-collect-quest]').isDisabled());
    await lake.locator('[data-species="perch"]').click();
    assert.ok(await lake.locator('[data-collect-fish]').isDisabled());
    await lake.locator('[data-close]').click();

    await first.clock.setFixedTime(new Date('2026-11-13T06:01:00Z'));
    await second.clock.setFixedTime(new Date('2026-11-13T06:01:00Z'));
    const tomorrow = await command(first, landing('day:2', 1));
    assert.deepEqual(tomorrow.profile.dailyQuest, { day: '2026-11-13', count: 1, claimed: false });
    assert.equal(tomorrow.pendingCoins, 12, 'the first species premium is lifetime, not daily');
    const claims = await Promise.all([first, second].map(page => command(page, { type: 'collect-fish', speciesId: 'perch' })));
    assert.deepEqual(claims.map(result => result.status).sort(), ['claimed', 'nothing-to-claim']);
    const final = await command(first);
    assert.equal(final.coins, 74);
    assert.equal(Object.keys(final.landedFish).length, 3);
    assert.deepEqual(final.caughtSpecies, ['pike', 'perch']);
    assert.deepEqual(final.goalCatches, ['day:0']);
  } finally {
    await context.close();
  }
});
console.log('PASS: My Lake discovery and repeat rewards, independent quest, Chicago rollover and reload-safe claims');
