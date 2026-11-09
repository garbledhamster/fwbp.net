import { lakes } from './rules.mjs?v=mille-lacs-campaign';
import lakeMap from './lake-map-data.mjs';

const speciesIds = new Set(lakes['mille-lacs'].fish.map(fish => fish.id));
export const shopItems = [
  { id: 'starter-line', category: 'line', name: 'Starter line', cost: 0, effect: '8 lb breaking strength; 100 ms more to set the hook with Jig.', strength: 8, lure: 'jig', windowMs: 100 },
  { id: 'stronger-line', category: 'line', name: 'Stronger line', cost: 10, level: 2, effect: '12 lb breaking strength.', strength: 12 },
  { id: 'starter-hook', category: 'hook', name: 'Standard hooks', cost: 0, effect: 'Stock hooks for Jig, Spoon, and Minnow. Standard timing.' },
  { id: 'finesse-hook', category: 'hook', name: 'Fine-wire jig setup', cost: 15, level: 2, effect: '200 ms more with Jig; stock hooks and timing with Spoon or Minnow.', lure: 'jig', windowMs: 200 },
  { id: 'octopus-hook', category: 'hook', name: 'Octopus minnow setup', cost: 15, level: 2, effect: '200 ms more with Minnow; stock hooks and timing with Jig or Spoon.', lure: 'minnow', windowMs: 200 },
  { id: 'line-control', category: 'training', name: 'Line Control', cost: 20, effect: 'Rank 1 gives you 350 ms more to set the hook with any lure.', rank: 1 },
  { id: 'starter-license', category: 'license', name: 'Starter Shore permit', cost: 0, effect: 'Free game access to Starter Shore on Mille Lacs.', area: 'starter-shore' },
  { id: 'deep-reef-license', category: 'license', name: 'Deep Reef permit', cost: 25, effect: 'Game access to Deep Reef on Mille Lacs.', area: 'deep-reef' },
  { id: 'pro-line', category: 'line', name: 'Pro line', cost: 100, level: 10, effect: '18 lb breaking strength.', strength: 18 },
  { id: 'pro-hook', category: 'hook', name: 'Pro jig setup', cost: 80, level: 10, effect: '400 ms more to set a Jig bite.', lure: 'jig', windowMs: 400 },
  { id: 'waxworm-bait', category: 'bait', name: 'Waxworm bait', cost: 15, level: 2, effect: 'Carry with Jig for 150 ms more to set the hook.', lure: 'jig', windowMs: 150 },
  { id: 'live-minnow', category: 'bait', name: 'Live minnow', cost: 75, level: 10, effect: 'Carry with Minnow for 250 ms more to set the hook.', lure: 'minnow', windowMs: 250 },
];

// XP is a projection of the existing, once-only Campaign payout ledger. Spending
// coins never spends XP, and old saves require no new award or replay marker.
export const campaignXpLevels = [0, 10, 40, 90, 160, 260, 400, 600, 850, 1200];
export const campaignTechniques = [
  { id: 'line-control-1', name: 'Line Control I', level: 2, cost: 1, effect: '350 ms more to set any hook. Paid Line Control already grants this rank.', path: 'control', rank: 1 },
  { id: 'lure-work-1', name: 'Lure Work I', level: 2, cost: 1, effect: 'The hook window opens 125 ms earlier after a bite.', path: 'lure', rank: 1 },
  { id: 'drilling-1', name: 'Drilling', level: 2, cost: 1, effect: 'Open 2 new holes per day, starting the next day.', path: 'drilling', rank: 1 },
  { id: 'line-control-2', name: 'Line Control II', level: 4, cost: 2, requires: 'line-control-1', effect: '700 ms more to set any hook in total.', path: 'control', rank: 2 },
  { id: 'lure-work-2', name: 'Lure Work II', level: 4, cost: 2, requires: 'lure-work-1', effect: 'The hook window opens 250 ms earlier after a bite.', path: 'lure', rank: 2 },
];
export function campaignProgress(profile) {
  const xp = Object.values(profile?.awards ?? {}).reduce((sum, value) => sum + (Number.isSafeInteger(value) && value > 0 ? value : 0), 0);
  const level = campaignXpLevels.filter(required => xp >= required).length;
  const spent = campaignTechniques.filter(node => profile?.techniques?.includes(node.id)).reduce((sum, node) => sum + node.cost, 0);
  return { xp, level, points: Math.max(0, level - 1 - spent), spent, nextXp: campaignXpLevels[level] ?? null };
}
export function campaignTraining(profile) {
  const nodes = campaignTechniques.filter(node => profile?.techniques?.includes(node.id));
  return {
    lineControlRank: Math.max(profile?.owned?.includes('line-control') ? 1 : 0, ...nodes.filter(node => node.path === 'control').map(node => node.rank)),
    lureWorkRank: Math.max(0, ...nodes.filter(node => node.path === 'lure').map(node => node.rank)),
  };
}
export function techniqueState(profile, id) {
  const node = campaignTechniques.find(node => node.id === id);
  if (!node) return { status: 'invalid' };
  if (profile?.techniques?.includes(id) || (id === 'line-control-1' && profile?.owned?.includes('line-control'))) return { status: 'learned', node };
  const progress = campaignProgress(profile);
  if (progress.level < node.level || (node.requires && techniqueState(profile, node.requires).status !== 'learned')) return { status: 'locked', node };
  return { status: progress.points >= node.cost ? 'available' : 'unaffordable', node };
}
export function shopAvailability(profile, item) {
  const level = item.level ?? 1;
  const owned = profile?.owned?.includes(item.id);
  const equipped = profile?.equipped?.[item.category] === item.id;
  const locked = !owned && campaignProgress(profile).level < level;
  const shortfall = Math.max(0, item.cost - (profile?.coins ?? 0));
  return { level, owned, equipped, locked, shortfall, status: owned ? equipped ? 'equipped' : 'owned' : locked ? 'locked' : shortfall ? 'unaffordable' : 'available' };
}

