export const shopItems = [
  { id: 'starter-line', category: 'line', name: 'Starter line', cost: 0, effect: 'Breaks above 8 lb.', strength: 8 },
  { id: 'stronger-line', category: 'line', name: 'Stronger line', cost: 10, effect: 'Breaks above 12 lb.', strength: 12 },
  { id: 'starter-hook', category: 'hook', name: 'Starter hook', cost: 0, effect: 'Works with Jig, Spoon, and Minnow.' },
  { id: 'starter-license', category: 'license', name: 'Starter license', cost: 0, effect: 'Opens the starter water on Mille Lacs.' },
];

const storeName = 'profile';
const profileKey = 'campaign';
let database;

function starterProfile() {
  return {
    version: 1,
    revision: 0,
    coins: 0,
    owned: ['starter-line', 'starter-hook', 'starter-license'],
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

export function applyProfile(command) {
  return readProfile(profile => {
    if (command?.type === 'award') return award(profile, command);
    if (command?.type === 'buy' || command?.type === 'equip') return shop(profile, command);
    return { profile, status: 'invalid' };
  });
}
