import assert from 'node:assert/strict';
import { withBrowser } from './browser-qa.mjs';

const url = process.env.FISHING_QA_URL ?? 'http://127.0.0.1:9867/';
const lineId = 'stronger-line';

async function profileCommand(page, command) {
  return page.evaluate(async command => {
    const profile = await import(new URL('./game/profile.mjs', location.href));
    return command ? profile.applyProfile(command) : profile.loadProfile();
  }, command);
}

function landing(key, points) {
  return { type: 'award', key, outcome: 'landed', catch: { points } };
}

await withBrowser(async browser => {
  const context = await browser.newContext();
  try {
    const [first, second] = await Promise.all([context.newPage(), context.newPage()]);
    await Promise.all([first.goto(url, { waitUntil: 'domcontentloaded' }), second.goto(url, { waitUntil: 'domcontentloaded' })]);
    const module = await first.request.get(new URL('./game/profile.mjs', url).href);
    assert.ok(module.ok(), 'the browser can load the campaign save module');

    const starter = await profileCommand(first);
    assert.equal(starter.version, 3);
    assert.equal(starter.coins, 0);
    assert.deepEqual(starter.equipped, { line: 'starter-line', hook: 'starter-hook' });
    assert.ok(!starter.owned.includes('starter-license'));
    assert.deepEqual(starter.caughtSpecies, []);
    assert.deepEqual(starter.studiedSpecies, []);
    const buy = revision => ({ type: 'buy', id: lineId, revision });
    const equip = (id, revision) => ({ type: 'equip', id, revision });
    const locked = await profileCommand(first, buy(starter.revision));
    assert.equal(locked.status, 'locked');
    assert.deepEqual(locked.profile, starter);
    const unowned = await profileCommand(first, equip(lineId, starter.revision));
    assert.equal(unowned.status, 'not-owned');
    assert.deepEqual(unowned.profile, starter);
    for (const outcome of ['missed', 'snap']) {
      const miss = await profileCommand(first, { ...landing('outing-one:0', 10), outcome });
      assert.equal(miss.status, 'no-award');
      assert.deepEqual(miss.profile, starter);
    }

    const catchAward = landing('outing-one:0', 10);
    const simultaneousAwards = await Promise.all([
      profileCommand(first, catchAward), profileCommand(second, catchAward),
    ]);
    assert.deepEqual(simultaneousAwards.map(result => result.status).sort(), ['awarded', 'duplicate-award']);
    assert.equal(simultaneousAwards.find(result => result.status === 'awarded').earned, 10);
    const funded = await profileCommand(second);
    assert.equal(funded.coins, 10);
    const unaffordable = await profileCommand(first, { type: 'buy', id: 'finesse-hook', revision: funded.revision });
    assert.equal(unaffordable.status, 'unaffordable');
    assert.deepEqual(unaffordable.profile, funded);

    const simultaneousPurchases = await Promise.all([
      profileCommand(first, buy(funded.revision)), profileCommand(second, buy(funded.revision)),
    ]);
    assert.deepEqual(simultaneousPurchases.map(result => result.status).sort(), ['bought', 'stale']);
    const purchased = await profileCommand(first);
    assert.equal(purchased.coins, 0);
    assert.ok(purchased.owned.includes(lineId));
    assert.equal(purchased.equipped.line, 'starter-line');
    const repeated = await profileCommand(first, buy(purchased.revision));
    assert.equal(repeated.status, 'already-owned');
    assert.deepEqual(repeated.profile, purchased);
    const staleEquip = await profileCommand(second, equip(lineId, funded.revision));
    assert.equal(staleEquip.status, 'stale');
    assert.deepEqual(staleEquip.profile, purchased);

    const equipped = await profileCommand(first, equip(lineId, purchased.revision));
    assert.equal(equipped.status, 'equipped');
    assert.equal(equipped.profile.equipped.line, lineId);
    await first.reload({ waitUntil: 'domcontentloaded' });
    assert.deepEqual(await profileCommand(first), equipped.profile);
    const replay = await profileCommand(first, catchAward);
    assert.equal(replay.status, 'duplicate-award');
    assert.deepEqual(replay.profile, equipped.profile);
    const nextCatch = await profileCommand(second, landing('outing-two:0', 15));
    assert.equal(nextCatch.profile.coins, 15);
    assert.ok(nextCatch.profile.owned.includes(lineId));
    assert.equal(nextCatch.profile.equipped.line, lineId);
    const switched = await profileCommand(first, equip('starter-line', nextCatch.profile.revision));
    assert.equal(switched.status, 'equipped');
    assert.equal(switched.profile.equipped.line, 'starter-line');
    assert.equal(switched.profile.coins, 15);
    console.log('PASS: campaign save, atomic purchases and once-only awards across tabs');
  } finally {
    await context.close();
  }
});
