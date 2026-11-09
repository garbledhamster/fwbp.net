export const lures = { jig: 'Jig', spoon: 'Spoon', minnow: 'Minnow' };
const milleLacs = [
  { id: 'perch', pull: 0.65, size: [5, 13, 11], name: 'Yellow perch', rarity: 'Common', points: 10, lure: 'jig', art: ['scenes', 'bi-perch', '0 0 172 66'], weight: 5 },
  { id: 'rock-bass', pull: 0.85, size: [5, 12, 10], name: 'Rock bass', rarity: 'Common', points: 15, lure: 'jig', art: ['fish', 'rock-bass', '0 0 160 92'], weight: 4 },
  { id: 'walleye', pull: 1.8, size: [12, 32, 28], name: 'Walleye', rarity: 'Uncommon', points: 25, lure: 'minnow', art: ['scenes', 'bi-walleye', '0 0 172 66'], weight: 3 },
  { id: 'pike', pull: 2.2, size: [18, 46, 39, 46.25], name: 'Northern pike', rarity: 'Uncommon', points: 35, lure: 'spoon', art: ['lake-life', 'pike', '0 0 230 72'], weight: 3 },
  { id: 'smallmouth', pull: 2, size: [8, 22, 19], name: 'Smallmouth bass', rarity: 'Uncommon', points: 30, lure: 'minnow', art: ['lake-life', 'bass', '0 0 172 80'], weight: 3 },
  { id: 'muskie', pull: 2.8, size: [24, 58, 50, 58.25], name: 'Muskie', rarity: 'Rare', points: 75, lure: 'spoon', art: ['fish', 'muskie', '0 0 245 72'], weight: 1 },
];
export const lakes = { 'mille-lacs': { name: 'Mille Lacs', fish: milleLacs } };
export const skills = { quick: 'Quick Bite', control: 'Line Control', lift: 'Lift' };
export const practiceSkills = {
  control: '350 ms more to set the hook',
  lift: 'Reel in extra line on the first clear pull',
};
const searchDepths = [1, 3, 2, 5, 4, 0];
const searchLaneCenters = [27, 50, 73];
export const starterArea = 'starter-shore';
export const campaignAreas = {
  [starterArea]: { name: 'Starter Shore' },
  'deep-reef': {
    name: 'Deep Reef',
    depths: [3, 4, 2, 5, 1, 0],
    weightBonus: { 'rock-bass': 4, walleye: 2, pike: 3, smallmouth: 2, muskie: 2 },
  },
};
const seekWindows = { Common: 30000, Uncommon: 25000, Rare: 20000 };
const phaseWeights = {
  dusk: { perch: 2, 'rock-bass': 2, walleye: 8, pike: 2, smallmouth: 2, muskie: 1 },
  night: { perch: 1, 'rock-bass': 1, walleye: 9, pike: 2, smallmouth: 1, muskie: 2 },
};

export function campaignPhase(elapsedMs = 0) {
  const timeOfDay = elapsedMs % 105000;
  if (timeOfDay < 30000) return 'day';
  if (timeOfDay < 60000) return 'dusk';
  return 'night';
}

function encounterPool(lake, phase, area, hole) {
  return lakes[lake].fish.flatMap((fish, index) => {
    const phaseWeight = phaseWeights[phase]?.[fish.id] ?? fish.weight;
    const areaBonus = hole?.weightBonus?.[fish.id] ?? campaignAreas[area]?.weightBonus?.[fish.id] ?? 0;
    return Array(phaseWeight + areaBonus).fill(index);
  });
}

function chooseOutingSpecies(run, elapsedMs) {
  if (!run.campaign && !run.practice) return;
  const encounter = run.encounters[run.index];
  const pool = encounterPool(run.lake, campaignPhase(elapsedMs), run.campaign?.area ?? starterArea);
  encounter.species = pool[Math.floor(encounter.speciesRoll * pool.length)];
}
const practiceLevelCatches = 2;
const practiceCatchXp = 10;
export const practiceLevelXp = practiceLevelCatches * practiceCatchXp;

