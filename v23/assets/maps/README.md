# Mille Lacs game map

Shoreline and bathymetric contours: © Minnesota Department of Natural Resources. Lake ID **48000200**, queried November 9, 2026 from the [DNR Lake Bathymetry service](https://enterprise.gisdata.mn.gov/aghost/rest/services/us_mn_state_dnr/water_lake_bathymetry/MapServer), outline layer 1 and contour layer 0. Coordinate reference: NAD83 / UTM zone 15N (EPSG:26915).

The [DNR General Data and Software License Agreement](https://www.dnr.state.mn.us/sitetools/data_software_license.html) allows derivative works and requires acknowledgement of MNDNR's contribution. It prohibits redistributing the source dataset in its entirety. These files are a simplified, single-lake game derivative, not a redistribution of the statewide dataset. MNDNR retains ownership of the source data. The game does not use the agency's logo or imply endorsement. Data is provided as is, without warranty. Geographic data is for reference, not navigation or legal access.

`mille-lacs.svg` is original SVG game art over the simplified outline and contours. `game/lake-map-data.mjs` contains the matching drawing coordinates and 16 playable cells. `tools/build-lake-map.py` rebuilds both with Python and Shapely. It queries only this lake, rejects truncated query responses, simplifies shoreline by 55 meters and contours by 70 meters, and maps both to the same 500 × 500 view box. Cell centers outside the outline are excluded. Cell depth is the nearest sourced contour's absolute depth in feet, with a minimum gameplay depth of 5 ft. It is an approximation within a game cell, not a sounding at that location.

Habitat categories, temperature, fish likelihood, cell permits and encounter weights are gameplay estimates. Temperature is modeled from depth. The map and rules need no live mapping request. The forest pattern, colors, north marker and selection UI are original game artwork. The drilling scene reuses the existing Bryan Field Comic portrait and dawn lake art with an original SVG hand auger.

To rebuild from the site checkout:

```sh
python3 -m venv work/map-tools
work/map-tools/bin/pip install shapely
work/map-tools/bin/python tools/build-lake-map.py
```
