import test from 'node:test';
import assert from 'node:assert/strict';
import { start, apply, publicRun } from './rules.mjs';

test('a run earns only server-defined points, with discovery and timing', () => {
  const run = start(1000, () => 0);
  assert.equal(publicRun(run).fish.id, 'perch');
  apply(run, { action: 'jig', lure: 'spoon' }, 1100);
  assert.equal(run.stage, 'seek');
  apply(run, { action: 'jig', lure: 'jig' }, 1500);
  assert.equal(run.stage, 'bite');
  assert.throws(() => apply(run, { action: 'reel', score: 999999 }, 2200));
  assert.equal(run.score, 0);
  apply(run, { action: 'reel' }, 1800);
  assert.equal(run.score, 0);
  apply(run, { action: 'jig', lure: 'jig' }, 2100);
  apply(run, { action: 'reel' }, 2800);
  assert.equal(run.score, 10);
  assert.deepEqual(publicRun(run).discoveries, [{ fish: 'Yellow perch', lure: 'jig' }]);
});

test('expired runs, skipping directly to reel, and malformed lures fail', () => {
  const run = start(1000, () => 0);
  assert.throws(() => apply(run, { action: 'reel' }, 1200));
  assert.throws(() => apply(run, { action: 'jig', lure: 'dynamite' }, 1200));
  assert.throws(() => apply(run, { action: 'jig', lure: 'jig' }, 9999999));
});

test('lake profiles, catch grades, and skill upgrades stay in the run', async () => {
  const { lakes, reelWindow } = await import('./rules.mjs');
  const run = start(1000, () => 0);
  assert.equal(run.lake, 'mille-lacs');
  assert.ok(lakes[run.lake].fish.length >= 5);
  assert.throws(() => apply(run, { action: 'upgrade', skill: 'quick' }, 1300));
  apply(run, { action: 'jig', lure: 'jig' }, 1300);
  apply(run, { action: 'reel' }, 2000);
  assert.equal(run.catch.length, 5);
  apply(run, { action: 'upgrade', skill: 'quick' }, 2300);
  assert.equal(publicRun(run).skills.quick, 1);
  assert.equal(publicRun(run).skillPoints, 0);
  assert.ok(reelWindow(run.skills).from < 550);
});

test('record and gilded bonuses are awarded once, after lifting', () => {
  const rolls = [.999, .5, .5, .999, .999];
  let roll = 0;
  const run = start(1000, () => rolls[roll++ % rolls.length]);
  assert.equal(publicRun(run).fish.id, 'muskie');
  assert.equal(publicRun(run).fish.gilded, true);
  apply(run, { action: 'jig', lure: 'spoon' }, 1300);
  apply(run, { action: 'reel' }, 2000);
  assert.equal(run.score, 0);
  assert.equal(run.catch.length, 58.25);
  assert.equal(run.catch.grade, 'Record');
  assert.equal(run.fight.pulls, 3);
  for (let i = 0; i < 3; i++) {
    const time = 2300 + i * 600;
    assert.ok(run.fight.tension >= 60);
    apply(run, { action: 'loosen' }, time);
    apply(run, { action: 'lift' }, time + 300);
  }
  assert.equal(run.score, 165);
  assert.throws(() => apply(run, { action: 'lift' }, 4300));
  assert.equal(run.score, 165);
});

test('six completed encounters close the outing', () => {
  const run = start(1000, () => 0);
  for (let i = 0; i < 6; i++) {
    const base = 1500 + i * 2000;
    apply(run, { action: 'jig', lure: 'jig' }, base);
    apply(run, { action: 'reel' }, base + 700);
    apply(run, { action: 'next' }, base + 1000);
  }
  assert.equal(run.stage, 'done');
  assert.equal(run.score, 60);
  assert.equal(publicRun(run).fish, null);
  assert.throws(() => apply(run, { action: 'jig', lure: 'jig' }, 17000));
});

test('pulling against a surge breaks the line without awarding a catch', () => {
  const run = start(1000, () => .999);
  apply(run, { action: 'jig', lure: 'spoon' }, 1300);
  apply(run, { action: 'reel' }, 2000);
  apply(run, { action: 'lift' }, 2300);
  assert.equal(run.stage, 'seek');
  assert.equal(run.catch, null);
  assert.equal(run.fight, null);
  assert.equal(run.score, 0);
});
