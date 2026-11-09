import test from 'node:test';
import assert from 'node:assert/strict';
import * as rules from './rules.mjs';

const outing = (elapsedMs, random = () => .35) =>
  rules.start(1000, random, 'mille-lacs', { campaign: { elapsedMs } });

test('the campaign clock cycles through daylight, dusk, night, and daylight again', () => {
  const cases = [
    [0, 'day'], [29999, 'day'], [30000, 'dusk'], [59999, 'dusk'],
    [60000, 'night'], [104999, 'night'], [105000, 'day'], [135000, 'dusk'],
  ];
  assert.deepEqual(cases.map(([elapsed]) => rules.campaignPhase?.(elapsed)), cases.map(([, phase]) => phase));
});

test('the same encounter roll finds different fish after dusk', () => {
  assert.equal(rules.publicRun(outing(0)).fish.id, 'rock-bass');
  assert.equal(rules.publicRun(outing(30000)).fish.id, 'walleye');
  assert.equal(rules.publicRun(outing(60000)).fish.id, 'walleye');
  assert.equal(rules.publicRun(outing(30000, () => .98)).fish.id, 'muskie');
});

test('a phase change preserves the active fish and deadline until the next encounter', () => {
  const run = outing(29000);
  const deadline = rules.publicRun(run).seekUntil;
  const stillSearching = rules.apply(run, { action: 'jig', lure: 'minnow' }, 2500, { campaignElapsedMs: 30500 });
  assert.equal(stillSearching.stage, 'seek');
  assert.equal(stillSearching.fish.id, 'rock-bass');
  assert.equal(stillSearching.seekUntil, deadline);
  rules.apply(run, { action: 'jig', lure: 'jig' }, 2800, { campaignElapsedMs: 30800 });
  assert.equal(rules.apply(run, { action: 'reel' }, 3500, { campaignElapsedMs: 31500 }).stage, 'fight');
  for (const now of [3800, 4100, 4400]) rules.apply(run, { action: 'reel' }, now);
  assert.equal(rules.apply(run, { action: 'lift' }, 4700).stage, 'landed');

  const next = rules.apply(run, { action: 'next' }, 5000, { campaignElapsedMs: 33000 });
  assert.equal(next.fish.id, 'walleye');
  assert.equal(next.seekUntil, 30000);
  assert.equal(next.count, 6);
});
