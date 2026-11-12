import { campaignGoals, createCampaignRoster, lakes } from './rules.mjs?v=campaign-ranks';
import lakeMap from './lake-map-data.mjs';

const speciesIds = new Set(lakes['mille-lacs'].fish.map(fish => fish.id));
export const shopItems = [
  { id: 'starter-line', category: 'line', name: 'Starter line', cost: 0, effect: '8 lb breaking strength; 100 ms more to set the hook with Jig.', strength: 8, lure: 'jig', windowMs: 100 },
  { id: 'stronger-line', category: 'line', name: 'Stronger line', cost: 10, level: 2, effect: '12 lb breaking strength.', strength: 12 },
  { id: 'starter-hook', category: 'hook', name: 'Standard hooks', cost: 0, effect: 'Stock hooks and standard timing. 44 px target.' },
  { id: 'finesse-hook', category: 'hook', name: 'Fine-wire jig setup', cost: 15, level: 2, effect: '56 px Jig target and 200 ms more to set Jig. Stock setup for other lures.', lure: 'jig', windowMs: 200, targetDiameter: 56 },
  { id: 'octopus-hook', category: 'hook', name: 'Octopus minnow setup', cost: 15, level: 2, effect: '200 ms more with Minnow; stock hooks and timing with Jig or Spoon.', lure: 'minnow', windowMs: 200 },
  { id: 'line-control', category: 'training', name: 'Line Control', cost: 20, effect: 'Rank 1 gives you 350 ms more to set the hook with any lure.', rank: 1 },
  { id: 'starter-license', category: 'license', name: 'Mille Lacs permit', cost: 0, effect: 'Free game access to every fishing spot on Mille Lacs.', area: 'starter-shore' },
  { id: 'pro-line', category: 'line', name: 'Pro line', cost: 100, level: 10, effect: '18 lb breaking strength.', strength: 18 },
  { id: 'pro-hook', category: 'hook', name: 'Pro jig setup', cost: 80, level: 10, effect: '68 px Jig target and 400 ms more to set Jig.', lure: 'jig', windowMs: 400, targetDiameter: 68 },
  { id: 'waxworm-bait', category: 'bait', name: 'Waxworm bait', cost: 15, level: 2, effect: 'Carry with Jig for 150 ms more to set the hook.', lure: 'jig', windowMs: 150 },
  { id: 'live-minnow', category: 'bait', name: 'Live minnow', cost: 75, level: 10, effect: 'Carry with Minnow for 250 ms more to set the hook.', lure: 'minnow', windowMs: 250 },
];

// XP is a projection of the existing, once-only Campaign payout ledger. Spending
// coins never spends XP, and old saves require no new award or replay marker.
export const campaignXpLevels = [0, 10, 40, 90, 160, 260, 400, 600, 850, 1200];
export const campaignSkillCap = 100;
export const campaignSkills = { lure: 'Lure Work', control: 'Line Control', drilling: 'Drilling' };
const legacyTechniques = {
  'line-control-1': ['control', 1],
  'line-control-2': ['control', 2],
  'lure-work-1': ['lure', 1],
  'lure-work-2': ['lure', 2],
  'drilling-1': ['drilling', 1],
};

export function campaignSkillRanks(profile) {
  const ranks = { lure: 0, control: 0, drilling: 0 };
  if (profile?.skillRanks) {
    for (const id of Object.keys(ranks)) {
      const rank = profile.skillRanks[id];
      if (Number.isSafeInteger(rank)) ranks[id] = Math.max(0, Math.min(campaignSkillCap, rank));
    }
    return ranks;
  }
  for (const id of new Set(Array.isArray(profile?.techniques) ? profile.techniques : [])) {
    const technique = Object.hasOwn(legacyTechniques, id) && legacyTechniques[id];
    if (technique) ranks[technique[0]] += technique[1];
  }
  return ranks;
}

export function campaignProgress(profile) {
  const xp = Object.values(profile?.awards ?? {}).reduce((sum, value) => sum + (Number.isSafeInteger(value) && value > 0 ? value : 0), 0);
  const level = campaignXpLevels.filter(required => xp >= required).length;
  const spent = Object.values(campaignSkillRanks(profile)).reduce((sum, rank) => sum + rank, 0);
  const earned = level - 1 + Math.floor(Math.max(0, xp - campaignXpLevels.at(-1)) / 100);
  return { xp, level, earned, points: Math.max(0, earned - spent), spent, nextXp: campaignXpLevels[level] ?? null };
}