export function areaPermit(area) {
  return shopItems.find(item => item.category === 'license' && item.area === area);
}

export function hasAreaAccess(profile, area) {
  const permit = areaPermit(area);
  return Boolean(permit && profile?.owned.includes(permit.id));
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
  const sameIds = (saved, normalized) => Array.isArray(saved)
    && saved.length === normalized.length && saved.every((id, index) => id === normalized[index]);
  if (profile.version >= 2 && sameIds(profile.caughtSpecies, caughtSpecies)
    && sameIds(profile.studiedSpecies, studiedSpecies) && collectionAwards === profile.collectionAwards) return profile;
  return {
    ...profile,
    version: Math.max(2, profile.version ?? 1),
    revision: (profile.revision ?? 0) + (stored ? 1 : 0),
    caughtSpecies,
    studiedSpecies,
    collectionAwards,
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

function award(profile, { key, outcome, catch: fish, speciesId, mode = 'campaign' }) {
  const earned = fish?.points;
  const localMode = mode === 'campaign' || mode === 'practice';
  // An omitted species remains compatible with already-open older releases.
  const validSpecies = speciesIds.has(speciesId);
  if (!localMode || outcome !== 'landed' || typeof key !== 'string' || !/^.+:\d+$/.test(key)
    || (speciesId !== undefined && !validSpecies) || (mode === 'practice' && !validSpecies)
    || !Number.isSafeInteger(earned) || earned <= 0
    || (mode === 'campaign' && !Number.isSafeInteger(profile.coins + earned))) {
    return { profile, status: 'no-award' };
  }
  // Old numeric payout keys cannot be replayed to invent collection history.
  if (Object.hasOwn(profile.awards, key) || Object.hasOwn(profile.collectionAwards, key)) {
    return { profile, status: 'duplicate-award' };
  }
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

function updateDay(profile, { type, dayId, cellId }) {
  const { day } = profile;
  if (type === 'begin-day') {
    if (day) return { profile, status: 'day-current' };
    const allowance = techniqueState(profile, 'drilling-1').status === 'learned' ? 2 : 1;
    return {
      profile: { ...profile, revision: profile.revision + 1, day: { id: crypto.randomUUID(), allowance, opened: [] } },
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
  if (!hasAreaAccess(profile, cell.area)) return { profile, status: 'permit-required' };
  if (day.opened.includes(cellId)) return { profile, status: 'hole-current' };
  if (day.opened.length >= day.allowance) return { profile, status: 'daily-limit' };
  return {
    profile: { ...profile, revision: profile.revision + 1, day: { ...day, opened: [...day.opened, cellId] } },
    status: 'hole-opened',
  };
}

function train(profile, { type, id, revision, betweenOutings }) {
  if (profile.revision !== revision) return { profile, status: 'stale' };
  if (!betweenOutings) return { profile, status: 'outing-active' };
  if (type === 'reset-skills') return { profile: { ...profile, revision: profile.revision + 1, techniques: [] }, status: 'reset' };
  const { status } = techniqueState(profile, id);
  if (status !== 'available') return { profile, status };
  return { profile: { ...profile, revision: profile.revision + 1, techniques: [...(profile.techniques ?? []), id] }, status: 'learned' };
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
