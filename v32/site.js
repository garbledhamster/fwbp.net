import { spriteHref } from "./game/lake-sprites.mjs";
import { openVideo } from './game/video-player.mjs';

import { iceFishingVideos } from "./assets/ice-fishing-videos.mjs";

const categories = ["Underwater", "All", "Mille Lacs", "Gear", "Hot dog"];
const categoryArt = { Underwater: "ice", "Mille Lacs": "ice", Gear: "camp", "Hot dog": "lure" };
const featuredIds = ["20uLF46BQKk", "sXRoaFLDS10"];
const batchSize = 18;
const episodes = iceFishingVideos.map(([id, title, tags, short]) => ({
  id, title, tags, short,
  url: "https://www.youtube.com/" + (short ? "shorts/" + id : "watch?v=" + id),
  art: categoryArt[tags[0]] ?? "camp"
}));
const byId = new Map(episodes.map(episode => [episode.id, episode]));
const hotDogEpisodes = episodes.filter(episode => episode.tags.includes("Hot dog"));

const library = document.querySelector("#video-grid");
const featured = document.querySelector("#featured-grid");
const filters = document.querySelector(".filters");
const filterButtons = new Map();
const libraryStatus = document.querySelector("#library-status");
const randomVideo = document.querySelector("#random-video");
const moreVideos = document.querySelector("#more-videos");
let matches = [];
let lastRandomId;
let lastHotDogId;

function pickRandom(pool, previousId) {
  const choices = pool.length > 1 ? pool.filter(episode => episode.id !== previousId) : pool;
  return choices[Math.floor(Math.random() * choices.length)];
}

function makeEpisode(episode) {
  const article = document.createElement("article");
  article.className = "episode";
  const link = document.createElement("a");
  link.className = "episode-trigger";
  link.href = episode.url;
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
  const label = episode.tags.join(" · ") || "Ice fishing";
  meta.textContent = episode.short ? label + " · Short" : label;
  const title = document.createElement("strong");
  title.className = "episode-name";
  title.textContent = episode.title;
  link.append(art, meta, title);
  article.append(link);
  return article;
}

function showMore() {
  const start = library.childElementCount;
  const cards = matches.slice(start, start + batchSize).map(makeEpisode);
  library.append(...cards);
  const shown = library.childElementCount;
  moreVideos.hidden = shown >= matches.length;
  libraryStatus.textContent = shown < matches.length
    ? "Showing " + shown + " of " + matches.length + " videos"
    : matches.length + (matches.length === 1 ? " video" : " videos");
  return cards[0];
}

function setFilter(category) {
  matches = category === "All" ? episodes : episodes.filter(episode => episode.tags.includes(category));
  library.replaceChildren();
  for (const [name, button] of filterButtons) {
    button.setAttribute("aria-pressed", String(name === category));
  }
  randomVideo.disabled = matches.length === 0;
  showMore();
}

for (const category of categories) {
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
moreVideos.addEventListener("click", () => showMore()?.querySelector("a").focus());
randomVideo.addEventListener("click", () => {
  const episode = pickRandom(matches, lastRandomId);
  if (openVideo(episode, { trigger: randomVideo, playlist: matches })) lastRandomId = episode.id;
});
featured.replaceChildren(...featuredIds.map(id => makeEpisode(byId.get(id))));
setFilter("Underwater");
randomVideo.hidden = false;

document.addEventListener("click", (event) => {
  const trigger = event.target.closest("a[data-watch]");
  if (!trigger || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  let episode = byId.get(trigger.dataset.watch);
  if (trigger.hasAttribute("data-random-hot-dog") && hotDogEpisodes.length) {
    episode = pickRandom(hotDogEpisodes, lastHotDogId);
    lastHotDogId = episode.id;
    trigger.href = episode.url;
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