export function campaignTraining(profile, ranks = campaignSkillRanks(profile)) {
  const control = ranks.control + Number(Boolean(profile?.owned?.includes('line-control')));
  return {
    hookEarlyMs: ranks.lure ? 125 + Math.min(2, ranks.lure - 1) * 65 + Math.floor(Math.max(0, ranks.lure - 3) * 45 / 97) : 0,
    hookLateMs: control ? 350 + Math.min(2, control - 1) * 175 + Math.min(100, Math.max(0, control - 3)) * 4 : 0,
    aimBonus: ranks.lure ? 2 + Math.floor(ranks.lure / 10) : 0,
    drillReduction: Math.floor(ranks.drilling / 20),
  };
}
export function shopAvailability(profile, item) {
  const level = item.level ?? 1;
  const owned = profile?.owned?.includes(item.id);
  const equipped = profile?.equipped?.[item.category] === item.id;
  const locked = !owned && campaignProgress(profile).level < level;
  const shortfall = Math.max(0, item.cost - (profile?.coins ?? 0));
  return { level, owned, equipped, locked, shortfall, status: owned ? equipped ? 'equipped' : 'owned' : locked ? 'locked' : shortfall ? 'unaffordable' : 'available' };
}

export function areaPermit() {
  return shopItems.find(item => item.id === 'starter-license');
}

export function hasAreaAccess(profile) {
  return Boolean(profile?.owned.includes(areaPermit().id));
}

// Each goal receipt is the catch key, in the same order as the goals. Old saves begin at the first.
export function campaignGoal(profile) {
  return campaignGoals[profile?.goalCatches?.length ?? 0];
}

// The payout ledger holds Campaign awards only; Practice collection credit lives separately.
export function campaignMilestone(profile) {
  const catches = Object.values(profile?.awards ?? {}).filter(value => Number.isSafeInteger(value) && value > 0).length;
  return {
    id: 'lake-regular', name: 'Lake Regular', catches, goal: 2, earned: catches >= 2,
    description: 'Land and save two Campaign catches. A badge with no tackle or coin bonus.',
  };
}

const storeName = 'profile';
const profileKey = 'campaign';
let database;

function starterProfile() {
  return {
    version: 1,
    revision: 0,
    coins: 0,
    owned: ['starter-line', 'starter-hook'],
    equipped: { line: 'starter-line', hook: 'starter-hook' },
    awards: {},
    catchLocations: {},
    elapsedMs: 0,
  };
}

function openDatabase() {
  database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('fwbp-campaign', 1);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const connection = request.result;
      connection.onversionchange = () => {
        connection.close();
        database = undefined;
      };
      resolve(connection);
    };
  }).catch(error => {
    database = undefined;
    throw error;
  });
  return database;
}

function collectionProfile(stored) {
  const profile = stored ?? starterProfile();
  // Additional fields need no IndexedDB version change. Preserve unrelated save fields.
  const caughtSpecies = [...new Set((Array.isArray(profile.caughtSpecies) ? profile.caughtSpecies : []).filter(id => speciesIds.has(id)))];
  const studiedSpecies = [...new Set((Array.isArray(profile.studiedSpecies) ? profile.studiedSpecies : []).filter(id => caughtSpecies.includes(id)))];
  const collectionAwards = profile.collectionAwards && typeof profile.collectionAwards === 'object'
    && !Array.isArray(profile.collectionAwards) ? profile.collectionAwards : {};
  const { day: savedDay } = profile;
  const refund = profile.owned.includes('deep-reef-license') && !profile.reefPermitRefunded;
  const migrateSkills = Array.isArray(profile.techniques) && !profile.skillRanks;
  // A saved day gains the extra slot when its roster storage is first added.
  const day = savedDay && !savedDay.rosters ? {
    ...savedDay,
    allowance: [1, 2].includes(savedDay.allowance) ? savedDay.allowance + 1 : savedDay.allowance,
    rosters: {},
  } : savedDay;
  const sameIds = (saved, normalized) => Array.isArray(saved)
    && saved.length === normalized.length && saved.every((id, index) => id === normalized[index]);
  if (profile.version >= 2 && sameIds(profile.caughtSpecies, caughtSpecies)
    && sameIds(profile.studiedSpecies, studiedSpecies) && collectionAwards === profile.collectionAwards
    && day === profile.day && !refund && !migrateSkills) return profile;
  return {
    ...profile,
    version: Math.max(2, profile.version ?? 1),
    revision: (profile.revision ?? 0) + (stored ? 1 : 0),
    caughtSpecies,
    studiedSpecies,
    collectionAwards,
    ...(day && { day }),
    ...(refund && { coins: profile.coins + 25, reefPermitRefunded: true }),
    ...(migrateSkills && { skillRanks: campaignSkillRanks(profile) }),
  };
}

