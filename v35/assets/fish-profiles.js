const dnr = "https://www.dnr.state.mn.us";
const sunfish = dnr + "/fish/sunfish/biology.html";
const trout = dnr + "/fishing/trout/northshore.html";

export const fishProfiles = {
  pike: {
    name: "Northern pike", family: "Pike family",
    feature: "Look for pale oval spots on an olive body, a duckbill snout, and rounded tail tips.",
    habitat: "Shallow bays and weed edges in Minnesota lakes. Vegetation gives pike cover to ambush smaller fish.",
    source: dnr + "/minnaqua/speciesprofile/northern_pike.html"
  },
  perch: {
    name: "Yellow perch", family: "Perch family",
    feature: "A gold flank with dark vertical bars and orange lower fins.",
    habitat: "Lakes, backwaters, and slow pools across Minnesota. Bryan films schools beneath the ice on Mille Lacs.",
    source: dnr + "/minnaqua/speciesprofile/yellowperch.html"
  },
  walleye: {
    name: "Walleye", family: "Perch family",
    feature: "Look for a reflective eye, a dark patch on the first dorsal fin, and a white lower tail tip.",
    habitat: "Lakes and rivers across Minnesota, including Mille Lacs. They move between shallow feeding areas and deeper water.",
    source: dnr + "/fish/walleye/index.html"
  },
  smallmouth: {
    name: "Smallmouth bass", family: "Sunfish family",
    feature: "A bronze flank with vertical bars. The upper jaw reaches about the middle of the eye.",
    habitat: "Rocky shorelines and clear rivers and lakes. Bryan fishes for them from his kayak on the Upper Mississippi.",
    source: dnr + "/gofishing/how-catch-smallmouth-bass.html"
  },
  largemouth: {
    name: "Largemouth bass", family: "Sunfish family",
    feature: "The upper jaw reaches behind the eye, and a dark band runs across the green flank.",
    habitat: "Vegetated bays, shallow lakes, and river backwaters. Look for submerged weeds or cover near shore.",
    source: dnr + "/minnaqua/speciesprofile/largemouthbass.html"
  },
  "white-bass": {
    name: "White bass", family: "Temperate bass family",
    feature: "A silvery body with dark horizontal stripes, a forked tail, and two separate dorsal fins.",
    habitat: "Minnesota’s lower Mississippi and St. Croix rivers, the Minnesota River, and some southern lakes.",
    source: dnr + "/fish/whitebass/index.html",
    note: "A regional fish included in the artwork."
  },
  "rock-bass": {
    name: "Rock bass", family: "Sunfish family",
    feature: "A red eye, dark mottled rows, and six spines along the front of the anal fin.",
    habitat: "Rocky lake margins and clear streams. They often stay close to stones, wood, or other cover.",
    source: "https://mdc.mo.gov/discover-nature/field-guide/northern-rock-bass"
  },
  bluegill: {
    name: "Bluegill", family: "Sunfish family",
    feature: "Look for a dark gill flap, blue tones on the cheek, and a dark spot near the rear dorsal fin.",
    habitat: "Weedy bays, ponds, and quiet river backwaters. In spring, bluegills gather over shallow spawning beds.",
    source: sunfish
  },
  pumpkinseed: {
    name: "Pumpkinseed", family: "Sunfish family",
    feature: "A red-orange spot on the black gill flap and turquoise lines across the cheek.",
    habitat: "Shallow, vegetated lake margins and slow streams, often in the same cover as bluegill.",
    source: sunfish
  },
  "black-crappie": {
    name: "Black crappie", family: "Sunfish family",
    feature: "Irregular dark flecks on a silvery flank and seven or eight dorsal spines.",
    habitat: "Quiet lakes and backwaters with vegetation or submerged wood. They move shallow to spawn in spring.",
    source: "https://www.ontario.ca/page/black-crappie"
  },
  muskie: {
    name: "Muskellunge", family: "Pike family",
    feature: "A long duckbill snout, dark bars on a lighter flank, and pointed tail lobes.",
    habitat: "Weed edges, rocky points, and reefs in some Minnesota lakes and rivers, including Mille Lacs.",
    source: dnr + "/gofishing/how-catch-muskellunge.html"
  },
  sturgeon: {
    name: "Lake sturgeon", family: "Sturgeon family",
    feature: "Bony plates along the body, barbels beneath the snout, and a tail with a longer upper lobe.",
    habitat: "Large lakes and rivers, including the St. Croix. They search the bottom for small invertebrates.",
    source: "https://dnr.wisconsin.gov/topic/Fishing/sturgeon/LakeSturgeon.html"
  },
  quillback: {
    name: "Quillback", family: "Sucker family",
    feature: "A deep, silver body with a tall, backward-swept dorsal fin and a small downturned mouth.",
    habitat: "Larger rivers and reservoirs. Bryan caught his first in Mississippi River Pool 2.",
    source: "https://mdc.mo.gov/discover-nature/field-guide/quillback"
  },
  bowfin: {
    name: "Bowfin", family: "Bowfin family",
    feature: "A long dorsal fin runs along most of the back. Males often show a dark spot by the tail.",
    habitat: "Vegetated lakes and slow streams throughout much of Minnesota. Bryan calls it a dogfish.",
    source: dnr + "/fish/bowfin.html"
  },
  carp: {
    name: "Common carp", family: "Minnow family",
    feature: "Large overlapping scales, a long dorsal fin, and small barbels at the mouth.",
    habitat: "Warm lakes, rivers, and backwaters. Carp often feed close to the bottom in shallow water.",
    source: dnr + "/invasives/aquaticanimals/commoncarp/index.html",
    note: "Represents the carp Bryan names on his channel."
  },
  catfish: {
    name: "Channel catfish", family: "Catfish family",
    feature: "Whisker-like barbels, a smooth gray flank, and a deeply forked tail.",
    habitat: "Large rivers and some lakes, including parts of the Mississippi and lower St. Croix.",
    source: dnr + "/minnaqua/speciesprofile/channelcatfish.html",
    note: "Represents the catfish Bryan names on his channel."
  },
  bullhead: {
    name: "Black bullhead", family: "Catfish family",
    feature: "Dark barbels and a blunt tail with a pale band at its base.",
    habitat: "Warm ponds, shallow lakes, and slow water with soft bottoms.",
    source: dnr + "/minnaqua/speciesprofile/bullheads.html",
    note: "Represents the bullhead Bryan names in his Short."
  },
  redhorse: {
    name: "Golden redhorse", family: "Sucker family",
    feature: "Gold or bronze scales, a downturned mouth, and a slate-colored tail.",
    habitat: "Streams and rivers with moderate current and sand, gravel, or rocky bottoms.",
    source: "https://mdc.mo.gov/discover-nature/field-guide/golden-redhorse",
    note: "Represents the redhorse group Bryan tags on his channel."
  },
  "rainbow-trout": {
    name: "Rainbow trout", family: "Trout and salmon family",
    feature: "A pink band on a silvery flank, with small dark spots that extend onto the tail.",
    habitat: "Cold streams and lakes, including stocked Minnesota waters and Lake Superior tributaries.",
    source: trout
  },
  "brown-trout": {
    name: "Brown trout", family: "Trout and salmon family",
    feature: "Gold-brown sides with dark spots and red spots ringed in pale color. The tail is nearly square.",
    habitat: "Cold streams, including southeastern Minnesota trout country and Wisconsin’s Kinnickinnic River.",
    source: trout
  },
  "brook-trout": {
    name: "Brook trout", family: "Trout and salmon family",
    feature: "Wormlike marks on the back, red spots with blue halos, and white leading edges on lower fins.",
    habitat: "Cold, clear streams and lakes. In Minnesota, brook trout live in some North Shore tributaries.",
    source: trout
  },
  "lake-trout": {
    name: "Lake trout", family: "Trout and salmon family",
    feature: "Pale spots on a darker body and a deeply forked tail.",
    habitat: "Deep, cold lakes, including Lake Superior and some northern Minnesota inland lakes.",
    source: trout
  },
  chinook: {
    name: "Chinook salmon", family: "Trout and salmon family",
    feature: "Dark gums and small dark spots on both tail lobes. Bryan calls it king salmon.",
    habitat: "Cold Great Lakes water, including Lake Michigan, where Bryan caught his first king.",
    source: "https://dnr.wisconsin.gov/sites/default/files/topic/Species_chinooksalmon.pdf"
  }
};
