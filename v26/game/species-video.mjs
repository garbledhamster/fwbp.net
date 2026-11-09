import { getBryanVideo, openBryanVideo } from './bryan-videos.mjs';

// An ordinary anchor preserves the public destination for modified clicks and
// browser navigation. Local outings optionally hold their own logical clock.
export function renderSpeciesVideo(speciesId, container, { acquireSuspension } = {}) {
  container.replaceChildren();
  const video = getBryanVideo(speciesId);
  if (!video) return;
  const link = document.createElement('a');
  link.href = video.url;
  link.dataset.bryanVideo = speciesId;
  link.innerHTML = '<svg class="tackle-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="./assets/tackle-icons.svg#video"/></svg>';
  link.append(document.createTextNode(video.label));
  link.addEventListener('click', event => {
    if (event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const release = acquireSuspension?.() ?? (() => {});
    if (openBryanVideo(speciesId, { trigger: link, onClose: release })) event.preventDefault();
    else release();
  });
  container.append(link);
}
