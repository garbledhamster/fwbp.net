import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import data from './lake-map-data.mjs';
import * as rules from './rules.mjs';
const { start, apply, publicRun, moveToHole, abandonHoleFish, stepCampaignFish, createCampaignRoster } = rules;
const shore = data.cells.find((c) => c.area === 'starter-shore');
const reef = data.cells.find((c) => c.depthFt >= 30);
const setup = (hole = shore) =>
  start(1000, () => 0.2, undefined, { campaign: { hole, area: hole.area, lineStrength: 12 } });
test('map cells and bathymetry stay in the shared coordinate system', () => {
  const art = readFileSync(new URL('../assets/maps/mille-lacs.svg', import.meta.url), 'utf8');
  const attribution = readFileSync(new URL('../assets/maps/README.md', import.meta.url), 'utf8');
  assert.match(attribution, /Lake ID \*\*48000200\*\*/);
  assert.match(art, /viewBox="0 0 500 500"/);
  assert.match(art, /<clipPath id="water"><path d="M/);
  assert.match(art, /<g clip-path="url\(#water\)"[^>]*><path d="M/);
  for (const c of data.cells) {
    assert.ok(c.x > 0 && c.x < 500 && c.y > 0 && c.y < 500);
    assert.ok(c.depthFt > 0);
  }
});
const bands = Array.from({ length: 6 }, (_, depth) => ({ top: 100 + 400 * depth, height: 400 }));
const swim = (r, now, lure = 'jig', eye = { x: 520, y: 420 }, reducedMotion = true) =>
  stepCampaignFish(r, now, { width: 1000, bands, lure, eye, reducedMotion });
const jig = (r, now, lure = 'jig') => apply(r, { action: 'jig', lure }, now);
const reel = (r, now) => apply(r, { action: 'reel' }, now);
function nextBite(r, startAt, fish) {
  const eye = { x: 1000 * fish.x / 100 + 32, y: bands[fish.depth].top + 4 * fish.y };
  swim(r, startAt, fish.lure, eye);
  jig(r, startAt, fish.lure);
  for (let now = startAt + 16; now <= startAt + 2000; now += 16) {
    if (swim(r, now, fish.lure, eye).contact) return now;
  }
  assert.fail('the fish never reached the nearby matching jig');
}

test('moving holes preserves attempts, expiry, equipment and fish after trying a lure', () => {
  const r = setup();
  const initial = structuredClone(publicRun(r).candidates);
  const expires = r.expires;
  jig(r, 1500, 'minnow');
  assert.equal(r.stage, 'seek');
  assert.equal(r.committed, false);
  assert.equal(r.seekUntil, null);
  moveToHole(r, reef, 2000, 40000);
  assert.equal(r.index, 0);
  assert.equal(r.expires, expires);
  assert.equal(r.campaign.lineStrength, 12);
  assert.notDeepEqual(publicRun(r).candidates, initial);
  moveToHole(r, shore, 3000, 60000);
  assert.deepEqual(publicRun(r).candidates, initial);
});

test('swimming changes both coordinates and eventually turns to face the direction of travel', () => {
  const r = setup();
  let before = swim(r, 1000).fish[0];
  let moved = false;
  let turned = false;
  for (let now = 1016; now <= 8500; now += 16) {
    const after = swim(r, now).fish[0];
    const dx = after.x - before.x;
    if (Math.abs(dx) > .1) assert.equal(after.right, dx > 0);
    moved ||= Math.abs(dx) > .1 && Math.abs(after.y - before.y) > .04;
    turned ||= after.right !== before.right;
    before = after;
  }
  assert.ok(moved && turned);
});

test('a matching jig can draw fish but only contact commits the attempt and starts gold', () => {
  const r = setup();
  const [, fish] = publicRun(r).candidates;
  const eye = { x: 575, y: bands[fish.depth].top + 4 * fish.y };
  swim(r, 4000, fish.lure, eye);
  jig(r, 4000, fish.lure);
  assert.equal(r.stage, 'seek');
  assert.equal(r.committed, false);
  assert.equal(r.seekUntil, null);
  const first = swim(r, 4016, fish.lure, eye);
  assert.equal(first.contact, false);
  assert.equal(first.fish.find(f => f.slot === fish.slot).mood, 'approach');
  let biteAt;
  for (let now = 4032; now < 6000; now += 16) {
    if (swim(r, now, fish.lure, eye).contact) { biteAt = now; break; }
  }
  assert.ok(biteAt);
  assert.equal(r.committed, true);
  assert.equal(publicRun(r).fish.id, fish.id);
  assert.ok(r.seekUntil > biteAt);
  assert.throws(() => moveToHole(r, reef, biteAt + 100), /End/);
  assert.equal(reel(r, biteAt + 549).stage, 'seek');
  assert.equal(r.committed, true);
  assert.equal(swim(r, biteAt + 800, fish.lure, eye).contact, false, 'the missed hook needs a fresh jig');
  assert.equal(r.stage, 'seek');
  const retry = nextBite(r, biteAt + 1800, fish);
  assert.equal(reel(r, retry + 550).stage, 'fight');
  abandonHoleFish(r, retry + 650);
  assert.equal(r.index, 1);
  assert.equal(r.committed, false);
  assert.equal(publicRun(r).candidates.length, 3, 'a released fish remains at its hole');
  assert.equal(r.seekUntil, null);
  assert.throws(() => abandonHoleFish(r, retry + 750), /No committed/);
});

test('the first matching swimmer to reach the jig gets the bite', () => {
  const r = setup();
  const [fish] = r.holes[shore.id].candidates;
  const lure = publicRun(r).candidates[0].lure;
  r.holes[shore.id].candidates = [
    { ...fish, x: 46, y: 50 },
    { ...fish, x: 48, y: 50 },
  ];
  const eye = { x: 500, y: bands[fish.depth].top + 200 };
  swim(r, 4000, lure, eye);
  jig(r, 4000, lure);
  const approaching = swim(r, 4016, lure, eye);
  assert.deepEqual(approaching.fish.map(f => f.mood), ['approach', 'approach']);
  assert.equal(approaching.contact, false);
  let contact;
  for (let now = 4032; now < 4300; now += 16) {
    const step = swim(r, now, lure, eye);
    if (step.contact) { contact = step; break; }
  }
  assert.equal(contact?.slot, 1);
  assert.equal(r.committed, true);
  const late = r.biteAt + publicRun(r).window.until + 1;
  assert.equal(reel(r, late).reaction, 'slipped-hook');
  assert.equal(r.stage, 'seek');
  assert.equal(r.committed, true);
});

test('bait changes and moving out of reach end approaches without spending attempts', () => {
  for (const cancel of ['bait', 'depth']) {
    const r = setup();
    const [, fish] = publicRun(r).candidates;
    const eye = { x: 580, y: bands[fish.depth].top + 4 * fish.y };
    const wrongLure = fish.lure === 'jig' ? 'spoon' : 'jig';
    swim(r, 4000, fish.lure, eye);
    jig(r, 4000, fish.lure);
    assert.equal(swim(r, 4016, fish.lure, eye).fish[1].mood, 'approach');
    swim(r, 4032, cancel === 'bait' ? wrongLure : fish.lure,
      cancel === 'depth' ? { ...eye, y: eye.y + 300 } : eye);
    for (let now = 4048; now <= 5300; now += 16) {
      assert.equal(swim(r, now, fish.lure, eye).contact, false);
    }
    assert.equal(r.stage, 'seek');
    assert.equal(r.committed, false);
    assert.equal(r.index, 0);
  }
});

test('the wrong lure can make a nearby fish back away without starting the hook timer', () => {
  const r = setup();
  const [, fish] = publicRun(r).candidates;
  const eye = { x: 525, y: bands[fish.depth].top + 4 * fish.y };
  const wrongLure = fish.lure === 'jig' ? 'spoon' : 'jig';
  swim(r, 4000, wrongLure, eye);
  jig(r, 4000, wrongLure);
  const first = swim(r, 4016, wrongLure, eye);
  assert.equal(first.fish[1].mood, 'away');
  assert.equal(first.contact, false);
  assert.equal(r.seekUntil, null);
  assert.equal(r.committed, false);
});

test('release a hooked fish before moving; six shared attempts finish the outing', () => {
  const r = setup();
  for (let n = 0; n < 6; n++) {
    const now = 5000 + n * 4000;
    const [fish] = publicRun(r).candidates;
    const biteAt = nextBite(r, now, fish);
    assert.equal(reel(r, biteAt + 700).stage, 'fight');
    assert.throws(() => moveToHole(r, reef, biteAt + 800), /End/);
    abandonHoleFish(r, biteAt + 900);
    if (n < 5) moveToHole(r, n % 2 ? shore : reef, biteAt + 1000);
  }
  assert.equal(r.index, 6);
  assert.equal(r.stage, 'done');
  assert.equal(r.fight, null);
});
test('same hole yields identical playable conditions regardless of drilling input', () => {
  assert.deepEqual(publicRun(setup()), publicRun(setup()));
});

test('suitable spots guarantee the active goal fish while keeping the first two rolled swimmers', () => {
  for (const [id, rolls, expected] of [
    ['A3', [.52, .45, .32], ['rock-bass', 'pike', 'perch']],
    ['E4', [.52, .45, .32], ['rock-bass', 'pike', 'perch']],
    ['E4', [.52, .05, .55], ['rock-bass', 'perch', 'pike']],
    ['B1', [.05, .12, .55], ['pike', 'rock-bass', 'walleye']],
  ]) {
    const hole = data.cells.find(cell => cell.id === id);
    const seed = rolls.flatMap(roll => [roll, .2, .5, .4, .1]);
    let draw = 0;
    const roster = createCampaignRoster(hole, 0, () => seed[draw++ % seed.length], expected.at(-1));
    assert.deepEqual(roster.map(fish => fish.speciesId), expected, id);
  }
  const otherReef = data.cells.find(cell => cell.id === 'D1');
  assert.ok(createCampaignRoster(otherReef, 0, () => .1, 'walleye').some(fish => fish.speciesId === 'walleye'));
});

test('a saved roster controls the fish when returning and a quiet hole stays empty on reload', () => {
  const roster = createCampaignRoster(shore, 0, () => .2, 'perch');
  const r = start(1000, () => .99, undefined, { campaign: { hole: shore, roster } });
  assert.deepEqual(publicRun(r).candidates.map(fish => fish.id), roster.map(fish => fish.speciesId));
  moveToHole(r, reef, 2000);
  moveToHole(r, shore, 3000, 0, roster.slice(1));
  assert.deepEqual(publicRun(r).candidates.map(fish => fish.key), roster.slice(1).map(fish => fish.key));
  moveToHole(r, shore, 4000, 0, []);
  assert.deepEqual(publicRun(r).candidates, []);
  assert.throws(() => jig(r, 4500), /quiet for today/);
  const reloaded = start(5000, () => .3, undefined, { campaign: { hole: shore, roster: [] } });
  assert.deepEqual(publicRun(reloaded).candidates, []);
});