async function readProfile(update) {
  const connection = await openDatabase();
  return new Promise((resolve, reject) => {
    // Reads also perform the once-only legacy migration under the same tab-safe lock.
    const transaction = connection.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.get(profileKey);
    let result, failure;
    request.onsuccess = () => {
      try {
        const profile = collectionProfile(request.result);
        result = update ? update(profile) : profile;
        const next = update ? result.profile : result;
        if (next !== request.result) store.put(next, profileKey);
      } catch (error) {
        failure = error;
        transaction.abort();
      }
    };
    transaction.oncomplete = () => resolve(result);
    transaction.onabort = () => reject(failure ?? transaction.error ?? new Error('The campaign save was interrupted.'));
  });
}

export function loadProfile() {
  return readProfile();
}

function award(profile, { key, outcome, catch: fish, speciesId, mode = 'campaign', dayId, cellId, fishKey }) {
  const points = fish?.points;
  const localMode = mode === 'campaign' || mode === 'practice';
  // An omitted species remains compatible with already-open older releases.
  const validSpecies = speciesIds.has(speciesId);
  if (!localMode || outcome !== 'landed' || typeof key !== 'string' || !/^.+:\d+$/.test(key)
    || (speciesId !== undefined && !validSpecies) || (mode === 'practice' && !validSpecies)
    || !Number.isSafeInteger(points) || points <= 0) {
    return { profile, status: 'no-award' };
  }
  // Old numeric payout keys cannot be replayed to invent collection history.
  if (Object.hasOwn(profile.awards, key) || Object.hasOwn(profile.collectionAwards, key)) {
    return { profile, status: 'duplicate-award' };
  }
  const hasLocation = mode === 'campaign' && (dayId !== undefined || cellId !== undefined || fishKey !== undefined);
  let remaining;
  if (hasLocation) {
    if (!validSpecies || typeof dayId !== 'string' || !dayId || typeof cellId !== 'string' || !cellId
      || typeof fishKey !== 'string' || !fishKey) return { profile, status: 'no-award' };
    const { day } = profile;
    if (day?.id !== dayId) return { profile, status: 'stale-day' };
    const roster = day.rosters[cellId];
    if (!day.opened.includes(cellId) || !Array.isArray(roster)) return { profile, status: 'no-award' };
    const entry = roster.find(entry => entry.key === fishKey);
    if (!entry) return { profile, status: 'hole-fish-gone' };
    if (entry.speciesId !== speciesId) return { profile, status: 'no-award' };
    remaining = roster.filter(entry => entry.key !== fishKey);
  }
  const goal = mode === 'campaign' && validSpecies ? campaignGoal(profile) : undefined;
  const completesGoal = Boolean(goal && goal.speciesId === speciesId);
  const earned = goal && !completesGoal ? Math.max(1, Math.floor(points / 2)) : points;
  if (mode === 'campaign' && !Number.isSafeInteger(profile.coins + earned)) return { profile, status: 'no-award' };
  const caughtSpecies = validSpecies && !profile.caughtSpecies.includes(speciesId)
    ? [...profile.caughtSpecies, speciesId] : profile.caughtSpecies;
  return {
    profile: {
      ...profile,
      revision: profile.revision + 1,
      coins: mode === 'campaign' ? profile.coins + earned : profile.coins,
      awards: mode === 'campaign' ? { ...profile.awards, [key]: earned } : profile.awards,
      collectionAwards: mode === 'practice' ? { ...profile.collectionAwards, [key]: speciesId } : profile.collectionAwards,
      caughtSpecies,
      ...(hasLocation && {
        day: { ...profile.day, rosters: { ...profile.day.rosters, [cellId]: remaining } },
        catchLocations: { ...profile.catchLocations, [key]: { cellId, speciesId } },
      }),
      ...(completesGoal && { goalCatches: [...(profile.goalCatches ?? []), key] }),
    },
    status: 'awarded',
    earned: mode === 'campaign' ? earned : 0,
    milestoneReached: mode === 'campaign' && campaignMilestone(profile).catches === 1,
  };
}

function study(profile, speciesId) {
  if (!speciesIds.has(speciesId)) return { profile, status: 'invalid' };
  if (!profile.caughtSpecies.includes(speciesId)) return { profile, status: 'not-caught' };
  if (profile.studiedSpecies.includes(speciesId)) return { profile, status: 'already-studied' };
  return {
    profile: { ...profile, revision: profile.revision + 1, studiedSpecies: [...profile.studiedSpecies, speciesId] },
    status: 'studied',
  };
}

