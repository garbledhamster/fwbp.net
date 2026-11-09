import test from 'node:test';
import assert from 'node:assert/strict';
import { apply, start } from './rules.mjs';

const finesseHook = { lure: 'jig', windowMs: 200 };
const biteAt = 1300;

function tryHook({ species = .05, lure = 'jig', campaign, delay, practice = false }) {
  const rolls = [species, .2, .5, .4, .1];
  let draw = 0;
  const run = start(1000, () => rolls[draw++ % rolls.length], undefined, { campaign, practice });
  const bite = apply(run, { action: 'jig', lure }, biteAt);
  assert.equal(bite.stage, 'bite');
  const outcome = apply(run, { action: 'reel' }, biteAt + delay);
  return { window: bite.window, stage: outcome.stage };
}

test('the Fine-wire hook grants 200 ms with Jig only', () => {
  assert.deepEqual(tryHook({ campaign: {}, delay: 2300 }), {
    window: { from: 550, until: 2100 }, stage: 'seek',
  });
  assert.deepEqual(tryHook({ campaign: { hook: finesseHook }, delay: 2300 }), {
    window: { from: 550, until: 2300 }, stage: 'landed',
  });
  assert.equal(tryHook({ campaign: { hook: finesseHook }, delay: 2301 }).stage, 'seek');
  assert.deepEqual(tryHook({ species: .55, lure: 'minnow', campaign: { hook: finesseHook }, delay: 2200 }), {
    window: { from: 550, until: 2100 }, stage: 'seek',
  });
});

test('Line Control widens the window with any lure and stacks with the equipped hook', () => {
  assert.deepEqual(tryHook({ species: .55, lure: 'minnow', campaign: { lineControlRank: 1 }, delay: 2450 }), {
    window: { from: 550, until: 2450 }, stage: 'fight',
  });
  const campaign = { hook: finesseHook, lineControlRank: 1 };
  assert.deepEqual(tryHook({ campaign, delay: 2650 }), {
    window: { from: 550, until: 2650 }, stage: 'landed',
  });
  assert.equal(tryHook({ campaign, delay: 2651 }).stage, 'seek');
  assert.equal(tryHook({ campaign, delay: 549 }).stage, 'seek', 'neither upgrade opens the window early');
});

test('a fresh Practice or Ranked outing retains the original hook window', () => {
  for (const practice of [false, true]) {
    assert.deepEqual(tryHook({ practice, delay: 2101 }), {
      window: { from: 550, until: 2100 }, stage: 'seek',
    });
  }
});
