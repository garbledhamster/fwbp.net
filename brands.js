import { fishProfiles } from "./assets/fish-profiles.js";

import { speciesArt as species } from "./game/species-catalog.mjs";
import { loadProfile } from "./game/profile.mjs?v=campaign-goals";
import { renderSpeciesVideo } from "./game/species-video.mjs";
import { fillSpeciesCard } from "./game/collection.mjs?v=campaign-goals";
import { spriteHref } from "./game/lake-sprites.mjs";

const debris = {
  sprig: ["lake-life", "sprig", "0 0 138 62"],
  bubbles: ["lake-life", "bubbles", "0 0 150 125"],
  silt: ["lake-life", "silt", "0 0 300 180"]
};

const scenes = {
  pike: [
    ["silt", 42, 40, 83, -16, -28, "far"],
    ["muskie", 29, 32, 52, 50, -15, "middle"],
    ["sprig", 15, 77, 15, 56, -31, "middle"],
    ["pike", 66, 70, 61, -46, 24, "near"]
  ],
  perch: [
    ["silt", 50, 36, 80, -9, -44, "far"],
    ["white-bass", 28, 31, 25, 52, -8, "near"],
    ["perch", 73, 66, 23, -48, 14, "near"],
    ["bubbles", 86, 71, 26, -13, -58, "middle"]
  ],
  midwater: [
    ["silt", 45, 42, 72, 12, -33, "far"],
    ["largemouth", 26, 26, 40, 56, -12, "near"],
    ["smallmouth", 73, 53, 41, -56, 18, "near"],
    ["bowfin", 35, 81, 38, 49, 8, "middle"],
    ["sprig", 14, 77, 19, -29, -44, "middle"],
    ["bubbles", 84, 72, 30, 21, -62, "middle"]
  ],
  weeds: [
    ["silt", 45, 40, 73, -5, -36, "far"],
    ["sprig", 61, 31, 19, -46, -22, "far"],
    ["bluegill", 71, "start", 24, -32, 5, "middle"],
    ["pumpkinseed", 31, "end", 23, 34, -5, "near"],
    ["sprig", 12, 69, 19, 47, -36, "near"],
    ["bubbles", 87, 66, 26, -18, -53, "middle"]
  ],
  camera: [
    ["silt", 48, 40, 82, -38, -65, "middle"],
    ["silt", 61, 59, 89, 28, -26, "near"],
    ["rock-bass", 28, 28, 26, 53, 8, "near"],
    ["black-crappie", 70, 68, 27, -54, 17, "near"],
    ["sprig", 76, 71, 19, 19, -56, "middle"]
  ],
  coldwater: [
    ["silt", 42, 24, 88, 19, -32, "far"],
    ["rainbow-trout", 62, 22, 42, -63, 16, "near"],
    ["brown-trout", 25, 37, 37, 52, -12, "middle"],
    ["brook-trout", 42, 62, 33, 53, 10, "near"],
    ["lake-trout", 75, 79, 42, -48, 14, "middle"],
    ["bubbles", 87, 57, 28, 8, -55, "far"]
  ],
  library: [
    ["chinook", 27, "start", 30, 34, 5, "near"],
    ["walleye", 76, "end", 27, -36, -5, "near"],
    ["silt", 53, 64, 80, -12, -30, "far"]
  ],
  "library-water": [
    ["perch", 28, "start", 22, 34, 4, "near"]
  ],
  "field-notes": [
    ["perch", 36, "start", 21, 34, 4, "near"],
    ["black-crappie", 72, "end", 22, -32, -5, "middle"]
  ],
  merch: [
    ["quillback", 26, "start", 24, 36, 4, "near"],
    ["redhorse", 70, "end", 25, -36, -5, "near"]
  ],
  bottomfish: [
    ["silt", 48, 34, 92, 15, -43, "far"],
    ["sturgeon", 43, 22, 65, -59, 16, "near"],
    ["carp", 73, 51, 44, -50, 18, "middle"],
    ["catfish", 29, 79, 45, 57, 13, "near"],
    ["bubbles", 86, 41, 27, -13, -38, "far"]
  ],
  lakebed: [
    ["silt", 48, 48, 80, 12, -52, "middle"],
    ["bubbles", 88, 54, 24, 12, -60, "far"]
  ],
  "lakebed-feature": [
    ["bullhead", 76, "start", 25, -35, 5, "near"]
  ]
};

const svgNamespace = "http://www.w3.org/2000/svg";