export function reelWindow(levels) {
  return { from: 550 - levels.quick * 125, until: 2100 + levels.control * 350 };
}

function hookWindow(run, fish) {
  if (!run.campaign) return reelWindow(run.skills);
  const { hook, line, lineControlRank = 0 } = run.campaign;
  const window = reelWindow({ ...run.skills, control: lineControlRank });
  if (hook && hook.lure === fish?.lure) window.until += hook.windowMs;
  if (line && line.lure === fish?.lure) window.until += line.windowMs;
  return window;
}
export const runLifetime = 20 * 60 * 1000;
const moveIntervalMs = 250;
const fightStepMs = 40;
const surgeCycleMs = 2400;
const reelLength = 1.5;
const starterLineStrength = 8;
const tightLoad = 4.8;

function startLineFight(run, fish, encounter, now) {
  // Each deeper stretch of water adds another length of line to reel in.
  const startDepth = reelLength * (encounter.depth + 1 + encounter.y / 100);
  const [min, max] = fish.size;
  const size = (run.catch.length - min) / (max - min);
  // Even a big fish gives the angler room to react on starter line.
  const pull = Math.min(3.3, Math.round(fish.pull * (0.9 + size * 0.5) * 10) / 10);
  run.fight = {
    lineStrength: run.campaign?.lineStrength ?? starterLineStrength, startDepth, pull, hookedAt: now, elapsed: 0,
    distance: startDepth, remaining: startDepth, paidOut: startDepth, tension: 1.1,
    x: 0, y: 0, slack: 0, tight: false, pullUp: false,
  };
  run.stage = 'fight';
  run.last = now;
}

function sampleFight(run) {
  const fight = run.fight;
  const phase = fight.elapsed % surgeCycleMs;
  const surge = Math.max(0, Math.min(phase / 600, 1, (1800 - phase) / 700));
  const roomToRun = Math.min(1, fight.remaining / reelLength);
  fight.y = fight.pull * surge * roomToRun;
  fight.distance = fight.remaining + fight.y;
  fight.x = Math.sin(phase * 2 * Math.PI / surgeCycleMs) * (fight.pull / 2.8) * roomToRun;
  fight.slack = Math.max(0, fight.paidOut - fight.distance);
  fight.tension = Math.round(Math.max(0, 1.1 + (fight.distance - fight.paidOut) * 2) * 10) / 10;
  fight.tight = fight.tension >= tightLoad;
  fight.pullUp = fight.remaining === 0;
  if (fight.tension > fight.lineStrength) {
    run.snap = { tension: fight.tension, lineStrength: fight.lineStrength };
    miss(run, 'snapped');
    run.cue = `Line snapped at ${fight.tension} lb on ${fight.lineStrength} lb line.`;
  }
}

// Advance through the same samples even if the browser misses a frame.
export function advanceLineFight(run, now) {
  if ((!run.campaign && !run.practice) || run.stage !== 'fight') return false;
  const elapsed = Math.floor((Math.min(now, run.expires) - run.fight.hookedAt) / fightStepMs) * fightStepMs;
  let changed = false;
  while (run.fight && run.fight.elapsed < elapsed) {
    run.fight.elapsed += fightStepMs;
    sampleFight(run);
    changed = true;
  }
  if (run.stage === 'fight' && now >= run.expires) {
    run.stage = 'done';
    run.fight = run.catch = null;
    run.cue = 'This outing expired.';
    changed = true;
  }
  if (run.stage !== 'fight') run.version++;
  return changed;
}

