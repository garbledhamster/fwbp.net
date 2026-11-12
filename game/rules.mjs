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
  { speciesId: 'perch', habitat: 'Weed edge', clue: 'Look for yellow perch along weed edges in 10–15 ft. Try a jig near the weeds on Starter Shore.' },
  { speciesId: 'pike', habitat: 'Weed edge', clue: 'Look for northern pike along weed edges in 10–15 ft. Try a spoon where pike can hide in the weeds.' },
  { speciesId: 'walleye', habitat: 'Reef edge', area: 'deep-reef', clue: 'Look for walleye along reef edges around 25 ft. Try a minnow on Mille Lacs, especially toward dusk.' },
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
  if (run.campaign.anglerRanks) {
    const ranks = run.biteRanks ?? run.campaign.anglerRanks;
    const window = { from: 520, until: 2920 + 180 * ranks.hook + (run.campaign.paidHookTimingMs ?? 0), buffer: 220 };
    for (const item of [hook, line, ...(run.campaign.baits ?? [])]) {
      if (fish && item?.lure === fish.lure) window.until += item.windowMs ?? 0;
    }
    return window;
  }
  const window = reelWindow({ ...run.skills, control: lineControlRank, quick: run.campaign.lureWorkRank ?? 0 });
  window.from -= run.campaign.hookEarlyMs ?? 0;
  window.until += run.campaign.hookLateMs ?? 0;
  if (run.campaign.tutorial) window.until += 3000;
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
export const lineBalanceLimits = Object.freeze({ low: 1.1, high: 4.8 });
const { low: restingLoad, high: tightLoad } = lineBalanceLimits;

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
    ...(run.campaign?.tutorial && { tutorialTug: true }),
  };
  run.stage = 'fight';
  run.last = now;
  if (run.fight.tutorialTug) sampleFight(run);
}

function sampleFight(run) {
  const fight = run.fight;
  const phase = fight.elapsed % surgeCycleMs;
  const surge = Math.max(0, Math.min(phase / 600, 1, (1800 - phase) / 700));
  const roomToRun = Math.min(1, fight.remaining / reelLength);
  fight.y = (fight.tutorialTug ? fight.pull + 1.6 : fight.pull * surge) * roomToRun;
  fight.distance = fight.remaining + fight.y;
  fight.x = Math.sin(phase * 2 * Math.PI / surgeCycleMs) * (fight.pull / 2.8) * roomToRun;
  fight.slack = Math.max(0, fight.paidOut - fight.distance);
  fight.tension = Math.round(Math.max(0, restingLoad + (fight.distance - fight.paidOut) * 2) * 10) / 10;
  fight.tight = fight.tension >= tightLoad;
  fight.pullUp = fight.remaining === 0;
  if (fight.tension > fight.lineStrength) {
    if (run.campaign?.tutorial) {
      const encounter = run.encounters[run.index];
      startLineFight(run, lakes[run.lake].fish[encounter.species], encounter, fight.hookedAt + fight.elapsed);
      run.reaction = 'snapped';
      return;
    }
    run.snap = { tension: fight.tension, lineStrength: fight.lineStrength };
    miss(run, 'snapped');
    run.cue = `Line snapped at ${fight.tension} lb on ${fight.lineStrength} lb line.`;
  }
}

