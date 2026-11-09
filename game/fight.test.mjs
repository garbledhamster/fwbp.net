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
  rules.advanceLineFight(run, 2800);
  const surge = rules.publicRun(run).fight;
  assert.ok(surge.x > initial.x);
  assert.ok(surge.y > initial.y);
  assert.ok(surge.tension > initial.tension);
  assert.equal(surge.paidOut, initial.paidOut);
  assert.equal(surge.tight, true);
  assert.equal(run.score, 0);

  const frameByFrame = hookedMuskie();
  for (let now = 2016; now <= 2800; now += 16) rules.advanceLineFight(frameByFrame, now);
  assert.deepEqual(rules.publicRun(frameByFrame).fight, surge);
});

test('loosening during a surge pays out line so the fish can be reeled and lifted', () => {
  const run = hookedMuskie();
  rules.advanceLineFight(run, 2800);
  const surge = rules.publicRun(run).fight;
  const loose = rules.apply(run, { action: 'loosen' }, 2800).fight;
  assert.ok(loose.paidOut > surge.paidOut);
  assert.ok(loose.tension < surge.tension);
  assert.equal(loose.tight, false);

  const reeled = rules.apply(run, { action: 'reel' }, 3100).fight;
  assert.ok(reeled.paidOut < loose.paidOut);
  assert.ok(reeled.distance < loose.distance);
  assert.equal(reeled.pullUp, false);
  let now = 3400;
  while (!run.fight?.pullUp && now < 6400) {
    rules.apply(run, { action: run.fight.tight ? 'loosen' : 'reel' }, now);
    now += 300;
  }
  assert.equal(run.fight.pullUp, true);
  assert.equal(run.score, 0);
  const landed = rules.apply(run, { action: 'lift' }, now);
  assert.equal(landed.stage, 'landed');
  assert.equal(landed.score, 75);
});