function moveLineFight(run, action, target) {
  const fight = run.fight;
  if (action === 'loosen') {
    const room = Math.max(0, fight.distance + reelLength - fight.paidOut);
    fight.paidOut += Math.min(room, reelLength);
  } else if (action === 'lift') {
    if (!fight.pullUp) throw Error('Reel the fish to the ice hole first.');
    if (fight.tight) throw Error('Loosen the line before pulling up.');
    land(run, target);
    return;
  } else {
    // A hard run resists the reel. The same input takes up line but adds load.
    const extra = run.practice && run.skills.lift && !fight.tight && fight.remaining === fight.startDepth
      ? Math.min(reelLength, Math.max(0, fight.remaining - reelLength)) : 0;
    const length = reelLength + extra;
    fight.paidOut = Math.max(0, fight.paidOut - length);
    if (!fight.tight) fight.remaining = Math.max(0, fight.remaining - length);
  }
  sampleFight(run);
}

function seekDeadline(run, now) {
  const { species } = run.encounters[run.index];
  return now + seekWindows[lakes[run.lake].fish[species].rarity];
}

export function start(now, random = Math.random, lake = 'mille-lacs', { practice = false, campaign } = {}) {
  const pool = encounterPool(lake, 'day');
  const area = Object.hasOwn(campaignAreas, campaign?.area) ? campaign.area : starterArea;
  const depths = campaignAreas[area].depths ?? searchDepths;
  const usesLineFight = campaign || practice;
  let firstLane = 0;
  const run = {
    lake, skills: { quick: 0, control: 0, lift: 0 }, skillPoints: 0, fight: null,
    encounters: depths.map((depth, index) => {
      const speciesRoll = random();
      const horizontalRoll = random();
      let x = 17 + Math.round(horizontalRoll * 66);
      if (usesLineFight) {
        // Rotate through all three lanes from the first fish's random position.
        if (index === 0) {
          firstLane = x < 38 ? 0 : x < 62 ? 1 : 2;
        } else {
          const lane = (firstLane + index) % searchLaneCenters.length;
          x = searchLaneCenters[lane] + Math.round((horizontalRoll - .5) * 20);
        }
      }
      return {
        depth,
        ...(usesLineFight ? { speciesRoll } : { species: pool[Math.floor(speciesRoll * pool.length)] }),
        x,
        y: 28 + Math.round(random() * 38),
        sizeRoll: random(), colorRoll: random(),
      };
    }),
    expires: now + runLifetime, last: now - 300, index: 0, score: 0, discoveries: [],
    stage: 'seek', biteAt: 0, catch: null, cue: 'Fish in view. Pick a lure and jig.',
    version: 0, submitted: false,
    ...(practice && { practice: true, landed: 0 }),
    ...(usesLineFight && { snap: null, wrongLures: 0, reaction: null }),
    ...(campaign && {
      campaign: { ...campaign, area, line: campaign.line && { ...campaign.line }, hook: campaign.hook && { ...campaign.hook }, lineStrength: campaign.lineStrength ?? starterLineStrength },
    }),
  };
  if (campaign?.hole) {
    run.holes = {};
    run.holeSeed = structuredClone(run.encounters);
    run.committed = false;
    moveToHole(run, campaign.hole, now, campaign.elapsedMs);
    return run;
  }
  chooseOutingSpecies(run, campaign?.elapsedMs);
  run.seekUntil = seekDeadline(run, now);
  return run;
}

