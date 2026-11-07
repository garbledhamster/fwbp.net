const brands = {
  original: ["mark", "Ice fishing, from the hole down.", "#142622"],
  northwoods: ["northwoods", "A day on the ice, from the first hole to the last drop.", "#243329"],
  sonar: ["sonar", "Above the ice. Below the surface.", "#091e2e"],
  icehouse: ["icehouse", "Cold lake. Good company. Let’s fish.", "#1d337d"],
  journal: ["journal", "Videos and field notes from the frozen lake.", "#f4eddb"],
  "after-dark": ["after-dark", "See what’s moving beneath the ice.", "#161320"]
};

const picker = document.querySelector("#brand-style");
const theme = document.querySelector('meta[name="theme-color"]');
const mark = document.querySelector("#brand-mark");
const icon = document.querySelector('link[rel="icon"]');
const tagline = document.querySelector(".intro-line");

function applyStyle() {
  const requested = new URL(location.href).searchParams.get("style");
  const key = Object.hasOwn(brands, requested) ? requested : "original";
  const [asset, line, color] = brands[key];
  document.documentElement.dataset.brand = key;
  picker.value = key;
  const image = "./assets/" + asset + ".svg";
  mark.src = image;
  icon.href = image;
  tagline.textContent = line;
  theme.content = color;
}

picker.addEventListener("change", () => {
  const url = new URL(location.href);
  if (picker.value === "original") url.searchParams.delete("style");
  else url.searchParams.set("style", picker.value);
  history.pushState(null, "", url);
  applyStyle();
});
addEventListener("popstate", applyStyle);
applyStyle();
picker.closest(".brand-picker").hidden = false;
