import { spriteHref } from "./game/lake-sprites.mjs";
import { openVideo } from './game/video-player.mjs';

const hotDogCategory = "Hot dog";
const episodes = [
  {
    id: "3dmUMd9oR88",
    title: "Five of Diamonds for northern pike and bass",
    category: "Underwater",
    art: "ice",
    description: "Bryan fishes a Five of Diamonds spoon through the ice with an underwater camera. Around 5:40, a pike comes up toward the spoon."
  },
  {
    id: "20uLF46BQKk",
    title: "Northern pike on a Dardevle",
    category: "Underwater",
    art: "lure",
    featured: true,
    description: "Watch northern pike come in on a Dardevle spoon from the camera’s view below the ice."
  },
  {
    id: "PHJOCTI5XUo",
    title: "Pike, bass, crappie and a muskrat on camera",
    category: "Underwater",
    art: "lure",
    description: "An Aqua-Vu camera captures some unexpected company below the ice."
  },
  {
    id: "i5TfAtufo7U",
    title: "Early ice walleyes on Mille Lacs",
    category: "Mille Lacs",
    art: "camp",
    description: "Early-season walleye fishing on Mille Lacs Lake with an underwater camera."
  },
  {
    id: "sXRoaFLDS10",
    title: "Ice Castle perch on Mille Lacs",
    category: "Mille Lacs",
    art: "ice",
    featured: true,
    description: "Bryan films yellow perch under the ice on Mille Lacs."
  },
  {
    id: "toN7z2eNxEU",
    title: "Mississippi River smallmouth from a kayak",
    category: "Kayak fishing",
    art: "light",
    description: "Bryan heads to the Mississippi River for smallmouth bass from his kayak."
  },
  {
    id: "1mtyGF6wlDI",
    title: "Underwater camera setup for early ice",
    category: "Gear",
    art: "camp",
    description: "Bryan takes an underwater camera out for an early-ice scouting trip in Minnesota."
  },
  ...[
    ["NpQtS2wNDRc", "Hot Dog vs. Pike! Will They Eat?", "Bryan tries hot dogs for northern pike in shallow water."],
    ["L7Ub8BdT0Ws", "Big Pike vs. Hot Dog!", "A Short about whether big pike like hot dogs."],
    ["W63YgKh-szs", "Ice Fishing Hot Dogs for Big Pike", "Bryan gives hot dog bait a try and shares what happened."],
    ["gujypoDa-dc", "Ice Fishing with Hot Dog for Northern Pike", "See how pike react to hot dog bait on Bryan’s underwater camera."],
    ["GRJ1GOc6Pvk", "Hot Dog vs. Kielbasa", "Bryan puts both baits in front of northern pike."],
    ["aYJhIZhbeDg", "Pike Eats Hot Dog!", "A Short of a northern pike going for hot dog bait."]
  ].map(([id, title, description]) => ({ id, title, description, category: hotDogCategory, art: "lure" }))
];

const duckHunterShort = {
  id: "Qo7FSZc9S7I",
  title: "I THOUGHT I GOT SHOT!",
  description: "Duck hunters startled Bryan while he was out in his kayak. This clip contains sudden gunfire."
};

function watchUrl(id) {
  return "https://www.youtube.com/watch?v=" + id;
}

const library = document.querySelector("#video-grid");
const featured = document.querySelector("#featured-grid");
const filters = document.querySelector(".filters");
const filterButtons = new Map();
const libraryStatus = document.querySelector("#library-status");
const byId = new Map([...episodes, duckHunterShort].map((episode) => [episode.id, episode]));
const hotDogEpisodes = episodes.filter((episode) => episode.category === hotDogCategory);
let lastHotDogId;

