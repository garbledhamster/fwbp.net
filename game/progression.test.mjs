import test from 'node:test';
import assert from 'node:assert/strict';
import * as profile from './profile.mjs';
import * as rules from './rules.mjs';

test('Campaign levels derive once from committed payouts, independently of coins and Practice', () => {
  assert.equal(profile.campaignProgress({ awards: {} }).level, 1);
  const saved = { coins: 1, awards: { 'old:0': 10, 'old:1': 15 }, collectionAwards: { 'practice:0': 'perch' } };
  const progress = profile.campaignProgress(saved);
  assert.equal(progress.xp, 25);
  assert.equal(progress.level, 2);
  assert.equal(progress.points, 1);
  assert.deepEqual(profile.campaignProgress(saved), progress);
  assert.equal(profile.campaignProgress({ awards: { 'old:0': 2000 } }).level, 10);
});
test('shop levels gate new purchases but retain legacy owned gear', () => {
  const item = profile.shopItems.find(item => item.id === 'stronger-line');
  const base = { coins: 999, owned: [], equipped: {}, awards: {} };
  assert.equal(profile.shopAvailability(base, item).status, 'locked');
  assert.equal(profile.shopAvailability({ ...base, awards: { 'old:0': 10 } }, item).status, 'available');
  assert.equal(profile.shopAvailability({ ...base, owned: [item.id] }, item).status, 'owned');
  assert.equal(profile.shopAvailability({ ...base, awards: { 'old:0': 2000 } }, profile.shopItems.find(item => item.id === 'pro-line')).status, 'available');
});
test('techniques bank points, respect prerequisites and retain paid control once', () => {
  const saved = { awards: { 'old:0': 100 }, owned: ['line-control'], techniques: ['line-control-1'] };
  assert.equal(profile.campaignTraining(saved).lineControlRank, 1);
  assert.equal(profile.campaignProgress(saved).points, profile.campaignProgress(saved).level - 2);
  assert.equal(profile.campaignTraining({ ...saved, techniques: [] }).lineControlRank, 1);
  assert.equal(profile.techniqueState({ ...saved, techniques: [] }, 'line-control-1').status, 'learned');
  assert.equal(profile.techniqueState({ ...saved, techniques: [] }, 'line-control-2').status, 'available');
  assert.equal(profile.techniqueState({ ...saved, owned: [], techniques: [] }, 'line-control-2').status, 'locked');
  assert.equal(profile.techniqueState({ ...saved, techniques: [] }, 'lure-work-1').status, 'available');
});
test('quality measures same-species size and keeps rarity, Record and Gilded separate', () => {
  assert.equal(rules.catchQuality('perch', 5), 'Bronze');
  assert.equal(rules.catchQuality('perch', 9), 'Silver');
  assert.equal(rules.catchQuality('perch', 11), 'Gold');
  assert.equal(rules.catchQuality('pike', 46.25), 'Gold');
  assert.equal(rules.catchQuality('muskie', 24), 'Bronze');
});

test('lure work changes hook timing and forgiveness while other modes stay unchanged', () => {
  const attempt = campaign => {
    const run = rules.start(1000, () => .05, undefined, { campaign });
    return { run, view: rules.apply(run, { action: 'jig', lure: 'jig' }, 1300) };
  };
  assert.equal(attempt({ lureWorkRank: 1 }).view.window.from, 425);
  assert.equal(attempt({ lineControlRank: 1 }).view.window.from, 550);
  const control = attempt({ lineControlRank: 1 });
  assert.equal(control.view.window.until, 2450);
  assert.equal(attempt(undefined).view.window.from, 550);
  const run = rules.start(1000, () => .05, undefined, { campaign: { lureWorkRank: 1 } });
  for (let i = 0; i < 3; i++) rules.apply(run, { action: 'jig', lure: 'spoon' }, 1300 + i * 300);
  assert.equal(run.stage, 'seek');
  rules.apply(run, { action: 'jig', lure: 'spoon' }, 2200);
  assert.equal(run.stage, 'missed');
});

test('carried bait is snapshotted and keeps the shared Ranked lure contract', () => {
  const bait = { lure: 'jig', windowMs: 150 };
  const run = rules.start(1000, () => .05, undefined, { campaign: { baits: [bait] } });
  bait.windowMs = 9999;
  assert.equal(rules.publicRun(run).window.until, 2250);
  const ranked = rules.start(1000, () => .05);
  assert.throws(() => rules.apply(ranked, { action: 'jig', lure: 'live-minnow' }, 1300));
  assert.equal(rules.publicRun(ranked).window.until, 2100);
});
