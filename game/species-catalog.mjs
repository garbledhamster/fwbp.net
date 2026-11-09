import { fishProfiles } from "../assets/fish-profiles.js";
import { lakes, lures } from "./rules.mjs?v=campaign-playtest";

export const speciesArt = {
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

export const collectibleSpecies = lakes["mille-lacs"].fish;
export { fishProfiles };
export function lureTip(id) {
  const fish = collectibleSpecies.find(fish => fish.id === id);
  return fish ? { lure: fish.lure, text: `Try ${lures[fish.lure]} for ${fishProfiles[id].name}.` } : undefined;
}