function shop(profile, { type, id, revision }) {
  if (profile.revision !== revision) return { profile, status: 'stale' };
  const item = shopItems.find(item => item.id === id);
  if (!item) return { profile, status: 'invalid' };
  const owned = profile.owned.includes(id);
  if (type === 'buy') {
    if (owned) return { profile, status: 'already-owned' };
    if (shopAvailability(profile, item).locked) return { profile, status: 'locked' };
    if (profile.coins < item.cost) return { profile, status: 'unaffordable' };
    return {
      profile: { ...profile, revision: profile.revision + 1, coins: profile.coins - item.cost, owned: [...profile.owned, id] },
      status: 'bought',
    };
  }
  if (!Object.hasOwn(profile.equipped, item.category)) return { profile, status: 'invalid' };
  if (!owned) return { profile, status: 'not-owned' };
  if (profile.equipped[item.category] === id) return { profile, status: 'already-equipped' };
  return {
    profile: { ...profile, revision: profile.revision + 1, equipped: { ...profile.equipped, [item.category]: id } },
    status: 'equipped',
  };
}

function saveClock(profile, { elapsedMs, dayId }) {
  if (dayId !== undefined && profile.day?.id !== dayId) return { profile, status: 'stale-day' };
  if (!Number.isSafeInteger(elapsedMs) || elapsedMs < 0) return { profile, status: 'invalid' };
  if (elapsedMs <= profile.elapsedMs) return { profile, status: 'clock-current' };
  return { profile: { ...profile, elapsedMs }, status: 'clock-saved' };
}

function updateDay(profile, { type, dayId, cellId, elapsedMs }) {
  const { day } = profile;
  if (type === 'begin-day') {
    if (day) return { profile, status: 'day-current' };
    const allowance = campaignSkillRanks(profile).drilling ? 3 : 2;
    const { drillReduction } = campaignTraining(profile);
    return {
      profile: { ...profile, revision: profile.revision + 1, day: { id: crypto.randomUUID(), allowance, drillReduction, opened: [], rosters: {} } },
      status: 'day-started',
    };
  }
  if (!day || day.id !== dayId) return { profile, status: 'stale-day' };
  if (type === 'end-day') {
    const next = { ...profile, revision: profile.revision + 1 };
    delete next.day;
    return { profile: next, status: 'day-ended' };
  }
  const cell = lakeMap.cells.find(cell => cell.id === cellId);
  if (!cell) return { profile, status: 'invalid' };
  if (!hasAreaAccess(profile)) return { profile, status: 'permit-required' };
  const alreadyOpen = day.opened.includes(cellId);
  const roster = day.rosters[cellId];
  if (alreadyOpen && Array.isArray(roster)) return { profile, status: roster.length ? 'hole-current' : 'hole-quiet' };
  if (!alreadyOpen && day.opened.length >= day.allowance) return { profile, status: 'daily-limit' };
  const currentElapsed = Number.isSafeInteger(elapsedMs) && elapsedMs >= 0 ? elapsedMs : profile.elapsedMs;
  const goal = campaignGoal(profile);
  const newRoster = createCampaignRoster(cell, currentElapsed, undefined, goal?.speciesId);
  return {
    profile: {
      ...profile,
      revision: profile.revision + 1,
      day: {
        ...day,
        opened: alreadyOpen ? day.opened : [...day.opened, cellId],
        rosters: { ...day.rosters, [cellId]: newRoster },
      },
    },
    status: alreadyOpen ? 'hole-current' : 'hole-opened',
  };
}

function train(profile, { type, id, revision, betweenOutings }) {
  if (profile.revision !== revision) return { profile, status: 'stale' };
  if (!betweenOutings) return { profile, status: 'outing-active' };
  if (type === 'reset-skills') return { profile: { ...profile, revision: profile.revision + 1, skillRanks: {} }, status: 'reset' };
  if (!Object.hasOwn(campaignSkills, id)) return { profile, status: 'invalid' };
  const skillRanks = campaignSkillRanks(profile);
  if (skillRanks[id] >= campaignSkillCap) return { profile, status: 'capped' };
  if (!campaignProgress(profile).points) return { profile, status: 'unaffordable' };
  skillRanks[id]++;
  return { profile: { ...profile, revision: profile.revision + 1, skillRanks }, status: 'learned' };
}

export function applyProfile(command) {
  return readProfile(profile => {
    if (['learn', 'reset-skills'].includes(command?.type)) return train(profile, command);
    if (command?.type === 'clock') return saveClock(profile, command);
    if (['begin-day', 'open-hole', 'end-day'].includes(command?.type)) return updateDay(profile, command);
    if (command?.type === 'study') return study(profile, command.speciesId);
    if (command?.type === 'award') return award(profile, command);
    if (command?.type === 'buy' || command?.type === 'equip') return shop(profile, command);
    return { profile, status: 'invalid' };
  });
}
