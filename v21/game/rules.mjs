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
export function catchQuality(speciesId, length) {
  const species = milleLacs.find(fish => fish.id === speciesId);
  if (!species) return 'Bronze';
  const [min, , trophy] = species.size;
  // The midpoint to trophy is tuned independently for each species' size range.
  return length >= trophy ? 'Gold' : length >= (min + trophy) / 2 ? 'Silver' : 'Bronze';
}
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
export const campaignGoals = [
  { speciesId: 'perch', holeId: 'A3', clue: 'Look for yellow perch near the weeds on Starter Shore. Try a jig at A3.' },
  { speciesId: 'pike', holeId: 'E4', clue: 'Look for northern pike along the shallower weed edge. Try a spoon at E4 on Starter Shore.' },
  { speciesId: 'walleye', holeId: 'B1', area: 'deep-reef', clue: 'Look for walleye along the reef edge. Try a minnow at B1 in Deep Reef.' },
];
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
  const window = reelWindow({ ...run.skills, control: lineControlRank, quick: run.campaign.lureWorkRank ?? 0 });
  if (hook && hook.lure === fish?.lure) window.until += hook.windowMs;
  if (line && line.lure === fish?.lure) window.until += line.windowMs;
  const bait = run.campaign.baits?.find(item => item.lure === fish?.lure);
  if (bait) window.until += bait.windowMs;
  return window;
}
export const runLifetime = 20 * 60 * 1000;
const moveIntervalMs = 250;
const fightStepMs = 40;
const surgeCycleMs = 2400;
const reelLength = 1.5;
const starterLineStrength = 8;
const restingLoad = 1.1;
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
    distance: startDepth, remaining: startDepth, paidOut: startDepth, tension: restingLoad,
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
  fight.tension = Math.round(Math.max(0, restingLoad + (fight.distance - fight.paidOut) * 2) * 10) / 10;
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

function moveLineFight(run, action, target, reelEffort) {
  const fight = run.fight;
  if (action === 'loosen') {
    const room = Math.max(0, fight.distance + reelLength - fight.paidOut);
    fight.paidOut += Math.min(room, reelLength);
  } else if (action === 'lift') {
    if (!fight.pullUp) throw Error('Reel the fish to the ice hole first.');
    if (fight.tight) throw Error('Loosen the line before pulling up.');
    land(run, target);
    return;
  } else if (run.campaign) {
    const effort = Number.isFinite(reelEffort) ? Math.min(1.5, Math.max(.75, reelEffort)) : 1;
    const takeUp = reelLength * effort;
    fight.paidOut = Math.max(0, fight.paidOut - takeUp);
    if (!fight.tight) {
      // Winding line under resistance raises the fish less, leaving more load on the line.
      const fishDrag = Math.max(0, fight.pull - .6) * .12;
      const lineDrag = Math.max(0, (fight.tension - restingLoad) / (tightLoad - restingLoad)) * .34;
      const travel = takeUp * (1 - fishDrag) * (1 - lineDrag);
      fight.remaining = Math.max(0, fight.remaining - travel);
    }
  } else {
    const extra = run.skills.lift && !fight.tight && fight.remaining === fight.startDepth
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
      campaign: { ...campaign, area, line: campaign.line && { ...campaign.line }, hook: campaign.hook && { ...campaign.hook }, baits: campaign.baits?.map(item => ({ ...item })), lineStrength: campaign.lineStrength ?? starterLineStrength },
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
  const target = run.stage !== 'missed' && (!run.holes || run.stage !== 'seek')
    && encounter && lakes[run.lake].fish[encounter.species];
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
    ...(run.holes && {
      hole: run.campaign.hole, committed: run.committed,
      candidates: run.holes[run.campaign.holeId].candidates.map((fish, slot) => ({
        ...lakes[run.lake].fish[fish.species], slot, depth: fish.depth, x: fish.x, y: fish.y,
      })),
    }),
    ...((run.campaign || run.practice) && {
      lineStrength: run.campaign?.lineStrength ?? starterLineStrength,
      snap: run.snap, fight: run.fight && { ...run.fight },
      wrongLures: run.wrongLures, reaction: run.reaction,
    }),
  };
}

