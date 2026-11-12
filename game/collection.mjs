import { applyProfile, dailyLakeQuest, loadProfile } from './profile.mjs?v=day-save';
import { renderSpeciesVideo } from './species-video.mjs?v=angler-1';
import { collectibleSpecies, speciesArt, fishProfiles, lureTip } from './species-catalog.mjs';
import { spriteHref } from './lake-sprites.mjs';

const stylesheet = document.createElement('link');
stylesheet.rel = 'stylesheet';
stylesheet.href = new URL('./collection.css?v=angler-1', import.meta.url).href;
document.head.append(stylesheet);

export const collectionIntroduction = 'Open a fish to collect your Campaign reward or learn its lure tip.';
const portrait = '<img class="collection-guide-portrait" src="./assets/branding/bryan-front-facing.webp" alt="Bryan" width="72" height="72">';
const svg = id => {
  const [sheet, symbol, viewBox] = speciesArt[id];
  return `<svg class="collection-fish-art" viewBox="${viewBox}" aria-hidden="true"><use href="${spriteHref(sheet, symbol)}"/></svg>`;
};

// The site card and paused-outing card share the same content and explicit study action.
export function fillSpeciesCard(container, id, { profile, onChange, showCatchSpots = false } = {}) {
  const fish = fishProfiles[id];
  const tip = lureTip(id);
  container.innerHTML = `<div class="collection-guide">${portrait}<div><p class="collection-eyebrow">Bryan’s fish guide</p><h2></h2><p data-family></p></div></div>
    ${svg(id)}<dl><dt>How to spot it</dt><dd data-feature></dd><dt>Where it lives</dt><dd data-habitat></dd></dl>
    <p data-note></p><a data-source target="_blank" rel="noopener">Species reference ↗</a>
    ${showCatchSpots ? '<section class="collection-catch-spots" data-catch-spots hidden><h3>Campaign catch spots</h3><ul></ul></section>' : ''}
    <div class="collection-study"><p data-tip role="status"></p><button type="button" data-study>Learn this tip</button></div><div data-video></div>`;
  container.querySelector('h2').textContent = fish.name;
  for (const field of ['family', 'feature', 'habitat', 'note']) {
    container.querySelector(`[data-${field}]`).textContent = fish[field] ?? '';
  }
  container.querySelector('[data-source]').href = fish.source;
  const catchSpots = container.querySelector('[data-catch-spots]');
  const renderCatchSpots = () => {
    if (!catchSpots) return;
    const counts = new Map();
    for (const location of Object.values(profile?.catchLocations ?? {})) {
      if (location?.speciesId !== id || !location.cellId) continue;
      const { cellId } = location;
      counts.set(cellId, (counts.get(cellId) ?? 0) + 1);
    }
    const list = catchSpots.querySelector('ul');
    list.replaceChildren();
    for (const [cellId, count] of counts) {
      const spot = document.createElement('li');
      spot.textContent = `${cellId} · ${count} ${count === 1 ? 'catch' : 'catches'}`;
      list.append(spot);
    }
    catchSpots.hidden = !counts.size;
  };
  const study = container.querySelector('[data-study]');
  const status = container.querySelector('[data-tip]');
  const renderStudy = () => {
    const caught = profile?.caughtSpecies?.includes(id);
    const studied = profile?.studiedSpecies?.includes(id);
    study.hidden = !tip;
    study.disabled = !caught || studied;
    study.textContent = studied ? 'Tip learned' : 'Learn this tip';
    status.textContent = !tip ? 'Reference species. This fish is outside the six-species game collection.'
      : !caught ? 'Catch this species in Campaign or Practice to learn its lure tip.'
      : studied ? tip.text : 'Learn this tip to recognize its lure in a later encounter.';
    if (studied) {
      const lureIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      lureIcon.setAttribute('viewBox', '0 0 24 24');
      lureIcon.setAttribute('aria-hidden', 'true');
      lureIcon.innerHTML = `<use href="./assets/tackle-icons.svg#${tip.lure}"/>`;
      status.prepend(lureIcon);
    }
  };
  renderCatchSpots();
  renderStudy();
  study.addEventListener('click', async () => {
    study.disabled = true;
    try {
      const result = await applyProfile({ type: 'study', speciesId: id });
      profile = result.profile;
      renderCatchSpots();
      renderStudy();
      onChange?.(profile);
      document.dispatchEvent(new CustomEvent('fishing:profile-changed', { detail: { profile } }));
    } catch {
      status.textContent = 'Couldn’t save this tip. Try again.';
      study.disabled = false;
    }
  });
  renderSpeciesVideo(id, container.querySelector('[data-video]'), { reference: false });
}

