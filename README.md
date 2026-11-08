# Fishing with Bryan Prokuski

Bryan’s videos, illustrated field notes, and a gallery of his former merch. Northwoods Outfitters opens by default. The **Brand preview** menu keeps the other styles available for comparison.

## Preview and edit

Run `python3 -m http.server 8000 --bind 127.0.0.1` here and open [the local preview](http://127.0.0.1:8000/). The library entries live in `site.js`. To feature a new upload, add its entry there and update the two latest-video links, title and thumbnail in `index.html`.

The logo, banner and product images come from [Bryan’s YouTube channel](https://www.youtube.com/@BryanProkuski) and its [merch shelf](https://www.youtube.com/@BryanProkuski/store). The merch gallery documents designs from the former Spring store. Video players and thumbnails are served by YouTube. The fish guide uses the Minnesota DNR references for [walleye](https://www.dnr.state.mn.us/gofishing/ice-fishing-walleye.html) and [yellow perch](https://www.dnr.state.mn.us/minnaqua/speciesprofile/yellowperch.html).

## Publish a version

1. Make and check edits in the root site files. Commit them on `main`.
2. Run `./gitpush` from this repository. It copies the committed HTML, CSS, scripts and assets to the next numbered folder and pushes both the current site and the snapshot together.
3. Once GitHub Pages finishes deploying, open the printed version URL. Use [fwbp.net](https://fwbp.net/) for the latest site, or send a numbered link such as [v1](https://fwbp.net/v1/index.html) to keep a review tied to one release.

Leave earlier numbered folders alone. Rerunning `./gitpush` after a failed push reuses the prepared snapshot if the site files match. An unchanged site reuses its current version. Numbered releases preserve site files and video IDs. YouTube still controls video and thumbnail availability.