export function apply(run, input, now, { campaignElapsedMs = run.campaign?.elapsedMs, reelEffort } = {}) {
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
    if (run.holes) {
      run.waterJig = { lure: input.lure };
      run.reaction = null;
    } else if (input.lure === target.lure) {
      startBite(run, now);
    } else if (run.campaign || run.practice) {
      run.wrongLures++;
      if (run.wrongLures >= (target.rarity === 'Rare' ? 2 : 3) + (run.campaign?.lureWorkRank ?? 0)) {
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
    moveLineFight(run, input.action, target, reelEffort);
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

function startBite(run, now) {
  if (run.campaign || run.practice) run.reaction = null;
  run.stage = 'bite';
  run.biteAt = now;
  run.cue = 'Yeah, reel it! Wait for the marker to reach the gold band.';
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
export function campaignDepthBand(depthFt) {
  return Math.min(5, Math.max(1, Math.round(depthFt / 7) - 1));
}

function prepareHoleFish(run, elapsedMs = 0) {
  const hole = run.campaign.hole;
  const saved = run.holes[hole.id];
  if (!saved.candidates.length) {
    const pool = encounterPool(run.lake, campaignPhase(elapsedMs), hole.area, hole);
    const salt = (hole.area === starterArea ? saved.generation * 17 : hole.id.charCodeAt(0) * 7 + Number(hole.id[1]) * 11 + saved.generation * 17) / 101;
    saved.candidates = Array.from({ length: 3 }, (_, slot) => {
      const seed = run.holeSeed[(slot + saved.generation) % run.holeSeed.length];
      const roll = (seed.speciesRoll + salt + slot / 3) % 1;
      const maxBand = campaignDepthBand(hole.depthFt);
      return { ...seed, species: pool[Math.floor(roll * pool.length)],
        depth: Math.max(0, maxBand - (slot % 3)), x: [27, 50, 73][slot], y: 35 + slot * 10 };
    });
    const goal = campaignGoals.find(goal => goal.holeId === hole.id);
    if (goal) {
      const species = lakes[run.lake].fish.findIndex(fish => fish.id === goal.speciesId);
      if (!saved.candidates.some(fish => fish.species === species)) saved.candidates.at(-1).species = species;
    }
    saved.generation++;
  }
  run.swimming = run.waterJig = undefined;
}

function consumeHoleFish(run) {
  const saved = run.holes[run.campaign.holeId];
  if (saved.active !== undefined) saved.candidates.splice(saved.active, 1);
  saved.active = undefined;
}

// The renderer and line share lake-relative CSS pixels. Each swimmer's point
// is its mouth, so contact uses the same position as the visible lure eye.
export function stepCampaignFish(run, now, { width, bands, lure, eye, reducedMotion = false }) {
  const saved = run.holes[run.campaign.holeId];
  const swimming = run.swimming ??= { since: now, last: now, fish: [] };
  const elapsed = Math.min(64, Math.max(0, now - swimming.last));
  const t = (now - swimming.since) / 1000;
  swimming.last = now;
  const jig = run.waterJig;
  const newJig = jig && !jig.eye;
  if (newJig) jig.eye = { ...eye };
  const seeking = run.stage === 'seek' && now < run.expires && !seekExpired(run, now);
  const reach = Math.min(420, width * .37);
  let first;
  const fish = saved.candidates.flatMap((candidate, slot) => {
    if (slot === saved.active && run.stage !== 'seek') return [];
    const band = bands[candidate.depth];
    if (!band?.height) return [];
    const centerX = width * candidate.x / 100;
    const centerY = band.top + band.height * candidate.y / 100;
    const verticalReach = Math.max(64, Math.min(98, band.height * .18));
    const fish = swimming.fish[slot] ??= { x: centerX, y: centerY, right: slot !== 2 };
    const dx = eye.x - fish.x;
    const dy = eye.y - fish.y;
    if (newJig && seeking && lure === jig.lure && Math.abs(dx) <= reach && Math.abs(dy) <= verticalReach) {
      const likesLure = lakes[run.lake].fish[candidate.species].lure === lure;
      if (likesLure && (saved.active === undefined || saved.active === slot)) {
        fish.approach = jig;
        fish.away = undefined;
      } else if (!likesLure) {
        fish.approach = undefined;
        fish.away = { until: now + 480, x: fish.x + (dx < 0 ? 40 : -40), y: fish.y + (dy < 0 ? 22 : -22) };
      }
    }
    const approaching = seeking && fish.approach && fish.approach === jig && lure === jig.lure
      && Math.abs(eye.y - jig.eye.y) <= verticalReach && Math.abs(dy) <= verticalReach * 1.35;
    if (!approaching) fish.approach = undefined;
    const away = !approaching && now < fish.away?.until ? fish.away : undefined;
    const amplitude = reducedMotion ? .40 : 1;
    const path = {
      x: centerX + width * .115 * amplitude * Math.sin(t * (1.02 + slot * .09) * (slot === 2 ? -1 : 1)),
      y: centerY + Math.min(42, band.height * .085) * amplitude * Math.sin(t * (1.57 + slot * .13)),
    };
    const next = approaching ? eye : away ?? path;
    const distance = Math.hypot(next.x - fish.x, next.y - fish.y);
    const speed = approaching ? Math.max(.17, Math.min(.32, width * .00032))
      : away ? .13 : Math.max(.085, width * .00021);
    const amount = distance ? Math.min(1, speed * elapsed / distance) : 1;
    const oldX = fish.x;
    fish.x += (next.x - fish.x) * amount;
    fish.y += (next.y - fish.y) * amount;
    if (Math.abs(fish.x - oldX) > .01) fish.right = fish.x > oldX;
    if (approaching && amount === 1 && (!first || distance < first.distance)) {
      first = { slot, candidate, band, distance };
    }
    return [{ slot, x: fish.x, y: fish.y, right: fish.right, mood: approaching ? 'approach' : away ? 'away' : null,
      near: Math.abs(eye.x - fish.x) <= reach && Math.abs(eye.y - fish.y) <= verticalReach,
    }];
  });
  if (first) {
    saved.active = first.slot;
    const depth = bands.findIndex(band => band.height && eye.y >= band.top && eye.y <= band.top + band.height);
    const band = bands[depth] ?? first.band;
    run.encounters[run.index] = { ...first.candidate, depth: depth < 0 ? first.candidate.depth : depth,
      y: Math.min(100, Math.max(0, (eye.y - band.top) / band.height * 100)) };
    if (!run.committed) {
      run.committed = true;
      run.seekUntil = seekDeadline(run, now);
    }
    run.waterJig = undefined;
    startBite(run, now);
    run.version++;
  }
  return { fish, contact: Boolean(first), slot: first?.slot };
}
export function moveToHole(run, hole, now, elapsedMs = 0) {
  if (!run.holes || !hole?.id || !Object.hasOwn(campaignAreas, hole.area) || !Number.isFinite(hole.depthFt)) throw Error('Choose a valid Campaign hole.');
  if (run.committed || !['seek'].includes(run.stage)) throw Error('End the current attempt before moving.');
  if (now >= run.expires) throw Error('This outing expired.');
  const holeId = hole.id;
  run.campaign.holeId = holeId;
  run.campaign.hole = structuredClone(hole);
  run.campaign.area = hole.area;
  run.holes[holeId] ??= { candidates: [], generation: 0 };
  prepareHoleFish(run, elapsedMs);
  run.seekUntil = null;
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
  run.cue = run.stage === 'done' ? 'Outing complete.' : 'Attempt ended. Jig near another fish.';
  run.version++;
  return publicRun(run);
}
