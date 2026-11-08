const brands = {
  original: ["Ice fishing, from the hole down.", "#142622"],
  northwoods: ["Minnesota fishing from the kayak to the ice hole.", "#243329"],
  sonar: ["Above the ice. Below the surface.", "#091e2e"],
  icehouse: ["Cold lake. Good company. Let’s fish.", "#1d337d"],
  journal: ["Videos and field notes from the frozen lake.", "#f4eddb"],
  "after-dark": ["See what’s moving beneath the ice.", "#161320"]
};

const picker = document.querySelector("#brand-style");
const theme = document.querySelector('meta[name="theme-color"]');
const tagline = document.querySelector(".intro-line");

function applyStyle() {
  const requested = new URL(location.href).searchParams.get("style");
  const key = Object.hasOwn(brands, requested) ? requested : "northwoods";
  const [line, color] = brands[key];
  document.documentElement.dataset.brand = key;
  picker.value = key;
  tagline.textContent = line;
  theme.content = color;
}

picker.addEventListener("change", () => {
  const url = new URL(location.href);
  if (picker.value === "northwoods") url.searchParams.delete("style");
  else url.searchParams.set("style", picker.value);
  history.pushState(null, "", url);
  applyStyle();
});
addEventListener("popstate", applyStyle);
applyStyle();
picker.closest(".brand-picker").hidden = false;
