import { fishProfiles } from "./assets/fish-profiles.js";

const species = {
  pike: ["lake-life", "pike", "0 0 230 72"],
  perch: ["scenes", "bi-perch", "0 0 172 66"],
  walleye: ["scenes", "bi-walleye", "0 0 172 66"],
  smallmouth: ["lake-life", "bass", "0 0 172 80"],
  "largemouth": ["fish", "largemouth", "0 0 195 80"],
  "white-bass": ["fish", "white-bass", "0 0 181 80"],
  "rock-bass": ["fish", "rock-bass", "0 0 160 92"],
  "bluegill": ["fish", "bluegill", "0 0 150 92"],
  "pumpkinseed": ["fish", "pumpkinseed", "0 0 151 94"],
  "black-crappie": ["fish", "black-crappie", "0 0 169 86"],
  "muskie": ["fish", "muskie", "0 0 245 72"],
  "rainbow-trout": ["fish", "rainbow-trout", "0 0 222 76"],
  "brown-trout": ["fish", "brown-trout", "0 0 222 76"],
  "brook-trout": ["fish", "brook-trout", "0 0 222 76"],
  "lake-trout": ["fish", "lake-trout", "0 0 222 76"],
  "chinook": ["fish", "chinook", "0 0 248 83"],
  "sturgeon": ["fish", "sturgeon", "0 0 264 82"],
  "quillback": ["fish", "quillback", "0 0 199 90"],
  "bowfin": ["fish", "bowfin", "0 0 225 81"],
  "carp": ["fish", "carp", "0 0 209 91"],
  "catfish": ["fish", "catfish", "0 0 223 85"],
  "bullhead": ["fish", "bullhead", "0 0 184 84"],
  "redhorse": ["fish", "redhorse", "0 0 215 79"],
};

const debris = {
  sprig: ["lake-life", "sprig", "0 0 138 62"],
  bubbles: ["lake-life", "bubbles", "0 0 150 125"],
  silt: ["lake-life", "silt", "0 0 300 180"]
};

