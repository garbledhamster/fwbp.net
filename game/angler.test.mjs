import assert from 'node:assert/strict';
import test from 'node:test';
import * as rules from './rules.mjs';
import * as profile from './profile.mjs';

const starter = { line: 0, rhythm: 0, hook: 0 };

function outing({ sizeRoll = .4, ranks = starter, depthPx = 400, lineStrength = 12 } = {}) {
  const seeds = [.05, .2, .5, sizeRoll, .1];
  let draw = 0;
  let roll = .99;
  const hook = { id: 'finesse-hook', name: 'Fine-wire jig setup', lure: 'minnow', windowMs: 200 };
  const line = { id: 'stronger-line', name: 'Stronger line', strength: lineStrength };
  const run = rules.start(1000, () => seeds[draw++] ?? roll, undefined, {
    campaign: { anglerRanks: ranks, hook, line, lineStrength: line.strength },
  });
  const move = (action, now, input) => rules.apply(run, { action, ...input }, now, { depthPx });
  move('jig', 1300, { lure: 'jig' });
  return { run, move, depthPx, hook, line, roll: value => { roll = value; } };
}

test('a slightly early Campaign tap buffers until the cue opens', () => {
  const { run, move, depthPx } = outing();
  assert.deepEqual(rules.publicRun(run).window, { from: 520, until: 2920, buffer: 220 });
  move('reel', 1599);
  assert.equal(rules.advanceCampaignBite(run, 1819, { depthPx }), false);
  assert.equal(rules.advanceCampaignBite(run, 1820, { depthPx }), false);
  assert.equal(run.stage, 'bite', 'a tap before the buffer should not set the hook');
  assert.equal(rules.advanceCampaignBite(run, 4221, { depthPx }), true);
  assert.equal(run.stage, 'seek');
  assert.equal(run.reaction, 'slipped-hook');

  const buffered = outing({ ranks: { ...starter, hook: 2 } });
  assert.equal(rules.publicRun(buffered.run).window.until, 3280);
  buffered.move('reel', 1600);
  assert.equal(rules.advanceCampaignBite(buffered.run, 1819, { depthPx }), false);
  assert.equal(rules.advanceCampaignBite(buffered.run, 1820, { depthPx }), true);
  assert.equal(buffered.run.stage, 'fight');
  assert.equal(buffered.run.fight.startDepth, depthPx);
});

test('the starter perch has 40/10/50 per-tap odds and rank changes take effect in a new encounter', () => {
  assert.deepEqual(rules.campaignReelOdds(8, 0), { hold: 40, slip: 10 });
  assert.deepEqual(rules.campaignReelOdds(18, 0), { hold: 43, slip: 12 });
  assert.deepEqual(rules.campaignReelOdds(18, 2), { hold: 33, slip: 10 });

  const { run, move, roll } = outing();
  move('reel', 1850);
  for (const [index, [draw, feedback]] of [[.399, 'hold'], [.4, 'slip'], [.499, 'slip'], [.5, 'reel']].entries()) {
    roll(draw);
    const at = 1900 + 40 * index;
    assert.equal(move('reel', at).fight.feedback, feedback);
    assert.ok(run.fight.meterLevel >= 0 && run.fight.meterLevel <= 1);
  }
  run.campaign.anglerRanks = { ...starter, line: 5 };
  roll(.3);
  assert.equal(move('reel', 2080).fight.feedback, 'hold', 'the current encounter retains its initial odds');
  assert.throws(() => move('loosen', 2200), /unavailable/);
  assert.throws(() => move('lift', 2200), /unavailable/);
});

function reelToIce({ run, move, depthPx }) {
  let now = 1850;
  move('reel', now);
  const initial = run.fight.remaining;
  rules.advanceLineFight(run, now += 40);
  assert.ok(run.fight.remaining > initial, 'an idle hooked fish takes line immediately');
  const paused = run.fight.remaining;
  move('reel', now += 10);
  assert.ok(run.fight.remaining >= paused, 'the reel tap does not teleport the fish');
  rules.advanceLineFight(run, now += 120);
  assert.ok(run.fight.remaining < paused, 'reel progress is animated over time');
  assert.equal(run.fight.startDepth, depthPx);
  let taps = 1;
  for (; run.stage === 'fight' && taps < 600; taps++) move('reel', now += 160);
  assert.equal(run.stage, 'landed');
  return taps;
}

