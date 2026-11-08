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
  northwoods: {
    caption: "A northern pike crosses beneath the ice while perch school above the weeds and a crayfish keeps to the bottom.",
    actors: [
      ["silt", 42, 39, 75, 12, -48, "far"],
      ["weeds", 8, 68, 24, 10, 28, "middle"],
      ["stones", 77, 78, 38, 16, 36, "middle"],
      ["perch", 22, 41, 15, 125, 13, "middle"],
      ["perch", 34, 48, 12, 142, 4, "far"],
      ["walleye", 67, 57, 34, -108, 24, "middle"],
      ["pike", 62, 34, 58, -134, 32, "near"],
      ["crayfish", 70, 71, 21, -42, 20, "near"]
    ]
  },
  pike: {
    caption: "A northern pike glides close, with a second fish farther back in the beam.",
    actors: [
      ["silt", 42, 40, 83, -16, -28, "far"],
      ["pike", 31, 32, 39, 74, -21, "far"],
      ["perch", 75, 52, 14, -172, 28, "middle"],
      ["weeds", 9, 73, 27, 7, 26, "middle"],
      ["pike", 62, 51, 75, -168, 47, "near"]
    ]
  },
  perch: {
    caption: "A school of yellow perch crosses the light in loose formation. The small fish are farther back.",
    actors: [
      ["silt", 50, 36, 80, -9, -44, "far"],
      ["perch", 20, 44, 16, 120, -18, "far"],
      ["perch", 45, 35, 13, 144, -9, "far"],
      ["perch", 66, 40, 18, 105, 15, "middle"],
      ["perch", 27, 53, 19, 144, 4, "middle"],
      ["perch", 46, 60, 23, 130, -7, "near"],
      ["perch", 72, 55, 21, 124, 23, "near"],
      ["perch", 31, 69, 16, 170, 36, "middle"],
      ["weeds", 86, 71, 23, -11, 30, "middle"]
    ]
  },
  rocks: {
    caption: "A crayfish works along the rocks while a smallmouth and a walleye pass higher in the water.",
    actors: [
      ["silt", 45, 42, 72, 12, -33, "far"],
      ["walleye", 29, 36, 29, 80, 14, "far"],
      ["bass", 62, 49, 43, -113, 27, "middle"],
      ["stones", 76, 70, 48, 14, 34, "middle"],
      ["stones", 13, 76, 48, -13, 62, "near"],
      ["crayfish", 48, 70, 33, -96, 43, "near"],
      ["crayfish", 84, 69, 14, -43, 28, "middle"]
    ]
  },
  weeds: {
    caption: "Look between the coontail stems for perch and the shape of a pike sliding out from cover.",
    actors: [
      ["silt", 45, 40, 73, -5, -36, "far"],
      ["weeds", 62, 63, 36, -5, 12, "far"],
      ["pike", 66, 45, 62, -109, 22, "middle"],
      ["perch", 30, 36, 15, 91, -20, "middle"],
      ["perch", 39, 46, 18, 105, 19, "middle"],
      ["weeds", 4, 69, 38, 9, 37, "near"],
      ["weeds", 89, 68, 36, -12, 51, "near"]
    ]
  },
  camera: {
    caption: "A camera-style frame catches walleye and perch moving through the beam, with silt drifting past the lens.",
    actors: [
      ["silt", 48, 40, 82, -38, -65, "middle"],
      ["silt", 61, 59, 89, 28, -26, "near"],
      ["walleye", 65, 42, 51, -142, 39, "near"],
      ["perch", 33, 58, 17, 121, 10, "middle"],
      ["perch", 51, 68, 12, 150, 9, "far"],
      ["stones", 62, 76, 49, 4, 44, "middle"]
    ]
  }
};

const picker = document.querySelector("#dive-select");
const stage = document.querySelector("#dive");
const title = stage.querySelector("h2");
const caption = stage.querySelector(".dive-caption");
const actors = stage.querySelector(".dive-actors");
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
  if (travelX > 0 && ["pike", "perch", "walleye", "bass"].includes(kind)) {
    svg.classList.add("dive-facing-right");
  }
  svg.append(use);
  actor.append(svg);
  return actor;
}

function showScene() {
  const requested = new URL(location.href).searchParams.get("dive");
  const key = Object.hasOwn(scenes, requested) ? requested : "northwoods";
  stage.dataset.dive = key;
  picker.value = key;
  title.textContent = key === "northwoods" ? "Beneath the ice" : picker.selectedOptions[0].textContent;
  caption.textContent = scenes[key].caption;
  actors.replaceChildren(...scenes[key].actors.map(makeActor));
}

picker.addEventListener("change", () => {
  const url = new URL(location.href);
  if (picker.value === "northwoods") url.searchParams.delete("dive");
  else url.searchParams.set("dive", picker.value);
  history.pushState(null, "", url);
  showScene();
  stage.scrollIntoView({block:"start"});
});
addEventListener("popstate", showScene);
showScene();
picker.closest(".dive-picker").hidden = false;