function makeEpisode(episode) {
  const article = document.createElement("article");
  article.className = "episode";
  const link = document.createElement("a");
  link.className = "episode-trigger";
  link.href = watchUrl(episode.id);
  link.dataset.watch = episode.id;
  link.setAttribute("aria-label", "Watch " + episode.title);
  const art = document.createElement("span");
  art.className = "episode-art";
  art.setAttribute("aria-hidden", "true");
  art.innerHTML = '<svg class="artwork" viewBox="0 0 400 154" preserveAspectRatio="xMidYMid slice"><use/></svg>';
  art.querySelector("use").setAttribute("href", spriteHref("scenes", "bi-cover-" + episode.art));
  const image = document.createElement("img");
  image.alt = "";
  image.loading = "lazy";
  image.decoding = "async";
  image.addEventListener("error", () => image.remove(), { once: true });
  image.src = "https://i.ytimg.com/vi/" + episode.id + "/mqdefault.jpg";
  art.append(image);
  const play = document.createElement("span");
  play.className = "play-mark";
  play.innerHTML = '<svg viewBox="0 0 20 20"><path d="m6 3 11 7-11 7z"/></svg>';
  art.append(play);
  const meta = document.createElement("span");
  meta.className = "episode-meta";
  meta.textContent = episode.category;
  const title = document.createElement("strong");
  title.className = "episode-name";
  title.textContent = episode.title;
  link.append(art, meta, title);
  article.append(link);
  return article;
}

function setFilter(category) {
  const matches = category === "All" ? episodes : episodes.filter((episode) => episode.category === category);
  library.replaceChildren(...matches.map(makeEpisode));
  for (const [name, button] of filterButtons) {
    button.setAttribute("aria-pressed", String(name === category));
  }
  libraryStatus.textContent = matches.length + (matches.length === 1 ? " video" : " videos");
}

for (const category of ["All", ...new Set(episodes.map((episode) => episode.category))]) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = category;
  button.addEventListener("click", () => setFilter(category));
  filterButtons.set(category, button);
  filters.append(button);
}
for (const shortcut of document.querySelectorAll(".trip-picks button")) {
  shortcut.addEventListener("click", () => {
    const category = shortcut.dataset.category;
    setFilter(category);
    filterButtons.get(category).focus({ preventScroll: true });
    filters.scrollIntoView({ block: "start" });
  });
}
featured.replaceChildren(...episodes.filter((episode) => episode.featured).map(makeEpisode));
setFilter("All");

const heroPlayer = document.querySelector(".hero-player");
const heroEpisode = byId.get(heroPlayer?.dataset.videoId);
if (heroEpisode) {
  const touchDevice = matchMedia("(hover: none) and (pointer: coarse)").matches;
  const url = new URL("https://www.youtube-nocookie.com/embed/" + heroEpisode.id);
  url.search = new URLSearchParams({ autoplay: "0", playsinline: "1", rel: "0" }).toString();
  const frame = document.createElement("iframe");
  frame.title = heroEpisode.title;
  frame.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
  frame.allowFullscreen = true;
  frame.referrerPolicy = "strict-origin-when-cross-origin";

  if (!touchDevice) {
    url.searchParams.set("enablejsapi", "1");
    url.searchParams.set("origin", location.origin);
    window.onYouTubeIframeAPIReady = () => {
      new window.YT.Player(frame, {
        events: {
          onReady({ target }) {
            const visibility = new IntersectionObserver(([entry]) => {
              if (entry.intersectionRatio < .51) return;
              visibility.disconnect();
              const state = target.getPlayerState();
              if (state !== -1 && state !== 5) return;
              target.mute();
              target.playVideo();
            }, { threshold: .51 });
            visibility.observe(frame);
          },
        },
      });
    };
    const api = document.createElement("script");
    api.src = "https://www.youtube.com/iframe_api";
    document.head.append(api);
  }

  frame.src = url.href;
  heroPlayer.replaceChildren(frame);
}

