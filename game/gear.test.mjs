import test from 'node:test';
import assert from 'node:assert/strict';
import { apply, publicRun, start } from './rules.mjs';
import { campaignMilestone, shopItems } from './profile.mjs';

// Catch regressions that remove, over-apply or leak the tackle timing tradeoff.
function hook({ species = .05, lure = 'jig', line = 'starter-line', hook = 'starter-hook', training = 0, delay, campaign = true, practice = false }) {
  const rolls = [species, .2, .5, .4, .1];
  let draw = 0;
  const lineItem = shopItems.find(item => item.id === line);
  const hookItem = shopItems.find(item => item.id === hook);
  const run = start(1000, () => rolls[draw++ % rolls.length], undefined, {
    practice,
    ...(campaign && { campaign: {
      lineStrength: lineItem.strength,
      line: lineItem,
      hook: hookItem,
      lineControlRank: training,
    } }),
  });
  const bite = apply(run, { action: 'jig', lure }, 1300);
  assert.equal(bite.stage, 'bite');
  const outcome = apply(run, { action: 'reel' }, 1300 + delay);
  return { window: bite.window, stage: outcome.stage, run };
}

test('lighter line can hook a Jig bite that stronger line misses at the same late input', () => {
  assert.equal(hook({ delay: 2200 }).stage, 'fight');
  assert.equal(hook({ line: 'stronger-line', delay: 2200 }).stage, 'seek');
  assert.equal(hook({ delay: 2201 }).stage, 'seek');
  assert.equal(hook({ species: .55, lure: 'minnow', delay: 2200 }).stage, 'seek');
});

test('the Octopus setup extends Minnow timing while Fine-wire extends Jig timing', () => {
  assert.equal(hook({ species: .55, lure: 'minnow', hook: 'octopus-hook', delay: 2300 }).stage, 'fight');
  assert.equal(hook({ species: .55, lure: 'minnow', hook: 'octopus-hook', delay: 2301 }).stage, 'seek');
  assert.equal(hook({ species: .55, lure: 'minnow', hook: 'finesse-hook', delay: 2300 }).stage, 'seek');
  assert.equal(hook({ hook: 'octopus-hook', delay: 2300 }).stage, 'seek');
  assert.equal(hook({ hook: 'finesse-hook', delay: 2400 }).stage, 'fight');
});

test('light line, matching hook and paid training stack without opening the window early', () => {
  const setup = { hook: 'finesse-hook', training: 1 };
  assert.deepEqual(hook({ ...setup, delay: 2750 }).window, { from: 550, until: 2750 });
  assert.equal(hook({ ...setup, delay: 2750 }).stage, 'fight');
  assert.equal(hook({ ...setup, delay: 2751 }).stage, 'seek');
  assert.equal(hook({ ...setup, delay: 549 }).stage, 'seek');
});

test('an outing snapshots tackle and Practice and Ranked keep their original timing', () => {
  const line = { lure: 'jig', windowMs: 100 };
  const hook = { lure: 'jig', windowMs: 200 };
  const run = start(1000, () => 0, undefined, { campaign: { line, hook } });
  line.windowMs = 9000;
  hook.windowMs = 9000;
  assert.equal(publicRun(run).window.until, 2400);
  for (const practice of [false, true]) {
    const result = hookAttempt(practice);
    assert.equal(result.window.until, 2100);
    assert.equal(result.stage, 'seek');
  }
});

function hookAttempt(practice) {
  return hook({ campaign: false, practice, hook: 'finesse-hook', training: 1, delay: 2200 });
}

test('Lake Regular counts committed Campaign payouts across outings and legacy saves', () => {
  const milestone = awards => campaignMilestone({ awards });
  assert.equal(milestone({}).earned, false);
  assert.equal(milestone({ 'first:0': 10 }).catches, 1);
  const earned = milestone({ 'first:0': 10, 'second:0': 15 });
  assert.equal(earned.earned, true);
  assert.equal(earned.goal, 2);
  assert.equal(earned.name, 'Lake Regular');
  assert.equal(milestone({ 'first:0': 10, 'second:0': 15, 'third:0': 10 }).catches, 3);
  assert.equal(campaignMilestone({ awards: {}, collection: { perch: { catches: 9 } } }).earned, false,
    'Practice discoveries alone do not count toward Campaign progress');
});