// Advance through the same samples even if the browser misses a frame.
export function advanceLineFight(run, now) {
  if ((!run.campaign && !run.practice) || run.stage !== 'fight') return false;
  const fight = run.fight;
  const elapsed = Math.floor((Math.min(now, run.expires) - fight.hookedAt) / fightStepMs) * fightStepMs;
  let changed = false;
  while (run.fight === fight && fight.elapsed < elapsed) {
    fight.elapsed += fightStepMs;
    if (run.campaign?.anglerRanks) {
      if (stepCampaignFight(fight, fightStepMs)) {
        const encounter = run.encounters[run.index];
        land(run, lakes[run.lake].fish[encounter.species]);
      } else if (campaignFishEscapes(fight, run.campaignReelRandom)) {
        const saved = run.holes?.[run.campaign.holeId];
        const hooked = saved?.candidates[saved.active];
        if (hooked?.motion) hooked.motion.fled = true;
        miss(run, 'escaped');
        run.cue = run.stage === 'done' ? 'The fish got away. Outing complete.' : 'The fish got away.';
      }
    } else sampleFight(run);
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

export function lineEffort(effort) {
  return Number.isFinite(effort) ? Math.min(1.5, Math.max(.75, effort)) : 1;
}

function moveLineFight(run, action, target, reelEffort) {
  const fight = run.fight;
  const stroke = reelLength * (run.campaign ? lineEffort(reelEffort) : 1);
  if (action === 'loosen') {
    const room = Math.max(0, fight.distance + reelLength - fight.paidOut);
    fight.paidOut += Math.min(room, stroke);
    if (fight.tutorialTug) {
      fight.tutorialTug = false;
      run.reaction = null;
    }
  } else if (action === 'lift') {
    if (!fight.pullUp) throw Error('Reel the fish to the ice hole first.');
    if (fight.tight) throw Error('Loosen the line before pulling up.');
    land(run, target);
    return;
  } else if (run.campaign) {
    fight.paidOut = Math.max(0, fight.paidOut - stroke);
    if (!fight.tight) {
      const engaged = Math.max(0, stroke - fight.slack);
      // Winding line under resistance raises the fish less, leaving more load on the line.
      const fishDrag = Math.max(0, fight.pull - .6) * .12;
      const lineDrag = Math.max(0, (fight.tension - restingLoad) / (tightLoad - restingLoad)) * .34;
      const travel = engaged * (1 - fishDrag) * (1 - lineDrag);
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

function rollEncounter(random) {
  return { speciesRoll: random(), horizontalRoll: random(), verticalRoll: random(), sizeRoll: random(), colorRoll: random() };
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
      const { speciesRoll, horizontalRoll, verticalRoll, sizeRoll, colorRoll } = rollEncounter(random);
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
        y: 28 + Math.round(verticalRoll * 38),
        sizeRoll, colorRoll,
      };
    }),
    expires: now + runLifetime, last: now - 300, index: 0, score: 0, discoveries: [],
    stage: 'seek', biteAt: 0, catch: null, cue: 'Fish in view. Pick a lure and jig.',
    version: 0, submitted: false,
    ...(practice && { practice: true, landed: 0 }),
    ...(usesLineFight && { snap: null, wrongLures: 0, reaction: null }),
    ...(campaign?.anglerRanks && { campaignReelRandom: random }),
    ...(campaign && {
      campaign: { ...campaign, area, line: campaign.line && { ...campaign.line }, hook: campaign.hook && { ...campaign.hook }, baits: campaign.baits?.map(item => ({ ...item })), lineStrength: campaign.lineStrength ?? starterLineStrength },
    }),
  };
  if (campaign?.hole) {
    run.holes = {};
    run.holeSeed = structuredClone(run.encounters);
    run.committed = false;
    moveToHole(run, campaign.hole, now, campaign.elapsedMs, campaign.roster);
    return run;
  }
  chooseOutingSpecies(run, campaign?.elapsedMs);
  run.seekUntil = seekDeadline(run, now);
  return run;
}

export function startTutorial(now) {
  return start(now, () => .5, 'mille-lacs', {
    campaign: {
      tutorial: true,
      hole: { id: 'tutorial', area: starterArea, depthFt: 10, habitat: 'Weed edge' },
      roster: [{ key: 'tutorial:perch', speciesId: 'perch', lane: 1, sizeRoll: .4, colorRoll: 0 }],
    },
  });
}

export function publicRun(run) {
  const encounter = run.encounters[run.index];
  const target = run.stage !== 'missed' && (!run.holes || run.stage !== 'seek')
    && encounter && lakes[run.lake].fish[encounter.species];
  const xp = (run.landed ?? (run.index + Number(run.stage === 'landed'))) * practiceCatchXp;
  return {
    fish: target ? {
      id: target.id, art: target.art, depth: encounter.depth ?? searchDepths[run.index], x: encounter.x, y: encounter.y,
      gilded: encounter.colorRoll >= .97, ...(run.campaign?.anglerRanks && { specimen: encounter.specimen ?? campaignSpecimen(target, encounter) }),
    } : null,
    lake: lakes[run.lake].name, skills: run.skills, skillPoints: run.skillPoints, fight: run.fight, window: hookWindow(run, target),
    index: run.index, count: run.encounters.length, score: run.score, stage: run.stage,
    version: run.version, discoveries: run.discoveries, catch: run.catch, cue: run.cue,
    seekUntil: run.stage === 'seek' ? run.seekUntil ?? null : null,
    submitted: run.submitted,
    ...(run.practice && { practice: { xp, level: xp >= practiceLevelXp ? 2 : 1 } }),
    ...(run.campaign && { area: campaignAreas[run.campaign.area].name }),
    ...(run.holes && {
      hole: run.campaign.hole, committed: run.committed,
      activeFishKey: run.holes[run.campaign.holeId].candidates[run.holes[run.campaign.holeId].active]?.key,
      candidates: run.holes[run.campaign.holeId].candidates.flatMap((fish, slot) => fish.motion?.flee || fish.motion?.fled ? [] : [{
        ...lakes[run.lake].fish[fish.species], key: fish.key, slot, depth: fish.depth, x: fish.x, y: fish.y, ...(fish.specimen && { specimen: { ...fish.specimen } }),
      }]),
    }),
    ...((run.campaign || run.practice) && {
      lineStrength: run.campaign?.lineStrength ?? starterLineStrength,
      snap: run.snap, fight: run.fight && { ...run.fight },
      wrongLures: run.wrongLures, reaction: run.reaction,
    }),
  };
}

export function apply(run, input, now, { campaignElapsedMs = run.campaign?.elapsedMs, reelEffort, depthPx } = {}) {
  if (!input || Object.keys(input).some(key => !['action', 'lure', 'skill'].includes(key))) throw Error('Invalid action.');
  if (now >= run.expires) throw Error('This outing expired.');
  const jig = input.action === 'jig' && run.stage === 'seek' && Object.hasOwn(lures, input.lure);
  if (jig && run.holes && !run.holes[run.campaign.holeId].candidates.some(fish => !fish.motion?.flee && !fish.motion?.fled)) throw Error('This hole is quiet for today.');
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
  const tapCampaign = Boolean(run.campaign?.anglerRanks);
  const paced = input.action === 'jig' || (!tapCampaign && (['lift', 'loosen'].includes(input.action) || (lineFight && input.action === 'reel')));
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
  } else if (input.action === 'reel' && tapCampaign && run.stage === 'bite') {
    const elapsed = now - run.biteAt;
    const { from, until, buffer } = hookWindow(run, target);
    if (elapsed >= from && elapsed <= until) hookCampaignFish(run, target, encounter, now, depthPx);
    else if (elapsed >= from - buffer && elapsed < from) run.hookPending = true;
    else if (elapsed > until) missCampaignHook(run, now);
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
  } else if (lineFight && tapCampaign && input.action === 'reel') {
    tapCampaignReel(run.fight, now, run.campaignReelRandom());
  } else if (lineFight && tapCampaign) {
    throw Error('That action is unavailable.');
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
    const landed = run.stage === 'landed';
    if (run.practice) {
      run.landed ??= run.index + Number(run.stage === 'landed');
      run.skillPoints = 0;
    }
    run.index++;
    if (tapCampaign) delete run.biteRanks;
    run.catch = null;
    if (run.campaign || run.practice) {
      run.snap = null;
      run.wrongLures = 0;
      run.reaction = null;
      run.last = now - moveIntervalMs;
    }
    run.stage = run.index === run.encounters.length ? 'done' : 'seek';
    if (run.holes) {
      releaseHoleFish(run, landed);
      run.committed = false;
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

function hookCampaignFish(run, target, encounter, now, depthPx) {
  const specimen = encounter.specimen ?? campaignSpecimen(target, encounter);
  const gilded = encounter.colorRoll >= .97;
  const points = target.points + (specimen.grade === 'Record' ? 60 : specimen.grade === 'Trophy' ? 20 : 0) + (gilded ? 30 : 0);
  const { hook, line, lineStrength } = run.campaign;
  run.catch = {
    ...specimen, speciesId: target.id, name: target.name, rarity: target.rarity, points, lure: target.lure, gilded,
    hook: { id: hook?.id ?? 'starter-hook', name: hook?.name ?? 'Standard hooks' },
    line: { id: line?.id ?? 'starter-line', name: line?.name ?? 'Starter line' },
    ...(encounter.key && { fishKey: encounter.key }),
  };
  const depth = Math.max(12, Number.isFinite(depthPx) ? depthPx : 132 * (encounter.depth + 1 + encounter.y / 100));
  run.fight = startCampaignFight(specimen, run.biteRanks, depth, now, lineStrength, encounter.facing);
  run.hookPending = false;
  run.stage = 'fight';
  run.last = now;
  run.cue = 'Keep jigging! Tap fast to reel.';
}

function missCampaignHook(run, now) {
  run.stage = 'seek';
  run.hookPending = false;
  run.reaction = 'slipped-hook';
  run.cue = 'It slipped the hook. Jig again to bring it back.';
  if (seekExpired(run, now)) miss(run);
}

export function advanceCampaignBite(run, now, { depthPx } = {}) {
  if (!run.campaign?.anglerRanks || run.stage !== 'bite') return false;
  const encounter = run.encounters[run.index];
  const target = lakes[run.lake].fish[encounter.species];
  const elapsed = now - run.biteAt;
  const { from, until } = hookWindow(run, target);
  if (now >= run.expires) {
    run.stage = 'done';
    run.hookPending = false;
    run.cue = 'This outing expired.';
  } else if (run.hookPending && elapsed >= from) {
    hookCampaignFish(run, target, encounter, run.biteAt + from, depthPx);
  } else if (elapsed > until) {
    missCampaignHook(run, now);
  } else return false;
  run.version++;
  return true;
}

function startBite(run, now) {
  if (run.campaign || run.practice) run.reaction = null;
  run.stage = 'bite';
  run.biteAt = now;
  if (run.campaign?.anglerRanks) {
    run.hookPending = false;
    run.biteRanks = { ...run.campaign.anglerRanks };
    run.cue = 'Watch for the hook cue.';
  } else run.cue = 'Yeah, reel it! Wait for the marker to reach the gold band.';
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

function buildHoleRoster(lake, hole, elapsedMs, seeds, goalId) {
  const pool = encounterPool(lake, campaignPhase(elapsedMs), hole.area, hole);
  const salt = hole.area === starterArea ? 0 : (hole.id.charCodeAt(0) * 7 + Number(hole.id[1]) * 11) / 101;
  const roster = seeds.slice(0, 3).map(({ speciesRoll, sizeRoll, colorRoll }, lane) => {
    const roll = (speciesRoll + salt + lane / 3) % 1;
    return { key: `${hole.id}:0:${lane}`, lane, sizeRoll, colorRoll, speciesId: lakes[lake].fish[pool[Math.floor(roll * pool.length)]].id };
  });
  const goal = campaignGoals.find(goal => goal.speciesId === goalId && (goal.area ?? starterArea) === hole.area && goal.habitat === hole.habitat);
  if (goal && !roster.some(fish => fish.speciesId === goal.speciesId)) {
    roster.at(-1).speciesId = goal.speciesId;
  }
  return roster;
}

export function createCampaignRoster(hole, elapsedMs, random = Math.random, goalId) {
  const seeds = Array.from({ length: 3 }, () => rollEncounter(random));
  return buildHoleRoster('mille-lacs', hole, elapsedMs, seeds, goalId);
}

function releaseHoleFish(run, landed = false) {
  const saved = run.holes[run.campaign.holeId];
  if (landed && saved.active !== undefined) saved.candidates.splice(saved.active, 1);
  saved.active = undefined;
  run.waterJig = undefined;
}

// The renderer and line share lake-relative CSS pixels. Each swimmer's point
// is its mouth, so contact uses the same position as the visible lure eye.
export function stepCampaignFish(run, now, { width, bands, lure, eye, reducedMotion = false }) {
  const saved = run.holes[run.campaign.holeId];
  const swimming = saved.swimming ??= { time: 0 };
  const elapsed = Math.min(64, Math.max(0, now - (swimming.last ?? now)));
  swimming.time += elapsed / 1000;
  const t = swimming.time;
  swimming.last = now;
  const jig = run.waterJig;
  const newJig = jig && !jig.eye;
  if (newJig) jig.eye = { ...eye };
  const seeking = run.stage === 'seek' && now < run.expires && !seekExpired(run, now);
  // Let the jig reach the far end of the wider patrol. Keep chase time
  // comparable across desktop widths.
  const horizontalScale = Math.max(1, width / 1200);
  const reach = width * .55;
  let first;
  let spooked = false;
  const departed = [];
  const fish = saved.candidates.flatMap((candidate, slot) => {
    if (slot === saved.active && run.stage !== 'seek') return [];
    const band = bands[candidate.depth];
    if (!band?.height) return [];
    const centerX = width * candidate.x / 100;
    const centerY = band.top + band.height * candidate.y / 100;
    const verticalReach = Math.max(64, Math.min(98, band.height * .18));
    const lane = candidate.lane;
    const fish = candidate.motion ??= { x: centerX, y: centerY, right: lane !== 2, turn: lane === 2 ? 0 : 1 };
    if (fish.fled) return [];
    const dx = eye.x - fish.x;
    const dy = eye.y - fish.y;
    const species = lakes[run.lake].fish[candidate.species];
    if (!fish.flee && newJig && seeking && lure === jig.lure && Math.abs(dx) <= reach && Math.abs(dy) <= verticalReach) {
      const likesLure = species.lure === lure;
      if (likesLure && (saved.active === undefined || saved.active === slot)) {
        fish.approach = jig;
        fish.away = undefined;
        fish.wrongJigs = 0;
      } else if (!likesLure) {
        fish.approach = undefined;
        fish.away = { until: now + 480, x: fish.x + (dx < 0 ? 40 : -40), y: fish.y + (dy < 0 ? 22 : -22) };
        if (run.campaign.anglerRanks) {
          fish.wrongJigs = (fish.wrongJigs ?? 0) + 1;
          if (fish.wrongJigs >= (species.rarity === 'Rare' ? 2 : 3)) {
            fish.flee = { x: dx < 0 ? width + 160 : -160, y: fish.away.y };
            spooked = true;
          }
        }
      }
    }
    const approaching = seeking && fish.approach && fish.approach === jig && lure === jig.lure
      && Math.abs(eye.y - jig.eye.y) <= verticalReach && Math.abs(dy) <= verticalReach * 1.35;
    if (!approaching) fish.approach = undefined;
    const away = !approaching && now < fish.away?.until ? fish.away : undefined;
    const amplitude = reducedMotion ? .40 : 1;
    const path = {
      x: centerX + width * .18 * amplitude * Math.sin(t * (.82 + lane * .07) * (lane === 2 ? -1 : 1)),
      y: centerY + Math.min(42, band.height * .085) * amplitude * Math.sin(t * (1.32 + lane * .13)),
    };
    const next = fish.flee ?? (approaching ? eye : away ?? path);
    const distance = Math.hypot((next.x - fish.x) / horizontalScale, next.y - fish.y);
    const speed = fish.flee ? Math.max(.52, width * .0012)
      : approaching ? Math.max(.17, Math.min(.32, width * .00032))
      : away ? .13 : Math.max(.085, width * .00021);
    // Ease between cruising, chasing and backing away. Cap the step at the
    // destination so the fish cannot overshoot the lure.
    fish.speed ??= speed;
    fish.speed += (speed - fish.speed) * (1 - Math.exp(-elapsed / 105));
    const amount = distance ? Math.min(1, fish.speed * elapsed / distance) : 1;
    const oldX = fish.x;
    fish.x += (next.x - fish.x) * amount;
    fish.y += (next.y - fish.y) * amount;
    if (Math.abs(fish.x - oldX) > .1) fish.right = fish.x > oldX;
    const turnTarget = Number(fish.right);
    const turnStep = elapsed / 360;
    fish.turn = Math.max(fish.turn - turnStep, Math.min(fish.turn + turnStep, turnTarget));
    if (fish.flee && amount === 1) {
      fish.fled = true;
      departed.push(slot);
      return [];
    }
    if (approaching && amount === 1 && fish.turn === turnTarget && (!first || distance < first.distance)) {
      first = { slot, candidate, band, distance };
    }
    return [{ slot, x: fish.x, y: fish.y, right: fish.right, facing: Math.cos(fish.turn * Math.PI),
      mood: fish.flee ? 'flee' : approaching ? 'approach' : away ? 'away' : null,
      near: !fish.flee && Math.abs(eye.x - fish.x) <= reach && Math.abs(eye.y - fish.y) <= verticalReach,
    }];
  });
  if (first) {
    saved.active = first.slot;
    const depth = bands.findIndex(band => band.height && eye.y >= band.top && eye.y <= band.top + band.height);
    const band = bands[depth] ?? first.band;
    const { motion, ...encounter } = first.candidate;
    run.encounters[run.index] = { ...encounter, depth: depth < 0 ? first.candidate.depth : depth,
      ...(run.campaign.anglerRanks && { facing: Math.cos(motion.turn * Math.PI) }),
      y: Math.min(100, Math.max(0, (eye.y - band.top) / band.height * 100)) };
    if (!run.committed) {
      run.committed = true;
      if (!run.campaign.tutorial) run.seekUntil = seekDeadline(run, now);
    }
    run.waterJig = undefined;
    startBite(run, now);
    run.version++;
  }
  if (spooked && !first) run.reaction = 'spooked';
  return { fish, contact: Boolean(first), slot: first?.slot, spooked, departed };
}
export function moveToHole(run, hole, now, elapsedMs = 0, roster) {
  if (!run.holes || !hole?.id || !Object.hasOwn(campaignAreas, hole.area) || !Number.isFinite(hole.depthFt)) throw Error('Choose a valid Campaign hole.');
  if (run.committed || !['seek'].includes(run.stage)) throw Error('End the current attempt before moving.');
  if (now >= run.expires) throw Error('This outing expired.');
  const holeId = hole.id;
  run.campaign.holeId = holeId;
  run.campaign.hole = structuredClone(hole);
  run.campaign.area = hole.area;
  const saved = run.holes[holeId];
  if (!saved) {
    const fish = roster ?? buildHoleRoster(run.lake, hole, elapsedMs, run.holeSeed, run.campaign.goalId);
    const deepest = campaignDepthBand(hole.depthFt);
    run.holes[holeId] = { candidates: fish.map(({ speciesId, lane, ...candidate }) => {
      const species = lakes[run.lake].fish.findIndex(entry => entry.id === speciesId);
      const specimen = run.campaign.anglerRanks && campaignSpecimen(lakes[run.lake].fish[species], candidate);
      const trophy = specimen && specimen.grade !== 'Standard';
      return {
        ...candidate, lane, species, ...(specimen && { specimen }),
        depth: trophy ? deepest : Math.max(0, deepest - lane),
        x: [27, 50, 73][lane], y: trophy ? 65 + lane * 5 : 35 + lane * 10,
      };
    }) };
  } else {
    if (roster) saved.candidates = saved.candidates.filter(fish => roster.some(entry => entry.key === fish.key));
    if (saved.swimming) saved.swimming.last = now;
  }
  run.waterJig = undefined;
  run.seekUntil = null;
  if (run.reaction === 'spooked') run.reaction = null;
  run.version++;
  return publicRun(run);
}
export function abandonHoleFish(run, now) {
  if (!run.holes || !run.committed || !['seek', 'bite', 'fight'].includes(run.stage)) throw Error('No committed attempt to end.');
  releaseHoleFish(run);
  run.index++;
  run.committed = false;
  run.stage = run.index === run.encounters.length ? 'done' : 'seek';
  run.fight = run.catch = run.seekUntil = run.snap = run.reaction = null;
  run.wrongLures = 0;
  run.last = now - moveIntervalMs;
  run.cue = run.stage === 'done' ? 'Outing complete.' : 'Attempt ended. Jig near another fish.';
  run.version++;
  return publicRun(run);
}

export const anglerSkillLimits = Object.freeze({ line: 5, rhythm: 3, hook: 3 });
export const anglerSkills = Object.freeze({ line: 'Line control', rhythm: 'Reel rhythm', hook: 'Hook timing' });

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const tapBoost = .24;

function campaignMaxPayout(fight) {
  return fight.startDepth + (fight.trophy ? 135 : 90);
}

function campaignFishEscapes(fight, random) {
  const idleMs = fight.hookedAt + fight.elapsed - (fight.lastTap ?? fight.hookedAt);
  if (idleMs < 3500 || fight.remaining < campaignMaxPayout(fight) - 1) return false;
  if (idleMs >= 8000) return true;
  if (fight.elapsed < (fight.nextEscapeCheck ?? 0)) return false;
  fight.nextEscapeCheck = fight.elapsed + 1000;
  return random() < .35;
}

// Ranges for Campaign specimens. Ranked and Practice keep their own size and score rules.
const specimenRanges = {
  perch: { length: [7.5, 12], age: [3, 8], offense: [8, 18], rating: 1 },
  'rock-bass': { length: [8, 11], age: [4, 7], offense: [12, 23], rating: 1.15 },
  walleye: { length: [17, 30], age: [5, 11], offense: [19, 34], rating: 1.45 },
  pike: { length: [20, 44], age: [4, 15], offense: [21, 38], rating: 1.6 },
  smallmouth: { length: [10, 21], age: [4, 10], offense: [18, 31], rating: 1.35 },
  muskie: { length: [30, 55], age: [6, 18], offense: [24, 45], rating: 1.8 },
};

function campaignSpecimen(fish, encounter) {
  const { length: [min, max], age: [young, old], offense: [low, high], rating } = specimenRanges[fish.id];
  const size = clamp(encounter.sizeRoll ?? 0, 0, 1);
  const trophyAt = .86;
  const trophySize = fish.size[2];
  const upper = size >= trophyAt;
  const position = upper ? (size - trophyAt) / (1 - trophyAt) : (size / trophyAt) ** 2;
  const roundedLength = Math.round((upper ? trophySize + position * (max - trophySize)
    : min + position * (trophySize - .25 - min)) * 4) / 4;
  const length = fish.size[3] && size >= .995 ? fish.size[3] : roundedLength;
  const grade = length === fish.size[3] ? 'Record' : upper ? 'Trophy' : 'Standard';
  const age = upper ? old - Math.round((1 - position) * (old - young) / 3)
    : young + Math.floor(position * (old - young) / 2);
  const offense = upper ? high : low;
  const quality = length / 8 + .18 * (rating - 1) + .075 * (age - 3) + .016 * (offense - 8);
  return { length, age, offense, quality, grade, typeRating: rating };
}

export function campaignReelOdds(offense, lineRank) {
  const pressure = Math.max(0, offense - 8);
  return {
    hold: 40 + Math.round(pressure * .30) - 5 * lineRank,
    slip: 10 + Math.round(pressure * .15) - lineRank,
  };
}

function startCampaignFight(specimen, ranks, depth, now, lineStrength, facing) {
  const trophy = specimen.grade !== 'Standard';
  const power = Math.sqrt(specimen.quality);
  return {
    startDepth: depth, remaining: depth, distance: depth, paidOut: depth,
    lineStrength, hookedAt: now, elapsed: 0, x: 0, y: 0, heading: Math.PI / 2, facing: facing ?? 1,
    pull: power, slack: 0, tension: 1.1, tight: false, pullUp: false,
    feedback: 'reel', meterLevel: .81,
    rhythmRank: ranks.rhythm, odds: campaignReelOdds(specimen.offense, ranks.line), trophy,
    pace: .54, tapRate: clamp(1.2 + .9 * specimen.quality, 1.6, 3.2),
    payoutScale: Math.sqrt(starterLineStrength / Math.max(starterLineStrength, lineStrength)),
    lastTap: null, outcome: 'reel', lineToReel: 0,
  };
}

function tapCampaignReel(fight, now, roll) {
  const { hold, slip } = fight.odds;
  const percent = roll * 100;
  const outcome = percent < hold ? 'hold' : percent < hold + slip ? 'slip' : 'reel';
  fight.lastTap = now;
  fight.feedback = fight.outcome = outcome;
  fight.pace = Math.min(1, fight.pace + tapBoost);
  if (outcome === 'slip') fight.lineToReel = 0;
  if (outcome === 'reel') {
    const distance = (fight.trophy ? 30 : 72) / Math.min(1.5, fight.pull);
    const rhythm = Math.min(1, fight.pace / .60);
    fight.lineToReel = Math.min(distance * 2, fight.lineToReel + distance * (.35 + .65 * rhythm));
  }
  updateMeter(fight);
}

function updateMeter(fight) {
  fight.meterLevel = fight.feedback === 'hold' ? .46 : fight.feedback === 'slip' ? .15
    : fight.pace < .3 && fight.elapsed > 500 ? .21 : .62 + .36 * fight.pace;
}

// Returns true once both the line and the fish reach the ice hole.
function stepCampaignFight(fight, ms) {
  const dt = ms / 1000;
  const { elapsed, pull: power, trophy } = fight;
  const cycle = elapsed % 3300;
  const right = cycle < 1570;
  const burst = cycle - (right ? 240 : 1700);
  const surge = Math.min(clamp(burst / 150, 0, 1), clamp((720 - burst) / 480, 0, 1));
  const sinceTap = fight.lastTap === null ? Infinity : fight.hookedAt + elapsed - fight.lastTap;
  const beat = 1000 / fight.tapRate;
  const winding = clamp((beat + 20 + 35 * fight.rhythmRank - sinceTap) / 60, 0, 1);
  const holding = fight.outcome === 'hold' ? winding : 0;
  const reeling = fight.outcome === 'reel' && fight.lineToReel > 0 ? winding : 0;
  if (!winding) fight.lineToReel = 0;
  const reelSpeed = (trophy ? 80 : 144) * reeling * (1 - .34 * surge);
  const pulledIn = Math.min(fight.lineToReel, fight.remaining, reelSpeed * dt);
  fight.lineToReel -= pulledIn;
  fight.feedback = sinceTap < 380 ? fight.outcome : 'reel';
  // A slip pays out its own line. The idle run starts once the beat expires.
  const idlePull = (1 - winding) * (34 + 36 * surge);
  const divePull = surge * (trophy ? 20 : 9) * (1 - holding);
  const slipPull = fight.feedback === 'slip' ? 16 : 0;
  const runPayout = (idlePull * power + divePull * Math.min(power, 1.5)) * fight.payoutScale;
  const lineTaken = (runPayout + slipPull * Math.min(power, 1.5)) * dt;
  const maxDepth = campaignMaxPayout(fight);
  fight.remaining = clamp(fight.remaining + lineTaken - pulledIn, 0, maxDepth);

  const room = 1 - Math.max(reeling, holding) * .56;
  const lateral = (right ? 1 : -1) * Math.min(70, 62 * power) * surge * room;
  const dive = (8 + 90 * surge) * power * room;
  const blend = 1 - Math.exp(-ms / 82);
  const previousX = fight.x * 82;
  const previousDepth = fight.distance;
  const x = previousX + (lateral - previousX) * blend;
  const desiredDepth = Math.min(maxDepth, fight.remaining + dive);
  fight.distance = Math.max(previousDepth - (trophy ? 145 : 188) * dt,
    previousDepth + (desiredDepth - previousDepth) * blend);
  fight.paidOut = fight.remaining;
  fight.x = x / 82;
  fight.y = (fight.distance - fight.remaining) / 16;

  const runningFacing = right ? -1 : 1;
  const desiredFacing = reeling ? Math.abs(x) > 1 ? Math.sign(x) : -runningFacing : runningFacing;
  fight.facing += (desiredFacing - fight.facing) * (1 - Math.exp(-ms / 120));
  const dx = x - previousX;
  const dy = fight.distance - previousDepth;
  if (Math.hypot(dx, dy) >= .04) {
    const turn = Math.atan2(dy, dx) - fight.heading;
    fight.heading += Math.atan2(Math.sin(turn), Math.cos(turn)) * (1 - Math.exp(-ms / 85));
  }
  fight.tension = Math.min(fight.lineStrength, 1.1 + power * surge * (1 + .6 * reeling));
  fight.pace = Math.max(0, fight.pace - tapBoost * fight.tapRate * dt);
  updateMeter(fight);
  return reeling > 0 && fight.remaining <= 1 && fight.distance <= 18 && Math.abs(x) < 18;
}