function makeActor([kind, x, y, size, travelX, travelY, layer]) {
  const fish = species[kind];
  const [sheet, symbol, viewBox] = fish ?? debris[kind];
  const actor = document.createElement(fish ? "button" : "div");
  actor.className = "dive-actor";
  actor.dataset.layer = layer;
  actor.style.left = x + "%";
  if (typeof y === "number") {
    actor.style.top = y + "%";
  } else {
    actor.dataset.waterEdge = y;
  }
  actor.style.setProperty("--size", size + "%");
  actor.style.setProperty("--swim-x", travelX + "%");
  actor.style.setProperty("--swim-y", travelY + "px");

  const svg = document.createElementNS(svgNamespace, "svg");
  svg.setAttribute("viewBox", viewBox);
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS(svgNamespace, "use");
  use.setAttribute("href", spriteHref(sheet, symbol));
  if (fish) {
    actor.classList.add("fish-target");
    actor.type = "button";
    actor.disabled = true;
    actor.dataset.fish = kind;
    actor.setAttribute("aria-label", fishProfiles[kind].name);
    actor.setAttribute("aria-haspopup", "dialog");
    svg.classList.toggle("dive-facing-right", travelX > 0);
  }
  svg.append(use);
  actor.append(svg);
  return actor;
}

for (const row of document.querySelectorAll("[data-dive]")) {
  row.querySelector(".dive-actors").append(...scenes[row.dataset.dive].map(makeActor));
}

// Older links on the unversioned homepage can still jump to their scene.
const requested = new URL(location.href).searchParams.get("dive");
if (location.hash === "#dive" && ["perch", "weeds", "rocks", "camera"].includes(requested)) {
  document.getElementById(requested).scrollIntoView();
}

const guideToggle = document.querySelector("#fish-guide-toggle");
const guideLabel = guideToggle.querySelector(".brand-mode");
const guideHint = document.querySelector(".fish-mode-hint");
const navigation = document.querySelector(".mast nav");
const overlayLink = document.querySelector(".footer-lure");
const habitatLayers = document.querySelectorAll(".dive-water, .lakebed-art");
const targets = document.querySelectorAll(".fish-target");
const fishCard = document.querySelector("#fish-card");
let cardOpener;
let guideGeneration = 0;
let collection;

async function setFishGuide(active) {
  const current = ++guideGeneration;
  document.body.toggleAttribute("data-fish-mode", active);
  guideToggle.setAttribute("aria-pressed", String(active));
  guideLabel.textContent = active ? "Exit Your Lake" : "Your Lake";
  guideHint.hidden = !active;
  navigation.hidden = active;
  overlayLink.inert = active;
  for (const layer of habitatLayers) layer.setAttribute("aria-hidden", String(!active));
  for (const target of targets) {
    target.disabled = true;
    target.hidden = active;
  }
  if (!active) return;
  guideHint.innerHTML = '<img src="./assets/branding/bryan-front-facing.webp" alt="Bryan" width="44" height="44"><span>Opening your saved lake…</span>';
  try {
    collection = await loadProfile();
    if (current !== guideGeneration) return;
    guideHint.querySelector('span').textContent = `${collection.caughtSpecies.length} / 6 species. Land fish in Campaign or Practice, then tap a caught fish to learn its lure tip.`;
    const first = [...targets].find(target => collection.caughtSpecies.includes(target.dataset.fish));
    if (first) {
      const link = document.createElement('a');
      link.href = '#';
      link.textContent = 'First caught fish';
      link.addEventListener('click', event => {
        event.preventDefault();
        first.scrollIntoView({ block: 'center' });
        first.focus({ preventScroll: true });
      });
      guideHint.append(link);
    }
    for (const target of targets) {
      const caught = collection.caughtSpecies.includes(target.dataset.fish);
      target.hidden = !caught;
      target.disabled = !caught;
    }
  } catch {
    if (current !== guideGeneration) return;
    guideHint.querySelector('span').textContent = 'Couldn’t open your saved lake.';
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = 'Try again';
    retry.addEventListener('click', () => setFishGuide(true));
    guideHint.append(retry);
  }
}

guideToggle.disabled = false;
guideToggle.setAttribute("aria-label", "Fishing with Bryan, Your Lake");
guideLabel.textContent = "Your Lake";
guideToggle.addEventListener("click", () => {
  setFishGuide(!document.body.hasAttribute("data-fish-mode"));
});

document.addEventListener("click", event => {
  const trigger = event.target.closest(".fish-target");
  if (!trigger || trigger.disabled || fishCard.open) return;

  const key = trigger.dataset.fish;
  cardOpener = trigger;
  const frame = fishCard.querySelector('.fish-card-frame');
  frame.innerHTML = '<div class="collection-top"><form method="dialog"><button class="close" aria-label="Close fish card" autofocus>Close</button></form></div><div data-species-card></div>';
  fillSpeciesCard(frame.querySelector('[data-species-card]'), key, {
    profile: collection,
    onChange: profile => { collection = profile; },
    onVideo: renderSpeciesVideo,
  });
  const title = frame.querySelector('h2');
  title.id = 'fish-card-name';
  document.body.setAttribute("data-fish-paused", "");
  fishCard.showModal();
});

fishCard.addEventListener("close", () => {
  document.body.removeAttribute("data-fish-paused");
  cardOpener?.focus({preventScroll: true});
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !fishCard.open && document.body.hasAttribute("data-fish-mode")) {
    setFishGuide(false);
    guideToggle.focus({preventScroll: true});
  }
});
