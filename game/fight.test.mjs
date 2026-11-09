import test from 'node:test';
import assert from 'node:assert/strict';
import * as rules from './rules.mjs';

function hookedMuskie(lineStrength = 8) {
  const rolls = [.98, .2, .5, .4, .1];
  let draw = 0;
  const run = rules.start(1000, () => rolls[draw++ % rolls.length], 'mille-lacs', { campaign: { lineStrength } });
  assert.equal(rules.publicRun(run).fish.id, 'muskie');
  rules.apply(run, { action: 'jig', lure: 'spoon' }, 1300);
  rules.apply(run, { action: 'reel' }, 2000);
  return run;
}

test('a hooked fish moves and loads the line before any further input', () => {
  const run = hookedMuskie();
  const initial = rules.publicRun(run).fight;
  assert.equal(initial.lineStrength, 8);
  assert.equal(initial.tight, false);
  rules.advanceCampaignFight(run, 2800);
  const surge = rules.publicRun(run).fight;
  assert.ok(surge.x > initial.x);
  assert.ok(surge.y > initial.y);
  assert.ok(surge.tension > initial.tension);
  assert.equal(surge.paidOut, initial.paidOut);
  assert.equal(surge.tight, true);
  assert.equal(run.score, 0);

  const frameByFrame = hookedMuskie();
  for (let now = 2016; now <= 2800; now += 16) rules.advanceCampaignFight(frameByFrame, now);
  assert.deepEqual(rules.publicRun(frameByFrame).fight, surge);
});

test('loosening during a surge pays out line so the fish can be reeled and lifted', () => {
  const run = hookedMuskie();
  rules.advanceCampaignFight(run, 2800);
  const surge = rules.publicRun(run).fight;
  const loose = rules.apply(run, { action: 'loosen' }, 2800).fight;
  assert.ok(loose.paidOut > surge.paidOut);
  assert.ok(loose.tension < surge.tension);
  assert.equal(loose.tight, false);

  const reeled = rules.apply(run, { action: 'reel' }, 3100).fight;
  assert.ok(reeled.paidOut < loose.paidOut);
  assert.ok(reeled.distance < loose.distance);
  assert.equal(reeled.pullUp, false);
  rules.apply(run, { action: 'reel' }, 3400);
  const ready = rules.apply(run, { action: 'reel' }, 3700);
  assert.equal(ready.fight.pullUp, true);
  assert.equal(ready.score, 0);
  const landed = rules.apply(run, { action: 'lift' }, 4000);
  assert.equal(landed.stage, 'landed');
  assert.equal(landed.score, 75);
});

test('the same reel at peak surge breaks 8 lb line and holds on 12 lb line', () => {
  const starter = hookedMuskie(8);
  const stronger = hookedMuskie(12);
  rules.advanceCampaignFight(stronger, 2800);
  const beforeReel = rules.publicRun(stronger).fight.tension;
  const snapped = rules.apply(starter, { action: 'reel' }, 2800);
  const held = rules.apply(stronger, { action: 'reel' }, 2800);
  assert.equal(snapped.stage, 'missed');
  assert.equal(snapped.snap.lineStrength, 8);
  assert.equal(snapped.catch, null);
  assert.equal(snapped.score, 0);
  assert.equal(held.stage, 'fight');
  assert.equal(held.fight.lineStrength, 12);
  assert.ok(held.fight.tension > beforeReel);
  assert.equal(snapped.snap.tension, held.fight.tension);
  assert.ok(held.fight.tension > 8 && held.fight.tension < 12);
  assert.equal(rules.apply(starter, { action: 'next' }, 3100).stage, 'seek');
});

test('a line left shortened can snap when a fish surges again without input', () => {
  const run = hookedMuskie();
  rules.apply(run, { action: 'reel' }, 2400);
  rules.advanceCampaignFight(run, 2800);
  const state = rules.publicRun(run);
  assert.equal(state.stage, 'missed');
  assert.ok(state.snap.tension >= 8);
  assert.equal(state.score, 0);
});

test('loosening cannot take line back when the fish has already stopped pulling', () => {
  const run = hookedMuskie();
  rules.apply(run, { action: 'loosen' }, 2800);
  const loose = rules.apply(run, { action: 'loosen' }, 3100).fight;
  const rested = rules.apply(run, { action: 'loosen' }, 3800).fight;
  assert.ok(rested.paidOut >= loose.paidOut);
});

test('a load equal to the line rating holds', () => {
  const run = hookedMuskie(9.7);
  const state = rules.apply(run, { action: 'reel' }, 2800);
  assert.equal(state.stage, 'fight');
  assert.equal(state.fight.tension, 9.7);
});
