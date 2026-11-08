# Fishing with Bryan Prokuski

Bryan’s videos, illustrated field notes, and a gallery of his former merch. Northwoods Outfitters is the site design. The fish share one continuous underwater backdrop, with bubbles, silt, and plant fragments drifting behind the content. Use **Reduce motion** in the footer to hold the illustrations still.

## Preview and edit

Run `python3 -m http.server 8000 --bind 127.0.0.1` here and open [the local preview](http://127.0.0.1:8000/). The library entries live in `site.js`. To feature a new upload, add its entry there and update the two latest-video links, title and thumbnail in `index.html`.

The logo, banner and product images come from [Bryan’s YouTube channel](https://www.youtube.com/@BryanProkuski) and its [merch shelf](https://www.youtube.com/@BryanProkuski/store). The merch gallery documents designs from the former Spring store. Video players and thumbnails are served by YouTube. The fish guide uses the Minnesota DNR references for [walleye](https://www.dnr.state.mn.us/gofishing/ice-fishing-walleye.html) and [yellow perch](https://www.dnr.state.mn.us/minnaqua/speciesprofile/yellowperch.html).

The dive uses original SVG illustrations. Species and habitat references come from the Minnesota DNR’s [Mille Lacs Lake overview](https://www.dnr.state.mn.us/millelacslake/index.html), [yellow perch guide](https://www.dnr.state.mn.us/gofishing/ice-fishing-perch.html), [coontail profile](https://www.dnr.state.mn.us/aquatic_plants/submerged_plants/coontail.html), and [freshwater habitats overview](https://www.dnr.state.mn.us/whaf/about/5-component/habitats.html).

The 23 fish illustrations combine subjects from Bryan’s lake, river, and Great Lakes videos with white bass from local rivers. Common carp, channel catfish, black bullhead, and golden redhorse represent groups Bryan names in his uploads. The drawings use the [Minnesota fish identification guide](https://files.dnr.state.mn.us/recreation/fishing/fin/fish_id_placemat.pdf), [Minnesota DNR white bass profile](https://www.dnr.state.mn.us/fish/whitebass/index.html), [Minnesota trout and salmon guide](https://www.dnr.state.mn.us/fishing/trout/northshore.html), and agency profiles for [quillback](https://mdc.mo.gov/fishing/species/carpsucker-quillback) and [Chinook salmon](https://www.michigan.gov/dnr/education/michigan-species/fish-species/chinook-salmon).

Tap **Fishing with Bryan** in the sticky header to open the fish guide. The page content hides in place so you can select the fish swimming behind it. Opening a card pauses the water motion. Close the card to keep exploring, and tap Bryan again to restore the page content. Identification and habitat text lives in `assets/fish-profiles.js`.

The lakebed footer uses foreground growth, a distant ridge and two of Bryan’s underwater videos. A pike swims toward the lure as the visitor reaches the bottom. The fishing line ends with a bobber and a red-and-white spoon that links to [Bryan’s Dardevle Short](https://www.youtube.com/shorts/kgUSasaMays). The lure illustration references [Eppinger’s design history](https://dardevle.com/ourtradition/).

The lakebed moves decorative layers with [CSS transforms](https://web.dev/articles/animations-guide) and honors [reduced motion](https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions).

## Fishing game

Choose **Play fishing game** from the hero to fish beneath the ice. See the [game design and deployment notes](docs/fishing-game.md) for rules, lake sources and ranked setup.

## Publish a version

1. Make and check edits in the root site files. Commit them on `main`.
2. Run `./gitpush` from this repository. It copies the committed HTML, CSS, scripts and assets to the next numbered folder and pushes both the current site and the snapshot together.
3. Once GitHub Pages finishes deploying, open the printed version URL. Use [fwbp.net](https://fwbp.net/) for the latest site, or send a numbered link such as [v1](https://fwbp.net/v1/index.html) to keep a review tied to one release.

Leave earlier numbered folders alone. Rerunning `./gitpush` after a failed push reuses the prepared snapshot if the site files match. An unchanged site reuses its current version. Numbered releases preserve site files and video IDs. YouTube still controls video and thumbnail availability.
