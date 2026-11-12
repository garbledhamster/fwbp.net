import { anglerSkillLimits, campaignGoals, createCampaignRoster, lakes } from './rules.mjs?v=angler-1';
import lakeMap from './lake-map-data.mjs';
export { anglerSkillLimits, anglerSkills } from './rules.mjs?v=angler-1';

const speciesIds = new Set(lakes['mille-lacs'].fish.map(fish => fish.id));
export const shopItems = [
  { id: 'starter-line', category: 'line', name: 'Starter line', cost: 0, effect: '8 lb line. Adds 100 ms to set the hook with Jig.', strength: 8, lure: 'jig', windowMs: 100 },
  { id: 'stronger-line', category: 'line', name: 'Stronger line', cost: 10, level: 2, effect: '12 lb line. Fish take less line when they run.', strength: 12 },
  { id: 'starter-hook', category: 'hook', name: 'Standard hooks', cost: 0, effect: 'Standard hook timing with any lure.' },
  { id: 'finesse-hook', category: 'hook', name: 'Fine-wire jig setup', cost: 15, level: 2, effect: 'Adds 200 ms to set the hook with Jig. Standard timing with other lures.', lure: 'jig', windowMs: 200, targetDiameter: 56 },
  { id: 'octopus-hook', category: 'hook', name: 'Octopus minnow setup', cost: 15, level: 2, effect: '200 ms more with Minnow; stock hooks and timing with Jig or Spoon.', lure: 'minnow', windowMs: 200 },
  { id: 'line-control', category: 'training', name: 'Line Control', cost: 20, effect: 'Adds 350 ms to set the hook with any lure.', rank: 1 },
  { id: 'starter-license', category: 'license', name: 'Mille Lacs permit', cost: 0, effect: 'Free game access to every fishing spot on Mille Lacs.', area: 'starter-shore' },
  { id: 'pro-line', category: 'line', name: 'Pro line', cost: 100, level: 10, effect: '18 lb line. Fish take even less line when they run.', strength: 18 },
  { id: 'pro-hook', category: 'hook', name: 'Pro jig setup', cost: 80, level: 10, effect: 'Adds 400 ms to set the hook with Jig. Standard timing with other lures.', lure: 'jig', windowMs: 400, targetDiameter: 68 },
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

function legacyAngler(profile) {
  const { control, lure } = campaignSkillRanks(profile);
  const { earned, spent } = campaignProgress(profile);
  // Catch receipts already carry one point each. Save only the difference
  // needed to preserve the old XP bank and refund ranks with no new equivalent.
  return {
    bonus: Math.max(0, Math.max(earned, spent) - campaignMilestone(profile).catches),
    ranks: { line: control, rhythm: 0, hook: lure },
  };
}

export function anglerSkillRanks(profile) {
  const ranks = (profile?.angler ?? legacyAngler(profile)).ranks;
  return Object.fromEntries(Object.entries(anglerSkillLimits).map(([id, limit]) => {
    const value = ranks?.[id];
    return [id, Number.isSafeInteger(value) ? Math.max(0, Math.min(limit, value)) : 0];
  }));
}

export function anglerProgress(profile) {
  const { bonus } = profile?.angler ?? legacyAngler(profile);
  const earned = campaignMilestone(profile).catches + (Number.isSafeInteger(bonus) && bonus > 0 ? bonus : 0);
  const spent = Object.values(anglerSkillRanks(profile)).reduce((sum, rank) => sum + rank, 0);
  return { earned, spent, points: Math.max(0, earned - spent) };
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
  const angler = profile.angler ?? { ...legacyAngler(profile), ranks: anglerSkillRanks(profile) };
  // A saved day gains the extra slot when its roster storage is first added.
  const day = savedDay && !savedDay.rosters ? {
    ...savedDay,
    allowance: [1, 2].includes(savedDay.allowance) ? savedDay.allowance + 1 : savedDay.allowance,
    rosters: {},
  } : savedDay;
  const sameIds = (saved, normalized) => Array.isArray(saved)
    && saved.length === normalized.length && saved.every((id, index) => id === normalized[index]);
  if (profile.version >= 3 && sameIds(profile.caughtSpecies, caughtSpecies)
    && sameIds(profile.studiedSpecies, studiedSpecies) && collectionAwards === profile.collectionAwards
    && day === profile.day && angler === profile.angler && !refund && !migrateSkills) return profile;
  return {
    ...profile,
    version: Math.max(3, profile.version ?? 1),
    revision: (profile.revision ?? 0) + (stored ? 1 : 0),
    caughtSpecies,
    studiedSpecies,
    collectionAwards,
    angler,
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

const chicagoDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' });
const lakeQuest = { speciesId: 'perch', target: 2, coins: 15 };

export function dailyLakeQuest(profile, now = new Date()) {
  const day = chicagoDate.format(now);
  const saved = profile?.dailyQuest;
  const current = saved?.day === day ? saved : { day, count: 0, claimed: false };
  return { ...lakeQuest, ...current };
}

function award(profile, { key, outcome, catch: fish, speciesId, mode = 'campaign', dayId, cellId, fishKey }) {
  const points = fish?.points;
  const localMode = mode === 'campaign' || mode === 'practice';
  // An omitted species remains compatible with already-open older releases.
  const validSpecies = speciesIds.has(speciesId);
  const hasSpecimen = mode === 'campaign' && fish?.quality !== undefined;
  const validSpecimen = validSpecies && fish?.speciesId === speciesId && Number.isFinite(fish.quality) && fish.quality > 0
    && Number.isFinite(fish.length) && fish.length > 0 && Number.isSafeInteger(fish.age) && fish.age > 0
    && Number.isSafeInteger(fish.offense) && fish.offense > 0
    && ['Standard', 'Trophy', 'Record'].includes(fish.grade)
    && typeof fish.hook?.id === 'string' && typeof fish.hook?.name === 'string'
    && typeof fish.line?.id === 'string' && typeof fish.line?.name === 'string';
  if (!localMode || outcome !== 'landed' || typeof key !== 'string' || !/^.+:\d+$/.test(key)
    || (speciesId !== undefined && !validSpecies) || (mode === 'practice' && !validSpecies)
    || (hasSpecimen && !validSpecimen) || !Number.isSafeInteger(points) || points <= 0) {
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
  const discovery = validSpecies && !profile.caughtSpecies.includes(speciesId);
  const caughtSpecies = discovery ? [...profile.caughtSpecies, speciesId] : profile.caughtSpecies;
  const creditedCoins = mode === 'campaign' && !hasSpecimen ? earned : 0;
  if (!Number.isSafeInteger(profile.coins + creditedCoins)) return { profile, status: 'no-award' };
  const priorReward = profile.fishRewards?.[speciesId];
  const base = hasSpecimen ? Math.max(1, Math.round(fish.quality * 12)) : 0;
  const pendingCoins = base + (discovery ? Math.ceil(base / 2) : 0);
  const pendingTotal = (priorReward?.coins ?? 0) + pendingCoins;
  if (hasSpecimen && !Number.isSafeInteger(pendingTotal)) return { profile, status: 'no-award' };
  const quest = hasSpecimen ? dailyLakeQuest(profile) : undefined;
  const advancesQuest = quest && quest.speciesId === speciesId;
  const dailyQuest = advancesQuest ? { day: quest.day, count: Math.min(quest.count + 1, quest.target), claimed: quest.claimed } : undefined;
  return {
    profile: {
      ...profile,
      revision: profile.revision + 1,
      coins: profile.coins + creditedCoins,
      awards: mode === 'campaign' ? { ...profile.awards, [key]: earned } : profile.awards,
      collectionAwards: mode === 'practice' ? { ...profile.collectionAwards, [key]: speciesId } : profile.collectionAwards,
      caughtSpecies,
      ...(hasSpecimen && {
        landedFish: { ...profile.landedFish, [key]: structuredClone(fish) },
        fishRewards: {
          ...profile.fishRewards,
          [speciesId]: { coins: pendingTotal, discovery: discovery || priorReward?.discovery === true },
        },
      }),
      ...(dailyQuest && { dailyQuest }),
      ...(hasLocation && {
        day: { ...profile.day, rosters: { ...profile.day.rosters, [cellId]: remaining } },
        catchLocations: { ...profile.catchLocations, [key]: { cellId, speciesId } },
      }),
      ...(completesGoal && { goalCatches: [...(profile.goalCatches ?? []), key] }),
    },
    status: 'awarded',
    earned: mode === 'campaign' ? earned : 0,
    ...(hasSpecimen && { pendingCoins }),
    milestoneReached: mode === 'campaign' && campaignMilestone(profile).catches === 1,
  };
}

function claimLakeReward(profile, { type, speciesId }) {
  const quest = type === 'collect-quest' ? dailyLakeQuest(profile) : undefined;
  const fish = !quest && speciesIds.has(speciesId) ? profile.fishRewards?.[speciesId] : undefined;
  const coins = quest && quest.count === quest.target && !quest.claimed ? quest.coins : fish?.coins ?? 0;
  if (!Number.isSafeInteger(coins) || coins < 1) return { profile, status: 'nothing-to-claim' };
  if (!Number.isSafeInteger(profile.coins + coins)) return { profile, status: 'invalid' };
  const reward = quest
    ? { dailyQuest: { day: quest.day, count: quest.count, claimed: true } }
    : { fishRewards: { ...profile.fishRewards, [speciesId]: { coins: 0, discovery: false } } };
  return {
    profile: { ...profile, ...reward, revision: profile.revision + 1, coins: profile.coins + coins },
    status: 'claimed',
    coins,
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
    return {
      profile: { ...profile, revision: profile.revision + 1,
        day: { id: crypto.randomUUID(), allowance: 2, drillReduction: 0, opened: [], rosters: {} } },
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

function trainAngler(profile, { type, id, revision, betweenOutings }) {
  if (profile.revision !== revision) return { profile, status: 'stale' };
  if (!betweenOutings) return { profile, status: 'outing-active' };
  const ranks = anglerSkillRanks(profile);
  const reset = type === 'reset-angler';
  if (reset) {
    for (const skill of Object.keys(ranks)) ranks[skill] = 0;
  } else {
    if (!Object.hasOwn(anglerSkillLimits, id)) return { profile, status: 'invalid' };
    if (ranks[id] >= anglerSkillLimits[id]) return { profile, status: 'capped' };
    if (!anglerProgress(profile).points) return { profile, status: 'unaffordable' };
    ranks[id]++;
  }
  return {
    profile: { ...profile, revision: profile.revision + 1, angler: { ...profile.angler, ranks } },
    status: reset ? 'reset' : 'learned',
  };
}

export function applyProfile(command) {
  return readProfile(profile => {
    if (['learn-angler', 'reset-angler'].includes(command?.type)) return trainAngler(profile, command);
    if (['learn', 'reset-skills'].includes(command?.type)) return train(profile, command);
    if (command?.type === 'clock') return saveClock(profile, command);
    if (['begin-day', 'open-hole', 'end-day'].includes(command?.type)) return updateDay(profile, command);
    if (command?.type === 'study') return study(profile, command.speciesId);
    if (command?.type === 'award') return award(profile, command);
    if (['collect-fish', 'collect-quest'].includes(command?.type)) return claimLakeReward(profile, command);
    if (command?.type === 'buy' || command?.type === 'equip') return shop(profile, command);
    return { profile, status: 'invalid' };
  });
}