document.addEventListener("click", (event) => {
  const trigger = event.target.closest("a[data-watch]");
  if (!trigger || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  let episode = byId.get(trigger.dataset.watch);
  if (trigger.hasAttribute("data-random-hot-dog") && hotDogEpisodes.length) {
    const choices = hotDogEpisodes.length > 1
      ? hotDogEpisodes.filter((candidate) => candidate.id !== lastHotDogId)
      : hotDogEpisodes;
    episode = choices[Math.floor(Math.random() * choices.length)];
    lastHotDogId = episode.id;
    trigger.href = watchUrl(episode.id);
  }
  if (episode && openVideo({ ...episode, url: trigger.href }, { trigger })) event.preventDefault();
});

const motion = document.querySelector("#motion");
const systemMotion = matchMedia("(prefers-reduced-motion: reduce)");
let reduce = false;
function applyMotionPreference() {
  const reduced = reduce || systemMotion.matches;
  motion.disabled = systemMotion.matches;
  motion.setAttribute("aria-pressed", String(reduced));
  document.body.toggleAttribute("data-reduced", reduced);
  requestScrollUpdate();
}
motion.hidden = false;
motion.addEventListener("click", () => {
  reduce = !reduce;
  applyMotionPreference();
});
systemMotion.addEventListener("change", applyMotionPreference);

const progress = document.querySelector(".scroll-progress");
const depthScenes = [...document.querySelectorAll(".surface, .ice, [data-dive]")];

const lure = document.querySelector(".footer-rig");

function updateDepth(remaining) {
  if (reduce || systemMotion.matches || document.body.hasAttribute("data-fish-paused")) return;

  // Follow each section as it passes through the viewport, from -1 to 1.
  const viewport = innerHeight;
  const positions = depthScenes.map(scene => {
    const { top, height } = scene.getBoundingClientRect();
    return Math.max(-1, Math.min(1, (viewport - height - 2 * top) / (viewport + height)));
  });
  depthScenes.forEach((scene, index) => {
    scene.style.setProperty("--depth", positions[index].toFixed(3));
  });
  const approach = Math.max(0, Math.min(1, 1 - remaining / 420));
  lure.style.setProperty("--approach", approach.toFixed(3));
}

let frame = 0;
function requestScrollUpdate() {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    const total = document.documentElement.scrollHeight - innerHeight;
    const fraction = total > 0 ? Math.max(0, Math.min(1, scrollY / total)) : 0;
    progress.style.setProperty("--scroll", String(fraction));
    updateDepth(total - scrollY);
  });
}
addEventListener("scroll", requestScrollUpdate, { passive: true });
addEventListener("resize", requestScrollUpdate);
addEventListener("popstate", requestScrollUpdate);
for (const guide of document.querySelectorAll("details")) guide.addEventListener("toggle", requestScrollUpdate);
applyMotionPreference();

const gamePreview = document.querySelector('.mast-game-preview');
const gameButton = gamePreview.querySelector('.mast-game');
const gameDescription = gamePreview.querySelector('#game-preview');
let touchPress;
let holdTimer;
let held = false;

function cancelGameHold() {
  clearTimeout(holdTimer);
  touchPress = undefined;
}

gamePreview.addEventListener('pointerenter', event => {
  if (event.pointerType === 'mouse') gameDescription.hidden = false;
});
gamePreview.addEventListener('pointerleave', event => {
  if (event.pointerType === 'mouse' && !gameButton.matches(':focus-visible')) gameDescription.hidden = true;
});
gameButton.addEventListener('focus', () => {
  if (gameButton.matches(':focus-visible')) gameDescription.hidden = false;
});
gameButton.addEventListener('blur', () => { gameDescription.hidden = true; });

gameButton.addEventListener('pointerdown', event => {
  if (!event.isPrimary) return;
  held = false;
  if (event.pointerType !== 'touch') return;
  touchPress = { x: event.clientX, y: event.clientY };
  holdTimer = setTimeout(() => {
    held = true;
    gameDescription.hidden = false;
  }, 500);
});
gameButton.addEventListener('pointermove', event => {
  if (touchPress && Math.hypot(event.clientX - touchPress.x, event.clientY - touchPress.y) > 12) cancelGameHold();
});
gameButton.addEventListener('pointerup', cancelGameHold);
gameButton.addEventListener('pointercancel', cancelGameHold);
gameButton.addEventListener('contextmenu', event => {
  if (touchPress || held) event.preventDefault();
});
gameButton.addEventListener('click', event => {
  if (held && event.detail > 0) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }
  gameDescription.hidden = true;
}, { capture: true });
document.addEventListener('pointerdown', event => {
  if (!gamePreview.contains(event.target)) gameDescription.hidden = true;
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') gameDescription.hidden = true;
});