test('the same reel at peak surge breaks 8 lb line and holds on 12 lb line', () => {
  const starter = hookedMuskie(8);
  const stronger = hookedMuskie(12);
  rules.advanceLineFight(stronger, 2800);
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
  rules.advanceLineFight(run, 2800);
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

function hookedFish(species, size, area) {
  const rolls = [species, .2, .5, size, .1];
  let draw = 0;
  const run = rules.start(1000, () => rolls[draw++ % rolls.length], 'mille-lacs', { campaign: { area } });
  const lure = rules.publicRun(run).fish.id === 'muskie' ? 'spoon' : 'jig';
  rules.apply(run, { action: 'jig', lure }, 1300);
  rules.apply(run, { action: 'reel' }, 2000);
  return run;
}

test('every Campaign fish needs to reach the hole before Pull up can award a catch', () => {
  const shallow = hookedFish(.05, .4);
  const deep = hookedFish(.05, .4, 'deep-reef');
  const reelsNeeded = run => {
    assert.equal(run.stage, 'fight');
    assert.equal(run.score, 0);
    assert.throws(() => rules.apply(run, { action: 'lift' }, 2300), /ice hole/i);
    let now = 2300;
    let reels = 0;
    while (!run.fight.pullUp && reels < 10) {
      rules.apply(run, { action: 'reel' }, now);
      reels++;
      now += 300;
    }
    assert.equal(run.fight.remaining, 0);
    assert.equal(run.score, 0);
    assert.equal(rules.apply(run, { action: 'lift' }, now).stage, 'landed');
    assert.equal(run.score, 10);
    return reels;
  };
  assert.ok(reelsNeeded(deep) > reelsNeeded(shallow), 'the same perch takes more reeling when it starts deeper');
});

test('fish species and individual size change the load at the same depth', () => {
  const perch = hookedFish(.05, .4);
  const small = hookedFish(.98, .1);
  const large = hookedFish(.98, .9);
  for (const run of [perch, small, large]) rules.advanceLineFight(run, 2800);
  assert.ok(perch.fight.tension < small.fight.tension);
  assert.ok(small.fight.tension < large.fight.tension);
});

test('the same Campaign reel raises a heavier fish less at the same starting depth', () => {
  const perch = hookedFish(.05, .4);
  const small = hookedFish(.98, .1);
  const large = hookedFish(.98, .9);
  assert.equal(perch.fight.remaining, small.fight.remaining);
  assert.equal(small.fight.remaining, large.fight.remaining);
  // At this point in the surge cycle all three fights have the same clear line.
  for (const run of [perch, small, large]) rules.advanceLineFight(run, 4200);
  assert.equal(perch.fight.tension, small.fight.tension);
  assert.equal(small.fight.tension, large.fight.tension);
  const reel = run => rules.apply(run, { action: 'reel' }, 4200, { reelEffort: 1 }).fight;
  const light = reel(perch);
  const medium = reel(small);
  const heavy = reel(large);
  assert.ok(medium.remaining > light.remaining + .2, 'a perch comes up noticeably farther than a muskie');
  assert.ok(heavy.remaining > medium.remaining, 'a bigger muskie comes up less at the same effort');
  assert.ok(heavy.distance > light.distance, 'the line ends deeper on the heavier fish');
  assert.ok(heavy.tension > light.tension, 'taking in the same line against more pull increases load');
});

test('an equally sized Campaign fish reels slower under more load even before the line is tight', () => {
  const clear = hookedMuskie();
  const loaded = hookedMuskie();
  rules.apply(clear, { action: 'loosen' }, 4380);
  for (const run of [clear, loaded]) rules.advanceLineFight(run, 4760);
  assert.equal(clear.fight.distance, loaded.fight.distance);
  assert.equal(loaded.fight.tight, false);
  assert.ok(loaded.fight.tension > clear.fight.tension);
  const reel = run => rules.apply(run, { action: 'reel' }, 4760, { reelEffort: 1 }).fight;
  assert.ok(reel(loaded).distance > reel(clear).distance + .15, 'more tension means visibly less progress');
});

test('Campaign reel effort raises the same fish faster up to a cap without skipping the next move', () => {
  const reel = reelEffort => rules.apply(hookedFish(.05, .4), { action: 'reel' }, 2300, { reelEffort }).fight;
  const normal = reel(1);
  const quick = reel(1.35);
  const extreme = reel(1000);
  assert.ok(quick.remaining < normal.remaining - .3, 'a quicker reel makes more progress');
  assert.deepEqual(extreme, reel(1.5), 'huge effort cannot wind more than the strongest deliberate gesture');
  assert.equal(extreme.pullUp, false, 'one input still leaves line to reel');
  assert.deepEqual(reel(Infinity), normal, 'non-finite effort falls back to a regular reel');

  const run = hookedFish(.05, .4);
  rules.apply(run, { action: 'reel' }, 2300, { reelEffort: 1000 });
  assert.throws(() => rules.apply(run, { action: 'reel' }, 2301, { reelEffort: 1000 }), /give the line a moment/i);
  assert.throws(() => rules.apply(run, { action: 'lift' }, 2550), /ice hole/i);
  const atHole = rules.apply(run, { action: 'reel' }, 2550, { reelEffort: 1000 });
  assert.equal(atHole.fight.pullUp, true);
  assert.equal(atHole.score, 0, 'reeling to the hole does not land the fish');
  assert.throws(() => rules.apply(run, { action: 'lift' }, 2551), /give the line a moment/i);
  assert.equal(rules.apply(run, { action: 'lift' }, 2800).stage, 'landed');
});

test('Campaign payout responds to effort while the fish can take up the new slack', () => {
  const loosen = reelEffort => {
    const run = hookedFish(.98, .4);
    const fight = rules.apply(run, { action: 'loosen' }, 2320, { reelEffort }).fight;
    return { run, fight };
  };
  const gentle = loosen(.75).fight;
  const hard = loosen(1.5);
  assert.ok(hard.fight.paidOut > gentle.paidOut + 1, 'a harder stroke lets out more line');
  assert.ok(hard.fight.tension < gentle.tension, 'extra payout relieves more load');
  assert.deepEqual(loosen(100).fight, hard.fight, 'payout is capped per stroke');
  assert.deepEqual(loosen(Infinity).fight, loosen(1).fight);
  rules.advanceLineFight(hard.run, 2800);
  assert.ok(hard.run.fight.tension > hard.fight.tension, 'the fish pulls back as its surge uses the slack');
});

test('Practice line fight ignores Campaign stroke effort', () => {
  const reel = reelEffort => {
    const run = rules.start(1000, () => 0, undefined, { practice: true });
    rules.apply(run, { action: 'jig', lure: 'jig' }, 1300);
    rules.apply(run, { action: 'reel' }, 2000);
    return rules.apply(run, { action: 'reel' }, 2300, { reelEffort }).fight;
  };
  assert.deepEqual(reel(1000), reel(1));
  const loosen = reelEffort => {
    const run = rules.start(1000, () => 0, undefined, { practice: true });
    rules.apply(run, { action: 'jig', lure: 'jig' }, 1300);
    rules.apply(run, { action: 'reel' }, 2000);
    return rules.apply(run, { action: 'loosen' }, 2300, { reelEffort }).fight;
  };
  assert.deepEqual(loosen(1000), loosen(1));
});

test('a fresh Campaign encounter accepts Jig after the previous fish was lifted', () => {
  const run = hookedFish(.05, .4);
  for (const now of [2300, 2600, 2900]) rules.apply(run, { action: 'reel' }, now);
  rules.apply(run, { action: 'lift' }, 3200);
  rules.apply(run, { action: 'next' }, 3201);
  assert.equal(rules.apply(run, { action: 'jig', lure: 'jig' }, 3202).stage, 'bite');
});

test('Practice hooks a perch with starter gear and awards XP only after it reaches the hole', () => {
  const run = rules.start(1000, () => 0, 'mille-lacs', { practice: true });
  rules.apply(run, { action: 'jig', lure: 'jig' }, 1300);
  const hooked = rules.apply(run, { action: 'reel' }, 2000);
  assert.equal(hooked.stage, 'fight');
  assert.equal(hooked.fight.lineStrength, 8);
  assert.equal(hooked.score, 0);
  assert.equal(hooked.practice.xp, 0);
  assert.throws(() => rules.apply(run, { action: 'lift' }, 2300), /ice hole/i);
  for (const time of [2300, 2600, 2900]) rules.apply(run, { action: 'reel' }, time);
  assert.equal(rules.publicRun(run).fight.pullUp, true);
  assert.equal(rules.publicRun(run).practice.xp, 0);
  const landed = rules.apply(run, { action: 'lift' }, 3200);
  assert.equal(landed.stage, 'landed');
  assert.equal(landed.score, 10);
  assert.equal(landed.practice.xp, 10);
});

test('wrong lures move local fish away and spook a muskie sooner than a perch', () => {
  for (const options of [{ campaign: {} }, { practice: true }]) {
    for (const [roll, limit] of [[.05, 3], [.98, 2]]) {
      let draw = 0;
      const rolls = [roll, .2, .5, .4, .1];
      const run = rules.start(1000, () => rolls[draw++ % rolls.length], undefined, options);
      for (let attempt = 1; attempt <= limit; attempt++) {
        const state = rules.apply(run, { action: 'jig', lure: 'minnow' }, 1000 + attempt * 300);
        assert.equal(state.wrongLures, attempt);
        assert.equal(state.stage, attempt < limit ? 'seek' : 'missed');
        assert.equal(state.reaction, attempt < limit ? 'wrong-lure' : 'spooked');
        assert.equal(state.score, 0);
      }
      assert.equal(rules.apply(run, { action: 'next' }, 3000).wrongLures, 0);
    }
  }
});

test('local outings present fish across the lake width even when position rolls repeat', () => {
  const options = [{ practice: true }, { campaign: {} }, { campaign: { area: 'deep-reef' } }];
  for (const mode of options) {
    const openingLanes = [];
    for (const roll of [.05, .5, .95]) {
      const run = rules.start(1000, () => roll, undefined, mode);
      const lanes = [];
      const depths = [];
      let state = rules.publicRun(run);
      while (state.fish) {
        const { x, depth } = state.fish;
        lanes.push(x < 38 ? 'left' : x < 62 ? 'middle' : 'right');
        depths.push(depth);
        const now = state.seekUntil;
        state = rules.apply(run, { action: 'expire' }, now);
        if (state.stage === 'missed') state = rules.apply(run, { action: 'next' }, now);
      }
      openingLanes.push(lanes[0]);
      assert.deepEqual(depths.sort(), [0, 1, 2, 3, 4, 5]);
      assert.deepEqual(lanes.sort(), ['left', 'left', 'middle', 'middle', 'right', 'right']);
    }
    assert.deepEqual(openingLanes, ['left', 'middle', 'right']);
  }
});