test('a deep trophy runs harder, takes longer and lands with one stable specimen and carried gear', () => {
  const standard = outing();
  const trophy = outing({ sizeRoll: .99, depthPx: 660 });
  const standardTaps = reelToIce(standard);
  const trophyTaps = reelToIce(trophy);
  assert.ok(trophyTaps > standardTaps * 2);
  assert.equal(standard.run.catch.offense, 8);
  assert.equal(standard.run.catch.grade, 'Standard');
  const fish = trophy.run.catch;
  assert.equal(fish.speciesId, 'perch');
  assert.equal(fish.grade, 'Trophy');
  assert.ok(fish.length > standard.run.catch.length);
  assert.ok(fish.age > standard.run.catch.age);
  assert.ok(fish.offense > standard.run.catch.offense);
  assert.ok(fish.quality > standard.run.catch.quality);
  assert.equal(fish.quality, fish.length / 8 + .18 * (fish.typeRating - 1) + .075 * (fish.age - 3) + .016 * (fish.offense - 8));
  assert.deepEqual(fish.hook, { id: trophy.hook.id, name: trophy.hook.name });
  assert.deepEqual(fish.line, { id: trophy.line.id, name: trophy.line.name });
  assert.equal(trophy.run.score, fish.points);
  assert.equal(rules.advanceLineFight(trophy.run, 200000), false);
  assert.equal(trophy.run.score, fish.points);
});

test('saved legacy ranks preserve point value and old records without repeating migration', () => {
  const legacy = {
    awards: { 'past:0': 200, 'past:1': 70 },
    coins: 16,
    owned: ['starter-line', 'line-control'],
    goalCatches: ['past:0'],
    skillRanks: { control: 8, lure: 2, drilling: 3 },
  };
  assert.deepEqual(profile.anglerSkillLimits, { line: 5, rhythm: 3, hook: 3 });
  assert.deepEqual(profile.anglerSkillRanks(legacy), { line: 5, rhythm: 0, hook: 2 });
  assert.deepEqual(profile.anglerProgress(legacy), { earned: 13, spent: 7, points: 6 });
  assert.deepEqual(profile.anglerProgress({ ...legacy, angler: { bonus: 12, ranks: { line: 5, rhythm: 0, hook: 3 } } }),
    { earned: 14, spent: 8, points: 6 });
  assert.equal(legacy.coins, 16);
  assert.deepEqual(legacy.goalCatches, ['past:0']);
});

test('steady taps land a deep trophy muskie on starter ranks with seeded reel outcomes', () => {
  const seeds = [.98, .2, .5, .99, .1];
  let draw = 0;
  let seed = 1234;
  const random = () => {
    if (draw < 30) return seeds[draw++ % seeds.length];
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  const run = rules.start(1000, random, undefined, { campaign: { anglerRanks: starter } });
  rules.apply(run, { action: 'jig', lure: 'spoon' }, 1300);
  rules.apply(run, { action: 'reel' }, 1850, { depthPx: 500 });
  const firstFish = run.catch;
  assert.equal(firstFish.speciesId, 'muskie');
  assert.equal(firstFish.grade, 'Trophy');
  for (let now = 2090; now < 91850 && run.stage === 'fight'; now += 240) {
    rules.apply(run, { action: 'reel' }, now);
  }
  assert.equal(run.stage, 'landed');
  assert.equal(run.catch, firstFish);
});

test('Reel rhythm keeps the same tap engaged for longer', () => {
  const distance = rhythm => {
    const { run, move, roll } = outing({ sizeRoll: .99, ranks: { ...starter, rhythm } });
    move('reel', 1850);
    roll(.2);
    move('reel', 1870);
    rules.advanceLineFight(run, 2300);
    return run.fight.remaining;
  };
  assert.ok(distance(3) < distance(0) - 5);
});

test('stronger carried line reduces the passive payout from the same hooked fish', () => {
  const payout = lineStrength => {
    const { run, move } = outing({ sizeRoll: .99, lineStrength });
    move('reel', 1850);
    rules.advanceLineFight(run, 2330);
    return run.fight.remaining - run.fight.startDepth;
  };
  assert.ok(payout(8) > payout(12) + 1);
  assert.ok(payout(12) > payout(18) + 1);
});
