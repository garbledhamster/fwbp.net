import { fishProfiles } from '../assets/fish-profiles.js';
import { getBryanVideo } from './bryan-videos.mjs?v=angler-1';
import { spriteHref } from './lake-sprites.mjs';

export function createVideoCard({ id, title, url, caption, artwork, external = false }) {
  const article = document.createElement('article');
  article.className = 'episode video-thumbnail';
  const link = document.createElement('a');
  link.className = 'episode-trigger';
  link.href = url;
  if (external) {
    link.target = '_blank';
    link.rel = 'noopener';
    link.setAttribute('aria-label', `Watch now on YouTube. ${title} (opens in a new tab)`);
  } else {
    link.dataset.watch = id;
    link.setAttribute('aria-label', 'Watch ' + title);
  }

  const art = document.createElement('span');
  art.className = 'episode-art';
  art.setAttribute('aria-hidden', 'true');
  art.innerHTML = '<svg class="artwork" viewBox="0 0 400 154" preserveAspectRatio="xMidYMid slice"><use/></svg>';
  art.querySelector('use').setAttribute('href', spriteHref('scenes', 'bi-cover-' + artwork));
  const image = document.createElement('img');
  image.alt = '';
  image.loading = 'lazy';
  image.decoding = 'async';
  image.addEventListener('error', () => image.remove(), { once: true });
  image.src = 'https://i.ytimg.com/vi/' + id + (external ? '/hqdefault.jpg' : '/mqdefault.jpg');
  const play = document.createElement('span');
  play.className = 'play-mark';
  play.innerHTML = '<svg viewBox="0 0 20 20"><path d="m6 3 11 7-11 7z"/></svg>';
  art.append(image, play);

  const copy = document.createElement('span');
  copy.className = 'episode-copy';
  if (caption) {
    const meta = document.createElement('span');
    meta.className = 'episode-meta';
    meta.textContent = caption;
    copy.append(meta);
  }
  const heading = document.createElement('strong');
  heading.className = 'episode-name';
  heading.textContent = title;
  copy.append(heading);
  if (external) {
    const watch = document.createElement('span');
    watch.className = 'episode-watch';
    watch.textContent = 'Watch now';
    copy.append(watch);
  }
  link.append(art, copy);
  article.append(link);
  return article;
}

// Contextual footage stays outside the game. A guide that already links its
// species source can suppress the duplicate fallback.
export function renderSpeciesVideo(speciesId, container, { reference = true } = {}) {
  container.replaceChildren();
  const video = getBryanVideo(speciesId);
  if (video) {
    const card = createVideoCard({
      ...video, title: video.label, artwork: speciesId === 'smallmouth' ? 'camp' : 'ice', external: true,
    });
    card.classList.add('fishing-video-card');
    card.querySelector('a').dataset.bryanVideo = speciesId;
    container.append(card);
    return;
  }

  const fish = Object.hasOwn(fishProfiles, speciesId) && fishProfiles[speciesId];
  if (!reference || !fish?.source) return;
  const link = document.createElement('a');
  link.className = 'species-reference-link';
  link.href = fish.source;
  link.target = '_blank';
  link.rel = 'noopener';
  link.dataset.speciesReference = speciesId;
  link.textContent = `Species reference · ${fish.name}`;
  container.append(link);
}
