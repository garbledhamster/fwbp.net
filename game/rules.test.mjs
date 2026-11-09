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

function landPracticePerch(run, hookAt) {
  let state = apply(run, { action: 'reel' }, hookAt);
  let now = hookAt;
  for (let pull = 0; pull < 6 && state.stage === 'fight' && !state.fight.pullUp; pull++) {
    state = apply(run, { action: 'reel' }, now += 300);
  }
  assert.equal(state.fight?.pullUp, true, 'the perch reached the ice hole');
  return { state: apply(run, { action: 'lift' }, now + 300), at: now + 300 };
}

test('Practice earns one Level 2 choice from landed catches', () => {
  const run = start(1000, () => 0, 'mille-lacs', { practice: true });
  const move = (action, now, details = {}) => apply(run, { action, ...details }, now);
  move('jig', 1100, { lure: 'spoon' });
  assert.deepEqual(publicRun(run).practice, { xp: 0, level: 1 });
  move('jig', 1400, { lure: 'jig' });
  move('reel', 1500);
  assert.equal(publicRun(run).practice.xp, 0);
  move('jig', 1700, { lure: 'jig' });
  const { state: first, at: firstAt } = landPracticePerch(run, 2300);
  assert.deepEqual(first.practice, { xp: 10, level: 1 });
  assert.equal(first.skillPoints, 0);
  assert.throws(() => move('reel', firstAt + 1), /unavailable/);
  assert.equal(publicRun(run).practice.xp, 10);
  move('next', firstAt + 100);
  move('jig', firstAt + 200, { lure: 'jig' });
  const { state: second, at: secondAt } = landPracticePerch(run, firstAt + 800);
  assert.deepEqual(second.practice, { xp: 20, level: 2 });
  assert.equal(second.skillPoints, 1);
  assert.throws(() => move('upgrade', secondAt + 100, { skill: 'quick' }), /unavailable/);
  move('upgrade', secondAt + 200, { skill: 'control' });
  assert.throws(() => move('upgrade', secondAt + 300, { skill: 'lift' }), /unavailable/);
  assert.deepEqual(publicRun(run).window, { from: 550, until: 2450 });
});

test('skipping Level 2 leaves later Practice catches without a choice', () => {
  const run = start(1000, () => 0, 'mille-lacs', { practice: true });
  for (let i = 0; i < 2; i++) {
    const now = 1100 + i * 4000;
    apply(run, { action: 'jig', lure: 'jig' }, now);
    const { at } = landPracticePerch(run, now + 600);
    apply(run, { action: 'next' }, at + 50);
  }
  assert.equal(publicRun(run).skillPoints, 0);
  apply(run, { action: 'jig', lure: 'jig' }, 9100);
  const { state: third, at } = landPracticePerch(run, 9700);
  assert.deepEqual(third.practice, { xp: 30, level: 2 });
  assert.deepEqual(third.skills, { quick: 0, control: 0, lift: 0 });
  assert.throws(() => apply(run, { action: 'upgrade', skill: 'lift' }, at + 100), /unavailable/);
});

test('fish get a seek window based on rarity', () => {
  for (const [roll, deadline] of [[0, 31000], [.55, 26000], [.99, 21000]]) {
    assert.equal(publicRun(start(1000, () => roll)).seekUntil, deadline);
  }
});

test('the last millisecond can start a bite and keep its normal reel window', () => {
  const run = start(1000, () => 0);
  const bite = apply(run, { action: 'jig', lure: 'jig' }, 30999);
  assert.equal(bite.stage, 'bite');
  assert.equal(bite.seekUntil, null);
  const caught = apply(run, { action: 'reel' }, 31549);
  assert.equal(caught.stage, 'landed');
  assert.equal(caught.score, 10);
});

test('a late Jig loses the fish even when no timer callback has run', () => {
  const run = start(1000, () => 0);
  apply(run, { action: 'jig', lure: 'spoon' }, 30000);
  const missed = apply(run, { action: 'jig', lure: 'jig' }, 31000);
  assert.equal(missed.stage, 'missed');
  assert.equal(missed.fish, null);
  assert.equal(missed.seekUntil, null);
  assert.equal(missed.score, 0);
  assert.throws(() => apply(run, { action: 'jig', lure: 'jig' }, 31400), /unavailable/);
});

test('a failed reel restores the same seek deadline', () => {
  const run = start(1000, () => 0);
  apply(run, { action: 'jig', lure: 'jig' }, 30000);
  const retry = apply(run, { action: 'reel' }, 30100);
  assert.equal(retry.stage, 'seek');
  assert.equal(retry.seekUntil, 31000);
  assert.throws(() => apply(run, { action: 'expire' }, 30999), /unavailable/);
  assert.equal(apply(run, { action: 'expire' }, 31000).stage, 'missed');
});

test('a failed reel after the seek deadline ends the encounter', () => {
  const run = start(1000, () => 0);
  apply(run, { action: 'jig', lure: 'jig' }, 30999);
  assert.equal(apply(run, { action: 'reel' }, 33100).stage, 'missed');
});

test('a fight continues past the deadline until a broken line releases the fish', () => {
  const run = start(1000, () => .99);
  apply(run, { action: 'jig', lure: 'spoon' }, 20999);
  const fight = apply(run, { action: 'reel' }, 21549);
  assert.equal(fight.stage, 'fight');
  assert.equal(fight.fight.pulls, 3);
  const missed = apply(run, { action: 'lift' }, 21900);
  assert.equal(missed.stage, 'missed');
  assert.equal(missed.fight, null);
  assert.equal(missed.catch, null);
  assert.equal(missed.score, 0);
});

test('misses award no XP and the sixth miss ends the outing', () => {
  const run = start(1000, () => 0, 'mille-lacs', { practice: true });
  let opened = 1000;
  for (let encounter = 0; encounter < 6; encounter++) {
    const missed = apply(run, { action: 'expire' }, opened + 30000);
    assert.equal(missed.stage, encounter === 5 ? 'done' : 'missed');
    assert.equal(missed.fish, null);
    assert.equal(missed.score, 0);
    assert.deepEqual(missed.practice, { xp: 0, level: 1 });
    if (encounter < 5) {
      opened += 32000;
      const next = apply(run, { action: 'next' }, opened);
      assert.equal(next.index, encounter + 1);
      assert.equal(next.seekUntil, opened + 30000);
    }
  }
});

test('two landed fish still unlock Level 2 after a miss', () => {
  const run = start(1000, () => 0, 'mille-lacs', { practice: true });
  apply(run, { action: 'expire' }, 31000);
  let caught;
  for (const now of [32000, 36000]) {
    apply(run, { action: 'next' }, now);
    apply(run, { action: 'jig', lure: 'jig' }, now + 50);
    caught = landPracticePerch(run, now + 600).state;
  }
  assert.deepEqual(caught.practice, { xp: 20, level: 2 });
  assert.equal(caught.skillPoints, 1);
  assert.equal(caught.score, 20);
});

test('an existing ranked encounter without a deadline can finish and start a timed fish', () => {
  const run = start(1000, () => 0);
  delete run.seekUntil;
  assert.equal(publicRun(run).seekUntil, null);
  apply(run, { action: 'jig', lure: 'jig' }, 45000);
  assert.equal(apply(run, { action: 'reel' }, 45600).score, 10);
  assert.equal(apply(run, { action: 'next' }, 46000).seekUntil, 76000);
});
