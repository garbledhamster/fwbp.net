const species = {
  pike: ["lake-life", "pike", "0 0 230 72"],
  perch: ["scenes", "bi-perch", "0 0 172 66"],
  walleye: ["scenes", "bi-walleye", "0 0 172 66"],
  bass: ["lake-life", "bass", "0 0 172 80"],
  crayfish: ["lake-life", "crayfish", "0 0 150 95"],
  weeds: ["lake-life", "weeds", "0 0 140 180"],
  stones: ["lake-life", "stones", "0 0 220 90"],
  silt: ["lake-life", "silt", "0 0 300 180"]
};

const scenes = {
  pike: [
    ["silt", 42, 40, 83, -16, -28, "far"],
    ["pike", 31, 32, 39, 74, -21, "far"],
    ["perch", 75, 52, 14, -172, 28, "middle"],
    ["weeds", 9, 73, 27, 7, 26, "middle"],
    ["pike", 62, 51, 75, -168, 47, "near"]
  ],
  perch: [
    ["silt", 50, 36, 80, -9, -44, "far"],
    ["perch", 20, 44, 16, 120, -18, "far"],
    ["perch", 45, 35, 13, 144, -9, "far"],
    ["perch", 66, 40, 18, 105, 15, "middle"],
    ["perch", 27, 53, 19, 144, 4, "middle"],
    ["perch", 46, 60, 23, 130, -7, "near"],
    ["perch", 72, 55, 21, 124, 23, "near"],
    ["perch", 31, 69, 16, 170, 36, "middle"],
    ["weeds", 86, 71, 23, -11, 30, "middle"]
  ],
  rocks: [
    ["silt", 45, 42, 72, 12, -33, "far"],
    ["walleye", 29, 36, 29, 80, 14, "far"],
    ["bass", 62, 49, 43, -113, 27, "middle"],
    ["stones", 76, 70, 48, 14, 34, "middle"],
    ["stones", 13, 76, 48, -13, 62, "near"],
    ["crayfish", 48, 70, 33, -96, 43, "near"],
    ["crayfish", 84, 69, 14, -43, 28, "middle"]
  ],
  weeds: [
    ["silt", 45, 40, 73, -5, -36, "far"],
    ["weeds", 62, 63, 36, -5, 12, "far"],
    ["pike", 67, 57, 62, -109, 36, "middle"],
    ["perch", 30, 36, 15, 91, -20, "middle"],
    ["perch", 39, 46, 18, 105, 19, "middle"],
    ["weeds", 4, 69, 38, 9, 37, "near"],
    ["weeds", 89, 68, 36, -12, 51, "near"]
  ],
  camera: [
    ["silt", 48, 40, 82, -38, -65, "middle"],
    ["silt", 61, 59, 89, 28, -26, "near"],
    ["walleye", 66, 55, 51, -142, 45, "near"],
    ["perch", 33, 58, 17, 121, 10, "middle"],
    ["perch", 51, 73, 16, 150, 23, "far"],
    ["stones", 62, 76, 49, 4, 44, "middle"]
  ],
  library: [
    ["walleye", 79, 30, 37, -93, 32, "far"],
    ["perch", 16, 50, 14, 117, 29, "far"],
    ["perch", 30, 56, 11, 146, 15, "far"],
    ["silt", 53, 64, 80, -12, -30, "far"]
  ]
};

const svgNamespace = "http://www.w3.org/2000/svg";

function makeActor([kind, x, y, size, travelX, travelY, layer]) {
  const [sheet, symbol, viewBox] = species[kind];
  const actor = document.createElement("div");
  actor.className = "dive-actor";
  actor.dataset.layer = layer;
  actor.style.left = x + "%";
  actor.style.top = y + "%";
  actor.style.setProperty("--size", size + "%");
  actor.style.setProperty("--swim-x", travelX + "%");
  actor.style.setProperty("--swim-y", travelY + "px");

  const svg = document.createElementNS(svgNamespace, "svg");
  svg.setAttribute("viewBox", viewBox);
  const use = document.createElementNS(svgNamespace, "use");
  use.setAttribute("href", "./assets/" + sheet + ".svg#" + symbol);
  if (["pike", "perch", "walleye", "bass"].includes(kind)) {
    actor.dataset.fish = kind;
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
