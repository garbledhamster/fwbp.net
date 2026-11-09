import { applyProfile, loadProfile } from './profile.mjs?v=connected-rpg';
import { renderSpeciesVideo } from './species-video.mjs';
import { collectibleSpecies, speciesArt, fishProfiles, lureTip } from './species-catalog.mjs';

const stylesheet = document.createElement('link');
stylesheet.rel = 'stylesheet';
stylesheet.href = new URL('./collection.css?v=connected-rpg', import.meta.url).href;
document.head.append(stylesheet);

export const collectionIntroduction = 'Land fish in Campaign or Practice to add them to Your Lake. Open a caught fish and learn its lure tip for your next encounter.';
const portrait = '<img class="collection-guide-portrait" src="./assets/branding/bryan-front-facing.webp" alt="Bryan" width="72" height="72">';
const svg = id => {
  const [sheet, symbol, viewBox] = speciesArt[id];
  return `<svg class="collection-fish-art" viewBox="${viewBox}" aria-hidden="true"><use href="./assets/${sheet}.svg#${symbol}"/></svg>`;
};

// The site card and paused-outing card share the same content and explicit study action.
export function fillSpeciesCard(container, id, { profile, onChange, onVideo } = {}) {
  const fish = fishProfiles[id];
  const tip = lureTip(id);
  container.innerHTML = `<div class="collection-guide">${portrait}<div><p class="collection-eyebrow">Bryan’s fish guide</p><h2></h2><p data-family></p></div></div>
    ${svg(id)}<dl><dt>How to spot it</dt><dd data-feature></dd><dt>Where it lives</dt><dd data-habitat></dd></dl>
    <p data-note></p><a data-source target="_blank" rel="noopener">Species reference ↗</a>
    <div class="collection-study"><p data-tip role="status"></p><button type="button" data-study>Learn this tip</button></div><div data-video></div>`;
  container.querySelector('h2').textContent = fish.name;
  for (const field of ['family', 'feature', 'habitat', 'note']) {
    container.querySelector(`[data-${field}]`).textContent = fish[field] ?? '';
  }
  container.querySelector('[data-source]').href = fish.source;
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
  renderStudy();
  study.addEventListener('click', async () => {
    study.disabled = true;
    try {
      const result = await applyProfile({ type: 'study', speciesId: id });
      profile = result.profile;
      renderStudy();
      onChange?.(profile);
      document.dispatchEvent(new CustomEvent('fishing:profile-changed', { detail: { profile } }));
    } catch {
      status.textContent = 'Couldn’t save this tip. Try again.';
      study.disabled = false;
    }
  });
  // The video lane provides the exact-species availability and a modal above this card.
  const videoContainer = container.querySelector('[data-video]');
  if (onVideo) onVideo(id, videoContainer);
  else renderSpeciesVideo(id, videoContainer);
}

/** Caller holds its local pause until onClose. Nested cards never close the collection. */
export function openYourLake({ onClose, onVideo, initialSpecies } = {}) {
  const opener = document.activeElement;
  const dialog = document.createElement('dialog');
  dialog.id = 'your-lake';
  dialog.className = 'collection-dialog';
  dialog.setAttribute('aria-label', 'Your Lake');
  dialog.innerHTML = '<div class="collection-top"><button type="button" data-back hidden>Back to Your Lake</button><button type="button" data-close>Return to outing</button></div><div data-content></div>';
  const content = dialog.querySelector('[data-content]');
  const back = dialog.querySelector('[data-back]');
  let profile, active = true, cardOpener, request = 0;
  const card = id => {
    cardOpener = dialog.querySelector(`[data-species="${id}"]`);
    back.hidden = false;
    fillSpeciesCard(content, id, { profile, onChange: saved => { profile = saved; }, onVideo });
    back.focus({ preventScroll: true });
  };
  const list = () => {
    back.hidden = true;
    content.innerHTML = `<div class="collection-guide">${portrait}<div><p class="collection-eyebrow">Mille Lacs collection</p><h2>Your Lake</h2><p data-count></p></div></div><p data-intro></p><p data-legacy></p><div class="collection-grid"></div>`;
    content.querySelector('[data-intro]').textContent = collectionIntroduction;
    content.querySelector('[data-count]').textContent = `${profile.caughtSpecies.length} / 6 species caught`;
    content.querySelector('[data-legacy]').textContent = profile.caughtSpecies.length ? ''
      : 'Your tackle and coins stay with you. Species tracking starts with a saved landing in this version.';
    const grid = content.querySelector('.collection-grid');
    for (const fish of collectibleSpecies.filter(fish => profile.caughtSpecies.includes(fish.id))) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.species = fish.id;
      button.innerHTML = svg(fish.id);
      const name = document.createElement('span');
      name.textContent = fishProfiles[fish.id].name;
      button.append(name);
      button.addEventListener('click', () => card(fish.id));
      grid.append(button);
    }
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
