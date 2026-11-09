import test from 'node:test';
import assert from 'node:assert/strict';
import data from './lake-map-data.mjs';
import { start, apply, publicRun, moveToHole, selectHoleFish, abandonHoleFish, lakes } from './rules.mjs';
const shore = data.cells.find((c) => c.area === 'starter-shore');
const reef = data.cells.find((c) => c.depthFt >= 30);
const setup = (hole = shore) =>
  start(1000, () => 0.2, undefined, { campaign: { hole, area: hole.area, lineStrength: 12 } });
test('map cells and bathymetry stay in the shared coordinate system', () => {
  assert.equal(data.lakeId, '48000200');
  assert.ok(data.contours.length);
  assert.ok(data.shore.startsWith('M'));
  for (const c of data.cells) {
    assert.ok(c.x > 0 && c.x < 500 && c.y > 0 && c.y < 500);
    assert.ok(c.depthFt > 0);
  }
});
test('hole selection and moves preserve attempts, expiry, equipment and candidates before jig', () => {
  const r = setup();
  const initial = structuredClone(r.holes[shore.id]);
  const expires = r.expires;
  assert.equal(r.seekUntil, null);
  assert.equal(publicRun(r).candidates.length, 3);
  selectHoleFish(r, 1);
  assert.equal(r.index, 0);
  moveToHole(r, reef, 2000, 40000);
  assert.equal(r.index, 0);
  assert.equal(r.expires, expires);
  assert.equal(r.campaign.lineStrength, 12);
  assert.notDeepEqual(r.holes[reef.id].candidates, initial.candidates);
  moveToHole(r, shore, 3000, 60000);
  assert.deepEqual(r.holes[shore.id].candidates, initial.candidates);
  assert.equal(r.holes[shore.id].selected, 1);
});
test('first jig starts rarity timer; target change requires abandonment and counts once', () => {
  const r = setup();
  const target = lakes[r.lake].fish[r.encounters[0].species];
  apply(r, { action: 'jig', lure: target.lure }, 4000);
  assert.equal(r.committed, true);
  assert.ok(r.seekUntil >= 24000);
  assert.throws(() => selectHoleFish(r, 1), /End/);
  assert.throws(() => moveToHole(r, reef, 4100), /End/);
  abandonHoleFish(r, 4200);
  assert.equal(r.index, 1);
  assert.equal(r.committed, false);
  assert.equal(r.seekUntil, null);
  assert.throws(() => abandonHoleFish(r, 4300), /No committed/);
  assert.equal(r.index, 1);
});
test('release a hooked fish before moving; six shared attempts finish the outing', () => {
  const r = setup();
  for (let n = 0; n < 6; n++) {
    const now = 5000 + n * 3000;
    const fish = lakes[r.lake].fish[r.encounters[r.index].species];
    apply(r, { action: 'jig', lure: fish.lure }, now);
    apply(r, { action: 'reel' }, now + 700);
    assert.equal(r.stage, 'fight');
    assert.throws(() => moveToHole(r, reef, now + 800), /End/);
    abandonHoleFish(r, now + 900);
    if (n < 5) moveToHole(r, n % 2 ? shore : reef, now + 1000);
  }
  assert.equal(r.index, 6);
  assert.equal(r.stage, 'done');
  assert.equal(r.fight, null);
});
test('same hole yields identical playable conditions regardless of drilling input', () => {
  assert.deepEqual(publicRun(setup()), publicRun(setup()));
});