export function publicRun(run) {
  const encounter = run.encounters[run.index];
  const target = run.stage !== 'missed' && encounter && lakes[run.lake].fish[encounter.species];
  const xp = (run.landed ?? (run.index + Number(run.stage === 'landed'))) * practiceCatchXp;
  return {
    fish: target ? { id: target.id, art: target.art, depth: encounter.depth ?? searchDepths[run.index], x: encounter.x, y: encounter.y, gilded: encounter.colorRoll >= .97 } : null,
    lake: lakes[run.lake].name, skills: run.skills, skillPoints: run.skillPoints, fight: run.fight, window: hookWindow(run, target),
    index: run.index, count: run.encounters.length, score: run.score, stage: run.stage,
    version: run.version, discoveries: run.discoveries, catch: run.catch, cue: run.cue,
    seekUntil: run.stage === 'seek' ? run.seekUntil ?? null : null,
    submitted: run.submitted,
    ...(run.practice && { practice: { xp, level: xp >= practiceLevelXp ? 2 : 1 } }),
    ...(run.campaign && { area: campaignAreas[run.campaign.area].name }),
    ...(run.holes && { hole: run.campaign.hole, committed: run.committed, candidates: run.holes[run.campaign.holeId].candidates.map((fish, slot) => ({ slot, selected: slot === run.holes[run.campaign.holeId].selected, ...lakes[run.lake].fish[fish.species], depth: fish.depth, x: fish.x, y: fish.y })) }),
    ...((run.campaign || run.practice) && {
      lineStrength: run.campaign?.lineStrength ?? starterLineStrength,
      snap: run.snap, fight: run.fight && { ...run.fight },
      wrongLures: run.wrongLures, reaction: run.reaction,
    }),
  };
}

