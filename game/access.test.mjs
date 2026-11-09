import test from 'node:test';
import assert from 'node:assert/strict';
import { publicRun, start } from './rules.mjs';

function firstEncounter(area, elapsedMs, speciesRoll) {
  const rolls = [speciesRoll, .2, .5, .4, .1];
  let draw = 0;
  const random = () => rolls[draw++ % rolls.length];
  return publicRun(start(1000, random, 'mille-lacs', { campaign: { area, elapsedMs } }));
}

test('Deep Reef gives the same seed a different catch while keeping the six-fish outing', () => {
  const shore = firstEncounter('starter-shore', 0, .2);
  const reef = firstEncounter('deep-reef', 0, .2);
  assert.equal(shore.fish.id, 'perch');
  assert.equal(reef.fish.id, 'rock-bass');
  assert.equal(shore.lake, 'Mille Lacs');
  assert.equal(reef.lake, shore.lake);
  assert.equal(reef.area, 'Deep Reef');
  assert.ok(reef.fish.depth > shore.fish.depth);
  assert.equal(reef.count, 6);
  assert.equal(reef.seekUntil, 31000);
});

test('the reef encounter mix also responds to the time of day', () => {
  const day = firstEncounter('deep-reef', 0, .58);
  const dusk = firstEncounter('deep-reef', 30000, .58);
  assert.equal(day.fish.id, 'pike');
  assert.equal(dusk.fish.id, 'walleye');
  assert.equal(dusk.seekUntil, 26000);
});