const scenes = {
  pike: [
    ["silt", 42, 40, 83, -16, -28, "far"],
    ["muskie", 31, 30, 54, 85, -19, "middle"],
    ["sprig", 15, 77, 15, 56, -31, "middle"],
    ["pike", 62, 68, 75, -145, 95, "near"]
  ],
  perch: [
    ["silt", 50, 36, 80, -9, -44, "far"],
    ["white-bass", 36, 34, 20, 96, -2, "near"],
    ["perch", 72, 55, 21, 124, 23, "near"],
    ["bubbles", 86, 71, 26, -13, -58, "middle"]
  ],
  midwater: [
    ["silt", 45, 42, 72, 12, -33, "far"],
    ["walleye", 22, 57, 26, 80, 14, "far"],
    ["smallmouth", 67, 49, 41, -113, 27, "near"],
    ["bowfin", 70, 74, 45, -95, 64, "middle"],
    ["sprig", 14, 77, 19, -29, -44, "middle"],
    ["bubbles", 84, 72, 30, 21, -62, "middle"]
  ],
  weeds: [
    ["silt", 45, 40, 73, -5, -36, "far"],
    ["sprig", 61, 31, 19, -46, -22, "far"],
    ["largemouth", 73, "start", 29, -42, 5, "near"],
    ["bluegill", 20, 43, 23, 52, -12, "middle"],
    ["pumpkinseed", 34, 71, 21, 64, 12, "near"],
    ["sprig", 12, 69, 19, 47, -36, "near"],
    ["bubbles", 87, 66, 26, -18, -53, "middle"]
  ],
  camera: [
    ["silt", 48, 40, 82, -38, -65, "middle"],
    ["silt", 61, 59, 89, 28, -26, "near"],
    ["rock-bass", 26, 24, 26, 105, 10, "near"],
    ["black-crappie", 65, 64, 27, -95, 23, "near"],
    ["sprig", 76, 71, 19, 19, -56, "middle"]
  ],
  coldwater: [
    ["silt", 42, 24, 88, 19, -32, "far"],
    ["rainbow-trout", 61, 25, 42, -99, 18, "near"],
    ["brown-trout", 24, 41, 37, 94, -14, "middle"],
    ["brook-trout", 43, 51, 33, 120, 11, "near"],
    ["lake-trout", 74, 65, 47, -89, 37, "middle"],
    ["bubbles", 87, 57, 28, 8, -55, "far"]
  ],
  library: [
    ["chinook", 74, "start", 29, -42, 4, "near"],
    ["walleye", 26, "end", 23, 36, 4, "middle"],
    ["silt", 53, 64, 80, -12, -30, "far"]
  ],
  "library-water": [
    ["perch", 28, "start", 22, 34, 4, "near"]
  ],
  "field-notes": [
    ["perch", 74, "start", 22, -35, 4, "near"],
    ["black-crappie", 26, "end", 21, 34, -4, "middle"]
  ],
  merch: [
    ["quillback", 75, "start", 24, -36, -4, "near"],
    ["redhorse", 37, "end", 23, 36, 4, "middle"]
  ],
  bottomfish: [
    ["silt", 48, 34, 92, 15, -43, "far"],
    ["sturgeon", 58, 25, 66, -64, 17, "near"],
    ["carp", 71, 69, 47, -102, 28, "middle"],
    ["catfish", 35, 81, 45, 105, 35, "near"],
    ["bubbles", 86, 41, 27, -13, -38, "far"]
  ],
  lakebed: [
    ["silt", 48, 48, 80, 12, -52, "middle"],
    ["bubbles", 88, 54, 24, 12, -60, "far"]
  ],
  "lakebed-feature": [
    ["bullhead", 74, "start", 24, -35, 4, "near"]
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
  use.setAttribute("href", "./assets/" + sheet + ".svg#" + symbol);
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
const cardArt = fishCard.querySelector(".fish-card-art");
const cardTitle = fishCard.querySelector("h2");
const cardFields = Object.fromEntries(
  Array.from(fishCard.querySelectorAll("[data-card]"), field => [field.dataset.card, field])
);
const profileOrder = Object.keys(fishProfiles);
let cardOpener;

function setFishGuide(active) {
  document.body.toggleAttribute("data-fish-mode", active);
  guideToggle.setAttribute("aria-pressed", String(active));
  guideLabel.textContent = active ? "Exit fish guide" : "Fish guide";
  guideHint.hidden = !active;
  navigation.hidden = active;
  overlayLink.inert = active;
  for (const layer of habitatLayers) layer.setAttribute("aria-hidden", String(!active));
  for (const target of targets) target.disabled = !active;
}

guideToggle.disabled = false;
guideToggle.addEventListener("click", () => {
  setFishGuide(!document.body.hasAttribute("data-fish-mode"));
});

document.addEventListener("click", event => {
  const trigger = event.target.closest(".fish-target");
  if (!trigger || trigger.disabled || fishCard.open) return;

  const key = trigger.dataset.fish;
  const profile = fishProfiles[key];
  const [sheet, symbol, viewBox] = species[key];
  cardOpener = trigger;
  cardTitle.textContent = profile.name;
  cardFields.number.textContent = String(profileOrder.indexOf(key) + 1).padStart(2, "0") + " / " + profileOrder.length;
  cardFields.family.textContent = profile.family;
  cardFields.feature.textContent = profile.feature;
  cardFields.habitat.textContent = profile.habitat;
  cardFields.note.hidden = !profile.note;
  cardFields.note.textContent = profile.note ?? "";
  cardFields.source.href = profile.source;
  cardArt.setAttribute("viewBox", viewBox);
  cardArt.querySelector("use").setAttribute("href", "./assets/" + sheet + ".svg#" + symbol);
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
