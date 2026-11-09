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

async function readProfile(update) {
  const connection = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = connection.transaction(storeName, update ? 'readwrite' : 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(profileKey);
    let result;

    request.onsuccess = () => {
      const profile = request.result ?? starterProfile();
      result = update ? update(profile) : profile;
      // The decision and its write use the same transaction, even across tabs.
      if (update && result.profile !== profile) store.put(result.profile, profileKey);
    };
    transaction.oncomplete = () => resolve(result);
    transaction.onabort = () => reject(transaction.error ?? new Error('The campaign save was interrupted.'));
  });
}

export function loadProfile() {
  return readProfile();
}

function award(profile, { key, outcome, catch: fish }) {
  const earned = fish?.points;
  if (outcome !== 'landed' || typeof key !== 'string' || !/^.+:\d+$/.test(key)
    || !Number.isSafeInteger(earned) || earned <= 0 || !Number.isSafeInteger(profile.coins + earned)) {
    return { profile, status: 'no-award' };
  }
  if (Object.hasOwn(profile.awards, key)) return { profile, status: 'duplicate-award' };
  return {
    profile: {
      ...profile,
      revision: profile.revision + 1,
      coins: profile.coins + earned,
      awards: { ...profile.awards, [key]: earned },
    },
    status: 'awarded',
    earned,
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
    if (command?.type === 'award') return award(profile, command);
    if (command?.type === 'buy' || command?.type === 'equip') return shop(profile, command);
    return { profile, status: 'invalid' };
  });
}
