import { lakes } from './rules.mjs?v=16';

const speciesIds = new Set(lakes['mille-lacs'].fish.map(fish => fish.id));
export const shopItems = [
  { id: 'starter-line', category: 'line', name: 'Starter line', cost: 0, effect: '8 lb breaking strength; 100 ms more to set the hook with Jig.', strength: 8, lure: 'jig', windowMs: 100 },
  { id: 'stronger-line', category: 'line', name: 'Stronger line', cost: 10, effect: '12 lb breaking strength.', strength: 12 },
  { id: 'starter-hook', category: 'hook', name: 'Standard hooks', cost: 0, effect: 'Stock hooks for Jig, Spoon, and Minnow. Standard timing.' },
  { id: 'finesse-hook', category: 'hook', name: 'Fine-wire jig setup', cost: 15, effect: '200 ms more with Jig; stock hooks and timing with Spoon or Minnow.', lure: 'jig', windowMs: 200 },
  { id: 'octopus-hook', category: 'hook', name: 'Octopus minnow setup', cost: 15, effect: '200 ms more with Minnow; stock hooks and timing with Jig or Spoon.', lure: 'minnow', windowMs: 200 },
  { id: 'line-control', category: 'training', name: 'Line Control', cost: 20, effect: 'Rank 1 gives you 350 ms more to set the hook with any lure.', rank: 1 },
  { id: 'starter-license', category: 'license', name: 'Starter Shore permit', cost: 0, effect: 'Free game access to Starter Shore on Mille Lacs.', area: 'starter-shore' },
  { id: 'deep-reef-license', category: 'license', name: 'Deep Reef permit', cost: 25, effect: 'Game access to Deep Reef on Mille Lacs.', area: 'deep-reef' },
];

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

function saveClock(profile, elapsedMs) {
  if (!Number.isSafeInteger(elapsedMs) || elapsedMs < 0) return { profile, status: 'invalid' };
  if (elapsedMs <= profile.elapsedMs) return { profile, status: 'clock-current' };
  return { profile: { ...profile, elapsedMs }, status: 'clock-saved' };
}

export function applyProfile(command) {
  return readProfile(profile => {
    if (command?.type === 'clock') return saveClock(profile, command.elapsedMs);
    if (command?.type === 'study') return study(profile, command.speciesId);
    if (command?.type === 'award') return award(profile, command);
    if (command?.type === 'buy' || command?.type === 'equip') return shop(profile, command);
    return { profile, status: 'invalid' };
  });
}
