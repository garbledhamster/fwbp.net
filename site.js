const stockBase = "https://videos.pexels.com/video-files/";
const episodes = [
  {
    id: "setting-up",
    title: "Setting up on the ice",
    category: "On the ice",
    art: "camp",
    featured: true,
    description: "Stock footage of two anglers fishing next to a yellow shelter on a frozen lake.",
    video: stockBase + "6830924/6830924-sd_640_360_25fps.mp4",
    source: "https://www.pexels.com/video/men-fishing-on-ice-6830924/"
  },
  {
    id: "at-the-hole",
    title: "A closer look at the hole",
    category: "Techniques",
    art: "ice",
    featured: true,
    description: "A vertical stock clip showing an angler fishing through a hole at twilight.",
    video: stockBase + "6831472/6831472-sd_360_640_25fps.mp4",
    source: "https://www.pexels.com/video/a-person-fishing-in-the-ice-6831472/"
  },
  {
    id: "walking-out",
    title: "A morning on the lake",
    category: "On the ice",
    art: "light",
    photo: "https://picsum.photos/id/1036/720/405.webp",
    description: "Stock footage of two people out on a frozen lake in winter. The library cover is a placeholder photo.",
    video: stockBase + "6830930/6830930-sd_640_360_25fps.mp4",
    source: "https://www.pexels.com/video/people-walking-on-a-frozen-lake-6830930/"
  }
];

const library = document.querySelector("#video-grid");
const featured = document.querySelector("#featured-grid");
const filters = document.querySelector(".filters");
const libraryStatus = document.querySelector("#library-status");
const byId = new Map(episodes.map((episode) => [episode.id, episode]));

function makeEpisode(episode) {
  const article = document.createElement("article");
  article.className = "episode";
  const link = document.createElement("a");
  link.className = "episode-trigger";
  link.href = episode.source;
  link.dataset.watch = episode.id;
  link.setAttribute("aria-label", "Watch sample video: " + episode.title);
  const art = document.createElement("span");
  art.className = "episode-art";
  art.setAttribute("aria-hidden", "true");
  art.innerHTML = '<svg class="artwork" viewBox="0 0 400 154" preserveAspectRatio="xMidYMid slice"><use/></svg>';
  art.querySelector("use").setAttribute("href", "./assets/scenes.svg#bi-cover-" + episode.art);
  if (episode.photo) {
    const image = document.createElement("img");
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    image.referrerPolicy = "no-referrer";
    image.addEventListener("error", () => image.remove(), { once: true });
    image.src = episode.photo;
    art.append(image);
  }
  const play = document.createElement("span");
  play.className = "play-mark";
  play.innerHTML = '<svg viewBox="0 0 20 20"><path d="m6 3 11 7-11 7z"/></svg>';
  art.append(play);
  const meta = document.createElement("span");
  meta.className = "episode-meta";
  meta.textContent = episode.category + " · Sample";
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
  for (const button of filters.querySelectorAll("button")) {
    button.setAttribute("aria-pressed", String(button.textContent === category));
  }
  libraryStatus.textContent = matches.length + (matches.length === 1 ? " video" : " videos");
}

for (const category of ["All", ...new Set(episodes.map((episode) => episode.category))]) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = category;
  button.addEventListener("click", () => setFilter(category));
  filters.append(button);
}
featured.replaceChildren(...episodes.filter((episode) => episode.featured).map(makeEpisode));
setFilter("All");

const player = document.querySelector("#player");
const video = player.querySelector("video");
const playerTitle = player.querySelector("#player-title");
const playerDescription = player.querySelector("#player-description");
const source = player.querySelector("#player-source");
const playbackError = player.querySelector(".player-error");
let opener;

document.addEventListener("click", (event) => {
  const trigger = event.target.closest("a[data-watch]");
  if (!trigger || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const episode = byId.get(trigger.dataset.watch);
  if (!episode || typeof player.showModal !== "function") return;
  event.preventDefault();
  opener = trigger;
  playerTitle.textContent = episode.title;
  playerDescription.textContent = episode.description;
  source.href = episode.source;
  playbackError.hidden = true;
  player.showModal();
  video.src = episode.video;
  video.play().catch(() => {
    if (player.open && video.error) playbackError.hidden = false;
  });
});
video.addEventListener("error", () => {
  if (player.open && video.hasAttribute("src")) playbackError.hidden = false;
});
player.addEventListener("close", () => {
  video.pause();
  video.removeAttribute("src");
  video.load();
  opener?.focus({ preventScroll: true });
});

const motion = document.querySelector("#motion");
const systemMotion = matchMedia("(prefers-reduced-motion: reduce)");
let reduce = false;
function applyMotionPreference() {
  const reduced = reduce || systemMotion.matches;
  motion.disabled = systemMotion.matches;
  motion.setAttribute("aria-pressed", String(reduced));
  document.body.toggleAttribute("data-reduced", reduced);
}
motion.hidden = false;
motion.addEventListener("click", () => {
  reduce = !reduce;
  applyMotionPreference();
});
systemMotion.addEventListener("change", applyMotionPreference);
applyMotionPreference();

const progress = document.querySelector(".scroll-progress");
let frame = 0;
function requestProgress() {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    const total = document.documentElement.scrollHeight - innerHeight;
    const fraction = total > 0 ? Math.max(0, Math.min(1, scrollY / total)) : 0;
    progress.style.setProperty("--scroll", String(fraction));
  });
}
addEventListener("scroll", requestProgress, { passive: true });
addEventListener("resize", requestProgress);
for (const guide of document.querySelectorAll("details")) guide.addEventListener("toggle", requestProgress);
requestProgress();