export function apply(run, input, now, { campaignElapsedMs = run.campaign?.elapsedMs } = {}) {
  if (!input || Object.keys(input).some(key => !['action', 'lure', 'skill'].includes(key))) throw Error('Invalid action.');
  if (now >= run.expires) throw Error('This outing expired.');
  const jig = input.action === 'jig' && run.stage === 'seek' && Object.hasOwn(lures, input.lure);
  if (run.stage === 'seek' && seekExpired(run, now) && (jig || input.action === 'expire')) {
    miss(run);
    run.version++;
    return publicRun(run);
  }
  const lineFight = (run.campaign || run.practice) && run.stage === 'fight';
  if (lineFight) {
    advanceLineFight(run, now);
    if (run.stage !== 'fight') return publicRun(run);
  }
  const paced = ['jig', 'lift', 'loosen'].includes(input.action) || (lineFight && input.action === 'reel');
  if (paced && now - run.last < moveIntervalMs) throw Error('Give the line a moment.');
  const encounter = run.encounters[run.index];
  const target = lakes[run.lake].fish[encounter?.species];
  if (jig) {
    if (run.holes && !run.committed) { run.committed = true; run.seekUntil = seekDeadline(run, now); }
    if (input.lure === target.lure) {
      if (run.campaign || run.practice) run.reaction = null;
      run.stage = 'bite';
      run.biteAt = now;
      run.cue = 'Yeah, reel it! Wait for the marker to reach the gold band.';
    } else if (run.campaign || run.practice) {
      run.wrongLures++;
      if (run.wrongLures >= (target.rarity === 'Rare' ? 2 : 3)) {
        miss(run, 'spooked');
        run.cue = run.stage === 'done' ? 'That fish spooked. Outing complete.' : 'That fish spooked and swam off.';
      } else {
        run.reaction = 'wrong-lure';
        run.cue = 'Try a different lure.';
      }
    } else {
      run.cue = 'Keep on jigging! It looked, but try a different lure.';
    }
  } else if (input.action === 'reel' && run.stage === 'bite') {
    const elapsed = now - run.biteAt;
    const { from, until } = hookWindow(run, target);
    if (elapsed >= from && elapsed <= until) {
      const [min, max, trophy, record] = target.size;
      const length = record && encounter.sizeRoll >= .995
        ? record : Math.round((min + encounter.sizeRoll ** 1.8 * (max - min)) * 4) / 4;
      const grade = length === record ? 'Record' : length >= trophy ? 'Trophy' : 'Standard';
      const gilded = encounter.colorRoll >= .97;
      const points = target.points + (grade === 'Record' ? 60 : grade === 'Trophy' ? 20 : 0) + (gilded ? 30 : 0);
      run.catch = { name: target.name, rarity: target.rarity, points, lure: target.lure, length, grade, gilded };
      if (run.campaign || run.practice) {
        startLineFight(run, target, encounter, now);
      } else {
        const effort = target.rarity === 'Rare' || grade !== 'Standard' ? 3
          : target.rarity === 'Uncommon' ? 2 : 0;
        if (effort) {
          const surge = effort === 3 ? 80 : 68;
          run.fight = { pulls: Math.max(1, effort - run.skills.lift), tension: surge, surge };
          run.stage = 'fight';
          run.cue = 'Loosen up! Give it some line.';
        } else {
          land(run, target);
        }
      }
    } else {
      run.stage = 'seek';
      if (run.campaign || run.practice) run.reaction = 'slipped-hook';
      run.cue = 'It slipped the hook. Jig again to bring it back.';
    }
  } else if (lineFight && ['reel', 'lift', 'loosen'].includes(input.action)) {
    moveLineFight(run, input.action, target);
  } else if (run.stage === 'fight' && ['lift', 'loosen'].includes(input.action)) {
    const fight = run.fight;
    if (input.action === 'loosen') {
      fight.tension = Math.max(0, fight.tension - 52);
      run.cue = fight.pulls === 1 ? 'Pull it up!' : 'Yeah, reel it!';
    } else if (fight.tension >= 60) {
      fight.tension = Math.min(100, fight.tension + 30 - run.skills.control * 5);
      run.cue = 'Loosen up! The line is getting tight.';
      if (fight.tension === 100) {
        run.stage = 'seek';
        run.fight = run.catch = null;
        run.cue = 'The line snapped. Jig to try again.';
      }
    } else if (--fight.pulls === 0) {
      land(run, target);
    } else {
      fight.tension = fight.surge;
      run.cue = 'Loosen up! Let it run.';
    }
  } else if (input.action === 'upgrade' && run.stage === 'landed'
    && run.skillPoints > 0 && Object.hasOwn(run.practice ? practiceSkills : skills, input.skill)
    && run.skills[input.skill] < 2) {
    run.skills[input.skill]++;
    run.skillPoints--;
    if (!run.practice) run.cue = `${skills[input.skill]} improved.`;
  } else if (input.action === 'next' && ['landed', 'missed'].includes(run.stage)) {
    if (run.practice) {
      run.landed ??= run.index + Number(run.stage === 'landed');
      run.skillPoints = 0;
    }
    run.index++;
    run.catch = null;
    if (run.campaign || run.practice) {
      run.snap = null;
      run.wrongLures = 0;
      run.reaction = null;
      run.last = now - moveIntervalMs;
    }
    run.stage = run.index === run.encounters.length ? 'done' : 'seek';
    if (run.holes) {
      consumeHoleFish(run);
      run.committed = false;
      if (run.stage === 'seek') prepareHoleFish(run, campaignElapsedMs);
    } else if (run.stage === 'seek') chooseOutingSpecies(run, campaignElapsedMs);
    run.seekUntil = run.stage === 'seek' && !run.holes ? seekDeadline(run, now) : null;
    run.cue = run.stage === 'done' ? 'Outing complete.' : 'Fish in view. Pick a lure and jig.';
  } else {
    throw Error('That action is unavailable.');
  }
  if (run.stage === 'seek' && seekExpired(run, now)) miss(run);
  if (paced) run.last = now;
  run.version++;
  return publicRun(run);
}

function seekExpired(run, now) {
  return Number.isFinite(run.seekUntil) && now >= run.seekUntil;
}

function miss(run, reaction = 'timer') {
  if (run.campaign || run.practice) run.reaction = reaction;
  const last = run.index + 1 === run.encounters.length;
  run.stage = last ? 'done' : 'missed';
  if (last) run.index++;
  run.seekUntil = null;
  run.fight = run.catch = null;
  run.cue = last ? 'The fish swam away. Outing complete.' : 'The fish swam away.';
}

