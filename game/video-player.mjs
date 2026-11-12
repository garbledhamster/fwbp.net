// One native dialog serves both the site library and contextual game footage.
let session = null;
let initializedPlayer;
let youtubeApi;

function loadYouTubeApi() {
  if (globalThis.YT?.Player) return Promise.resolve(globalThis.YT);
  if (!youtubeApi) {
    youtubeApi = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      globalThis.onYouTubeIframeAPIReady = () => resolve(globalThis.YT);
      script.addEventListener('error', () => {
        script.remove();
        youtubeApi = undefined;
        reject(new Error('YouTube player API could not load'));
      }, { once: true });
      document.head.append(script);
    });
  }
  return youtubeApi;
}

function showEpisode(player, episode) {
  const description = player.querySelector('#player-description');
  player.querySelector('#player-title').textContent = episode.title;
  description.textContent = episode.description ?? '';
  description.hidden = !episode.description;
  player.querySelector('#player-source').href = episode.url || 'https://www.youtube.com/watch?v=' + episode.id;
}

async function startPlaylist(player, frame, current, playlist, startIndex) {
  const YT = await loadYouTubeApi();
  if (session !== current || !player.open) return;
  let index = startIndex;
  let consecutiveErrors = 0;
  function advance(target) {
    index = (index + 1) % playlist.length;
    const episode = playlist[index];
    showEpisode(player, episode);
    frame.title = episode.title;
    target.loadVideoById(episode.id);
  }

  // Advance by ID so the entire site catalog fits, including Shorts.
  current.youtube = new YT.Player(frame, { events: {
    onStateChange({ target, data }) {
      if (session !== current || !player.open) return;
      if (data === 0) advance(target);
      if (data === 1) consecutiveErrors = 0;
    },
    onError({ target }) {
      if (session !== current || !player.open) return;
      if (++consecutiveErrors < playlist.length) advance(target);
    }
  } });
}

function setupPlayer(player) {
  if (initializedPlayer === player) return;
  initializedPlayer = player;
  // The top dialog owns keyboard input, including Escape's native cancel action.
  player.addEventListener('keydown', event => event.stopPropagation());
  player.addEventListener('cancel', event => event.stopPropagation());
  player.addEventListener('close', () => {
    const closed = session;
    session = null;
    try {
      closed?.youtube?.destroy();
    } finally {
      player.querySelector('#player-video').replaceChildren();
      try {
        closed?.onClose?.();
      } finally {
        if (closed?.trigger?.isConnected) closed.trigger.focus({ preventScroll: true });
      }
    }
  });
}

/** Caller owns any game suspension; false means nothing opened. */
export function openVideo(episode, { trigger, onClose, playlist } = {}) {
  const player = globalThis.document?.querySelector('#player');
  if (!episode || !/^[\w-]{11}$/.test(episode.id) || !player ||
      typeof player.showModal !== 'function' || player.open || session) return false;
  setupPlayer(player);
  showEpisode(player, episode);
  const startIndex = playlist?.findIndex(candidate => candidate.id === episode.id) ?? -1;
  const frame = document.createElement('iframe');
  frame.title = episode.title;
  frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
  frame.allowFullscreen = true;
  frame.referrerPolicy = 'strict-origin-when-cross-origin';
  const embed = new URL('https://www.youtube-nocookie.com/embed/' + episode.id);
  embed.search = new URLSearchParams({ autoplay: '1', playsinline: '1', rel: '0' });
  if (startIndex >= 0) {
    embed.searchParams.set('enablejsapi', '1');
    embed.searchParams.set('origin', location.origin);
  }
  frame.src = embed.href;
  const current = { trigger: trigger ?? document.activeElement, onClose };
  session = current;
  try {
    player.showModal();
  } catch {
    session = null;
    return false;
  }
  player.querySelector('#player-video').replaceChildren(frame);
  if (startIndex >= 0) {
    // If the API fails to load, the iframe can still play the starting video.
    startPlaylist(player, frame, current, playlist, startIndex).catch(() => {});
  }
  return true;
}
