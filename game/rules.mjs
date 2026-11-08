export const lures = { jig: 'Jig', spoon: 'Spoon', minnow: 'Minnow' };
const milleLacs = [
  { id: 'perch', size: [5, 13, 11], name: 'Yellow perch', rarity: 'Common', points: 10, lure: 'jig', art: ['scenes', 'bi-perch', '0 0 172 66'], weight: 5 },
  { id: 'rock-bass', size: [5, 12, 10], name: 'Rock bass', rarity: 'Common', points: 15, lure: 'jig', art: ['fish', 'rock-bass', '0 0 160 92'], weight: 4 },
  { id: 'walleye', size: [12, 32, 28], name: 'Walleye', rarity: 'Uncommon', points: 25, lure: 'minnow', art: ['scenes', 'bi-walleye', '0 0 172 66'], weight: 3 },
  { id: 'pike', size: [18, 46, 39, 46.25], name: 'Northern pike', rarity: 'Uncommon', points: 35, lure: 'spoon', art: ['lake-life', 'pike', '0 0 230 72'], weight: 3 },
  { id: 'smallmouth', size: [8, 22, 19], name: 'Smallmouth bass', rarity: 'Uncommon', points: 30, lure: 'minnow', art: ['lake-life', 'bass', '0 0 172 80'], weight: 3 },
  { id: 'muskie', size: [24, 58, 50, 58.25], name: 'Muskie', rarity: 'Rare', points: 75, lure: 'spoon', art: ['fish', 'muskie', '0 0 245 72'], weight: 1 },
];
export const lakes = { 'mille-lacs': { name: 'Mille Lacs', fish: milleLacs } };
export const skills = { quick: 'Quick Bite', control: 'Line Control', lift: 'Lift' };

export function reelWindow(levels) {
  return { from: 550 - levels.quick * 125, until: 2100 + levels.control * 350 };
}
export const runLifetime = 20 * 60 * 1000;

export function start(now, random = Math.random, lake = 'mille-lacs') {
  const pool = lakes[lake].fish.flatMap((entry, index) => Array(entry.weight).fill(index));
  return {
    lake, skills: { quick: 0, control: 0, lift: 0 }, skillPoints: 0, lifts: 0,
    encounters: Array.from({ length: 6 }, () => ({
      species: pool[Math.floor(random() * pool.length)],
      x: 17 + Math.round(random() * 66),
      y: 28 + Math.round(random() * 38),
      sizeRoll: random(), colorRoll: random(),
    })),
    expires: now + runLifetime, last: now - 300, index: 0, score: 0, discoveries: [],
    stage: 'seek', biteAt: 0, catch: null, cue: 'Choose a lure and find a fish.',
    version: 0, submitted: false,
  };
}

export function publicRun(run) {
  const encounter = run.encounters[run.index];
  const target = encounter && lakes[run.lake].fish[encounter.species];
  return {
    fish: target ? { id: target.id, art: target.art, x: encounter.x, y: encounter.y, gilded: encounter.colorRoll >= .97 } : null,
    lake: lakes[run.lake].name, skills: run.skills, skillPoints: run.skillPoints, lifts: run.lifts, window: reelWindow(run.skills),
    index: run.index, count: run.encounters.length, score: run.score, stage: run.stage,
    version: run.version, discoveries: run.discoveries, catch: run.catch, cue: run.cue,
    submitted: run.submitted,
  };
}

export function apply(run, input, now) {
  if (!input || Object.keys(input).some(key => !['action', 'lure', 'skill'].includes(key))) throw Error('Invalid action.');
  if (now >= run.expires) throw Error('This outing expired.');
  const paced = input.action === 'jig' || input.action === 'lift';
  if (paced && now - run.last < 250) throw Error('Give the line a moment.');
  const encounter = run.encounters[run.index];
  const target = lakes[run.lake].fish[encounter?.species];
  if (input.action === 'jig' && run.stage === 'seek' && Object.hasOwn(lures, input.lure)) {
    if (input.lure === target.lure) {
      run.stage = 'bite';
      run.biteAt = now;
      run.cue = 'Bite! Reel when the marker reaches the gold band.';
    } else {
      run.cue = 'It turned to look. Try a different lure.';
    }
  } else if (input.action === 'reel' && run.stage === 'bite') {
    const elapsed = now - run.biteAt;
    const { from, until } = reelWindow(run.skills);
    if (elapsed >= from && elapsed <= until) {
      const [min, max, trophy, record] = target.size;
      const length = record && encounter.sizeRoll >= .995
        ? record : Math.round((min + encounter.sizeRoll ** 1.8 * (max - min)) * 4) / 4;
      const grade = length === record ? 'Record' : length >= trophy ? 'Trophy' : 'Standard';
      const gilded = encounter.colorRoll >= .97;
      const points = target.points + (grade === 'Record' ? 60 : grade === 'Trophy' ? 20 : 0) + (gilded ? 30 : 0);
      run.catch = { name: target.name, rarity: target.rarity, points, lure: target.lure, length, grade, gilded };
      run.lifts = length >= trophy ? Math.max(0, 2 - run.skills.lift) : 0;
      if (run.lifts) {
        run.stage = 'lift';
        run.cue = `Heavy fish! ${run.lifts} more pulls.`;
      } else {
        land(run, target);
      }
    } else {
      run.stage = 'seek';
      run.cue = 'It slipped the hook. Jig again to bring it back.';
    }
  } else if (input.action === 'lift' && run.stage === 'lift') {
    run.lifts--;
    if (run.lifts) run.cue = 'One more pull.';
    else land(run, target);
  } else if (input.action === 'upgrade' && run.stage === 'landed'
    && run.skillPoints > 0 && Object.hasOwn(skills, input.skill) && run.skills[input.skill] < 2) {
    run.skills[input.skill]++;
    run.skillPoints--;
    run.cue = `${skills[input.skill]} improved.`;
  } else if (input.action === 'next' && run.stage === 'landed') {
    run.index++;
    run.catch = null;
    run.stage = run.index === run.encounters.length ? 'done' : 'seek';
    run.cue = run.stage === 'done' ? 'Outing complete.' : 'Scroll down to find the next fish.';
  } else {
    throw Error('That action is unavailable.');
  }
  if (paced) run.last = now;
  run.version++;
  return publicRun(run);
}

function land(run, target) {
  const { length, rarity, points, grade, gilded } = run.catch;
  run.score += points;
  run.skillPoints++;
  if (!run.discoveries.some(entry => entry.fish === target.name)) {
    run.discoveries.push({ fish: target.name, lure: target.lure });
  }
  run.stage = 'landed';
  run.cue = `${target.name} · ${length} in · ${rarity}${grade === 'Standard' ? '' : ' · ' + grade}${gilded ? ' · Gilded' : ''} · +${points} points`;
}
