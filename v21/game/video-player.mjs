// One native dialog serves both the site library and contextual game footage.
let session = null;
let initializedPlayer;

function setupPlayer(player) {
  if (initializedPlayer === player) return;
  initializedPlayer = player;
  // The top dialog owns keyboard input, including Escape's native cancel action.
  player.addEventListener('keydown', event => event.stopPropagation());
  player.addEventListener('cancel', event => event.stopPropagation());
  player.addEventListener('close', () => {
    player.querySelector('#player-video').replaceChildren();
    const closed = session;
    session = null;
    try {
      closed?.onClose?.();
    } finally {
      if (closed?.trigger?.isConnected) closed.trigger.focus({ preventScroll: true });
    }
  });
}

/** Caller owns any game suspension; false means nothing opened. */
export function openVideo(episode, { trigger, onClose } = {}) {
  const player = globalThis.document?.querySelector('#player');
  if (!episode || !/^[\w-]{11}$/.test(episode.id) || !player ||
      typeof player.showModal !== 'function' || player.open || session) return false;
  setupPlayer(player);
  const source = player.querySelector('#player-source');
  player.querySelector('#player-title').textContent = episode.title;
  player.querySelector('#player-description').textContent = episode.description;
  source.href = episode.url || 'https://www.youtube.com/watch?v=' + episode.id;
  const frame = document.createElement('iframe');
  frame.title = episode.title;
  frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
  frame.allowFullscreen = true;
  frame.referrerPolicy = 'strict-origin-when-cross-origin';
  frame.src = 'https://www.youtube-nocookie.com/embed/' + episode.id + '?autoplay=1&playsinline=1&rel=0';
  session = { trigger: trigger ?? document.activeElement, onClose };
  try {
    player.showModal();
  } catch {
    session = null;
    return false;
  }
  player.querySelector('#player-video').replaceChildren(frame);
  return true;
}