function land(run, target) {
  const { length, rarity, points, grade, gilded } = run.catch;
  run.fight = null;
  run.score += points;
  if (run.practice) run.landed = (run.landed ?? run.index) + 1;
  if (!run.campaign && (!run.practice || run.landed === practiceLevelCatches)) run.skillPoints++;
  if (!run.discoveries.some(entry => entry.fish === target.name)) {
    run.discoveries.push({ fish: target.name, lure: target.lure });
  }
  run.stage = 'landed';
  run.cue = `${target.name} · ${length} in · ${rarity}${grade === 'Standard' ? '' : ' · ' + grade}${gilded ? ' · Gilded' : ''} · +${points} points`;
}

// Campaign map state lives on the same six-attempt run. Opening a hole never
// replaces its clock, score, award index, equipment or previously sampled fish.
function prepareHoleFish(run, elapsedMs = 0) {
  const hole = run.campaign.hole;
  const saved = run.holes[hole.id];
  if (!saved.candidates.length) {
    const pool = encounterPool(run.lake, campaignPhase(elapsedMs), hole.area, hole);
    const salt = (hole.area === starterArea ? saved.generation * 17 : hole.id.charCodeAt(0) * 7 + Number(hole.id[1]) * 11 + saved.generation * 17) / 101;
    saved.candidates = Array.from({ length: 3 }, (_, slot) => {
      const seed = run.holeSeed[(slot + saved.generation) % run.holeSeed.length];
      const roll = (seed.speciesRoll + salt + slot / 3) % 1;
      const maxBand = Math.min(5, Math.max(1, Math.round(hole.depthFt / 7) - 1));
      return { ...seed, species: pool[Math.floor(roll * pool.length)],
        depth: Math.max(0, maxBand - (slot % 3)), x: [27, 50, 73][slot], y: 35 + slot * 10 };
    });
    saved.generation++;
  }
  saved.selected = Math.min(saved.selected, saved.candidates.length - 1);
  run.encounters[run.index] = { ...saved.candidates[saved.selected] };
}
function consumeHoleFish(run) {
  const saved = run.holes[run.campaign.holeId];
  saved.candidates.splice(saved.selected, 1);
  saved.selected = 0;
}
export function moveToHole(run, hole, now, elapsedMs = 0) {
  if (!run.holes || !hole?.id || !Object.hasOwn(campaignAreas, hole.area) || !Number.isFinite(hole.depthFt)) throw Error('Choose a valid Campaign hole.');
  if (run.committed || !['seek'].includes(run.stage)) throw Error('End the current attempt before moving.');
  if (now >= run.expires) throw Error('This outing expired.');
  const holeId = hole.id;
  run.campaign.holeId = holeId;
  run.campaign.hole = structuredClone(hole);
  run.campaign.area = hole.area;
  run.holes[holeId] ??= { candidates: [], selected: 0, generation: 0 };
  prepareHoleFish(run, elapsedMs);
  run.seekUntil = null;
  run.version++;
  return publicRun(run);
}
export function selectHoleFish(run, slot) {
  if (!run.holes || run.stage !== 'seek' || run.committed) throw Error('End the current attempt before changing fish.');
  const saved = run.holes[run.campaign.holeId];
  if (!Number.isInteger(slot) || !saved.candidates[slot]) throw Error('Choose a fish in this hole.');
  saved.selected = slot;
  prepareHoleFish(run);
  run.version++;
  return publicRun(run);
}
export function abandonHoleFish(run, now, elapsedMs = 0) {
  if (!run.holes || !run.committed || !['seek', 'bite', 'fight'].includes(run.stage)) throw Error('No committed attempt to end.');
  consumeHoleFish(run);
  run.index++;
  run.committed = false;
  run.stage = run.index === run.encounters.length ? 'done' : 'seek';
  run.fight = run.catch = run.seekUntil = run.snap = run.reaction = null;
  run.wrongLures = 0;
  run.last = now - moveIntervalMs;
  if (run.stage === 'seek') prepareHoleFish(run, elapsedMs);
  run.cue = run.stage === 'done' ? 'Outing complete.' : 'Attempt ended. Choose another fish.';
  run.version++;
  return publicRun(run);
}
