const episodes = [
  {
    id: "3dmUMd9oR88",
    title: "Five of Diamonds for northern pike and bass",
    category: "Underwater",
    art: "ice",
    description: "Bryan fishes a Five of Diamonds spoon through the ice with an underwater camera."
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
  }
];

function watchUrl(id) {
  return "https://www.youtube.com/watch?v=" + id;
}

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
  link.href = watchUrl(episode.id);
  link.dataset.watch = episode.id;
  link.setAttribute("aria-label", "Watch " + episode.title);
  const art = document.createElement("span");
  art.className = "episode-art";
  art.setAttribute("aria-hidden", "true");
  art.innerHTML = '<svg class="artwork" viewBox="0 0 400 154" preserveAspectRatio="xMidYMid slice"><use/></svg>';
  art.querySelector("use").setAttribute("href", "./assets/scenes.svg#bi-cover-" + episode.art);
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
const videoSlot = player.querySelector("#player-video");
const playerTitle = player.querySelector("#player-title");
const playerDescription = player.querySelector("#player-description");
const source = player.querySelector("#player-source");
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
  source.href = watchUrl(episode.id);
  const frame = document.createElement("iframe");
  frame.title = episode.title;
  frame.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
  frame.referrerPolicy = "strict-origin-when-cross-origin";
  frame.src = "https://www.youtube-nocookie.com/embed/" + episode.id + "?autoplay=1&playsinline=1&rel=0";
  player.showModal();
  videoSlot.replaceChildren(frame);
});
player.addEventListener("close", () => {
  videoSlot.replaceChildren();
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

const lure = document.querySelector(".footer-lure");

function updateDepth(remaining) {
  if (reduce || systemMotion.matches) return;

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
