"""Build the simplified Mille Lacs game map. Requires Python 3 and Shapely."""

import json
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen

from shapely.geometry import LineString, Point, Polygon

ROOT = Path(__file__).resolve().parents[1]
SERVICE = 'https://enterprise.gisdata.mn.gov/aghost/rest/services/us_mn_state_dnr/water_lake_bathymetry/MapServer'


def fetch(layer):
    params = {
        'f': 'json',
        'where': "dowlknum='48000200'",
        'outFields': '*',
        'returnGeometry': 'true',
        'outSR': 26915,
        'resultRecordCount': 2000,
    }
    with urlopen(f'{SERVICE}/{layer}/query?{urlencode(params)}', timeout=30) as response:
        data = json.load(response)
    if data.get('exceededTransferLimit'):
        raise ValueError('Paginate source before building')
    if not data.get('features'):
        raise ValueError(f'No Mille Lacs features for layer {layer}')
    return data['features']


outline, contours = fetch(1), fetch(0)
rings = [ring for feature in outline for ring in feature['geometry']['rings']]
shape = Polygon(max(rings, key=lambda ring: abs(Polygon(ring).area))).buffer(0)
x0, y0, x1, y1 = shape.bounds
scale = 440 / max(x1 - x0, y1 - y0)


def xy(point):
    return [round(30 + (point[0] - x0) * scale, 1), round(30 + (y1 - point[1]) * scale, 1)]


def path(points, closed=False):
    coords = [','.join(map(str, xy(point))) for point in points]
    return 'M' + 'L'.join(coords) + ('Z' if closed else '')


shore = path(shape.simplify(55).exterior.coords, True)
lines = [
    (abs(feature['attributes']['depth']), LineString(points))
    for feature in contours
    for points in feature['geometry']['paths']
]
contour_art = ''.join(f'<path d="{path(line.simplify(70).coords)}"/>' for _, line in lines)
cells = []
for row in range(5):
    for col in range(5):
        x = x0 + (col + .5) * (x1 - x0) / 5
        y = y1 - (row + .5) * (y1 - y0) / 5
        point = Point(x, y)
        if not shape.contains(point):
            continue
        depth = max(5, int(min(lines, key=lambda entry: entry[1].distance(point))[0]))
        shallow = depth <= 15
        map_x, map_y = xy((x, y))
        cells.append({
            'id': chr(65 + col) + str(row + 1),
            'x': map_x,
            'y': map_y,
            'depthFt': depth,
            'temperatureF': 34 + round(depth / 10),
            'habitat': 'Weed edge' if shallow else 'Reef edge' if depth <= 25 else 'Deep basin',
            'area': 'starter-shore' if shallow else 'deep-reef',
            'likely': ['perch', 'pike', 'rock-bass'] if shallow else ['walleye', 'smallmouth', 'muskie'],
            'weightBonus': {'perch': 8, 'pike': 3} if shallow else {'walleye': 8, 'muskie': 3, 'smallmouth': 3},
        })

if not any(cell['area'] == 'starter-shore' for cell in cells):
    raise ValueError('The normal Campaign entry requires a Starter Shore cell')
cell_data = ',\n'.join('  ' + json.dumps(cell, separators=(',', ':')) for cell in cells)
(ROOT / 'game/lake-map-data.mjs').write_text(
    '// Derived from Minnesota DNR bathymetry. See assets/maps/README.md.\n'
    'export default { cells: [\n' + cell_data + '\n] };\n'
)
svg = (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500">'
    '<defs><pattern id="trees" width="35" height="45" patternUnits="userSpaceOnUse">'
    '<path d="M17 2L4 27H11L2 38H32L23 27H30Z" fill="#173f45" stroke="#a4c9c6" stroke-width="1"/>'
    f'</pattern><clipPath id="water"><path d="{shore}"/></clipPath></defs>'
    '<rect width="500" height="500" fill="#19313b"/>'
    '<rect width="500" height="500" fill="url(#trees)" opacity=".7"/>'
    f'<path d="{shore}" fill="#24687a" stroke="#cbd9bf" stroke-width="8"/>'
    f'<g clip-path="url(#water)" fill="none" stroke="#9bd2d5" stroke-opacity=".4">{contour_art}</g>'
    f'<path d="{shore}" fill="none" stroke="#e5e1bb" stroke-width="2"/>'
    '<text x="454" y="28" fill="#fff4d4" font-family="sans-serif" font-size="18">N ↑</text></svg>'
)
(ROOT / 'assets/maps/mille-lacs.svg').write_text(svg)
print(len(cells), 'cells', len(lines), 'contour paths')