/** Caller holds its local pause until onClose. Nested cards never close the collection. */
export function openYourLake({ onClose, initialSpecies } = {}) {
  const opener = document.activeElement;
  const dialog = document.createElement('dialog');
  dialog.id = 'your-lake';
  dialog.className = 'collection-dialog fishing-frame';
  dialog.setAttribute('aria-label', 'My Lake');
  dialog.innerHTML = '<div class="collection-top"><button type="button" data-back hidden>Back to My Lake</button><output class="collection-wallet" data-lake-wallet aria-label="Coin balance"></output><button type="button" data-close>Return to outing</button></div><div data-content></div>';
  const content = dialog.querySelector('[data-content]');
  const back = dialog.querySelector('[data-back]');
  const wallet = dialog.querySelector('[data-lake-wallet]');
  let profile, active = true, cardOpener, request = 0, rewardSaving = false;
  const coins = amount => `${amount} ${amount === 1 ? 'coin' : 'coins'}`;
  const syncWallet = () => { wallet.textContent = coins(profile.coins); };
  const refreshRewards = () => {
    for (const tag of content.querySelectorAll('[data-reward-ready]')) {
      const { species } = tag.closest('[data-species]').dataset;
      tag.hidden = !profile.fishRewards?.[species]?.coins;
    }
    const fishReward = content.querySelector('[data-fish-reward]');
    if (fishReward) {
      const reward = profile.fishRewards?.[fishReward.dataset.fishReward];
      fishReward.querySelector('[data-reward-summary]').textContent = reward?.coins
        ? `${coins(reward.coins)} to collect${reward.discovery ? ' · Includes first catch bonus' : ''}`
        : fishReward.dataset.claimedCoins ? `${coins(Number(fishReward.dataset.claimedCoins))} collected.` : 'Reward collected';
      fishReward.querySelector('[data-collect-fish]').disabled = rewardSaving || !reward?.coins;
    }
    const questReward = content.querySelector('[data-quest-reward]');
    if (questReward) {
      const quest = dailyLakeQuest(profile);
      questReward.querySelector('[data-reward-summary]').textContent = quest.claimed
        ? `Catch two yellow perch · ${coins(quest.coins)} collected`
        : `Catch two yellow perch in Campaign · ${quest.count}/${quest.target} · ${coins(quest.coins)}`;
      questReward.querySelector('[data-collect-quest]').disabled = rewardSaving || quest.claimed || quest.count < quest.target;
    }
  };
  const collectReward = async (panel, command) => {
    if (rewardSaving) return;
    const notice = panel.querySelector('[data-reward-notice]');
    const summary = panel.querySelector('[data-reward-summary]');
    const button = panel.querySelector('button');
    const restoreFocus = document.activeElement === button;
    rewardSaving = true;
    refreshRewards();
    notice.textContent = '';
    try {
      const result = await applyProfile(command);
      profile = result.profile;
      if (result.status === 'claimed') {
        if (command.type === 'collect-fish') panel.dataset.claimedCoins = result.coins;
        document.dispatchEvent(new CustomEvent('fishing:profile-changed', { detail: { profile } }));
      } else if (result.status !== 'nothing-to-claim') {
        notice.textContent = 'Couldn’t collect this reward. Try again.';
      }
    } catch {
      notice.textContent = 'Couldn’t collect this reward. Try again.';
    } finally {
      rewardSaving = false;
      if (active) {
        syncWallet();
        refreshRewards();
        if (restoreFocus && notice.isConnected && [document.body, button].includes(document.activeElement)) {
          (button.disabled ? summary : button).focus({ preventScroll: true });
        }
      }
    }
  };
  const card = id => {
    cardOpener = dialog.querySelector(`[data-species="${id}"]`);
    back.hidden = false;
    fillSpeciesCard(content, id, { profile, onChange: saved => { profile = saved; }, showCatchSpots: true });
    if (profile.fishRewards?.[id]) {
      const reward = document.createElement('section');
      reward.className = 'collection-reward';
      reward.dataset.fishReward = id;
      reward.innerHTML = '<div><h3>Catch reward</h3><p data-reward-summary role="status" tabindex="-1"></p></div><button type="button" data-collect-fish>Collect Reward</button><p data-reward-notice role="status"></p>';
      content.querySelector('.collection-fish-art').after(reward);
      reward.querySelector('button').addEventListener('click', () => collectReward(reward, { type: 'collect-fish', speciesId: id }));
      refreshRewards();
    }
    back.focus({ preventScroll: true });
  };
  const list = () => {
    back.hidden = true;
    content.innerHTML = `<div class="collection-guide">${portrait}<div><h2>My Lake</h2><p data-count></p></div></div><p data-intro></p>
      <section class="collection-reward" data-quest-reward><div><h3>Daily quest</h3><p data-reward-summary role="status" tabindex="-1"></p></div>
      <button type="button" data-collect-quest>Collect Quest Reward</button><p data-reward-notice role="status"></p></section>
      <div class="collection-grid"></div>`;
    content.querySelector('[data-intro]').textContent = collectionIntroduction;
    content.querySelector('[data-count]').textContent = `${profile.caughtSpecies.length} / 6 species caught`;
    const quest = content.querySelector('[data-quest-reward]');
    quest.querySelector('button').addEventListener('click', () => collectReward(quest, { type: 'collect-quest' }));
    const grid = content.querySelector('.collection-grid');
    for (const fish of collectibleSpecies) {
      const button = document.createElement('button');
      button.type = 'button';
      const caught = profile.caughtSpecies.includes(fish.id);
      button.dataset.species = fish.id;
      button.disabled = !caught;
      button.classList.toggle('collection-undiscovered', !caught);
      button.innerHTML = svg(fish.id);
      const name = document.createElement('span');
      name.textContent = caught ? fishProfiles[fish.id].name : 'Undiscovered species';
      button.append(name);
      const ready = document.createElement('small');
      ready.dataset.rewardReady = '';
      ready.textContent = 'Reward ready';
      button.append(ready);
      button.addEventListener('click', () => card(fish.id));
      grid.append(button);
    }
    syncWallet();
    refreshRewards();
    if (cardOpener) dialog.querySelector(`[data-species="${cardOpener.dataset.species}"]`)?.focus({ preventScroll: true });
  };
  const load = async () => {
    const current = ++request;
    content.textContent = 'Opening your saved lake…';
    try {
      profile = await loadProfile();
      if (!active || current !== request) return;
      list();
      if (initialSpecies && profile.caughtSpecies.includes(initialSpecies)) card(initialSpecies);
      initialSpecies = undefined;
    } catch {
      if (!active || current !== request) return;
      content.innerHTML = '<p>Couldn’t open your saved lake.</p><button type="button">Try again</button>';
      content.querySelector('button').addEventListener('click', load);
    }
  };
  back.addEventListener('click', list);
  // Keep the outing's keyboard shortcuts outside this nested surface.
  dialog.addEventListener('keydown', event => event.stopPropagation());
  dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('cancel', event => {
    if (!back.hidden) { event.preventDefault(); list(); }
  });
  dialog.addEventListener('close', () => {
    active = false;
    dialog.remove();
    opener?.focus({ preventScroll: true });
    onClose?.();
  }, { once: true });
  document.body.append(dialog);
  dialog.showModal();
  load();
  return dialog;
}
