"""Build the simplified Mille Lacs game map. Requires Python 3 + shapely.
Only a single-lake derivative is packaged; source responses stay in work/.
"""
import json, urllib.request, urllib.parse, pathlib
from shapely.geometry import Polygon, Point, LineString
ROOT = pathlib.Path(__file__).resolve().parents[1]
BASE = 'https://enterprise.gisdata.mn.gov/aghost/rest/services/us_mn_state_dnr/water_lake_bathymetry/MapServer'
def fetch(layer):
    params = dict(f='json',where="dowlknum='48000200'",outFields='*',returnGeometry='true',outSR=26915,resultRecordCount=2000)
    data=json.load(urllib.request.urlopen(BASE+'/'+str(layer)+'/query?'+urllib.parse.urlencode(params)))
    assert not data.get('exceededTransferLimit'), 'Paginate source before building'
    assert data.get('features'), data
    return data['features']
outline,contours=fetch(1),fetch(0)
rings=[r for f in outline for r in f['geometry']['rings']]
shape=Polygon(max(rings,key=lambda r:abs(Polygon(r).area))).buffer(0)
x0,y0,x1,y1=shape.bounds
scale=440/max(x1-x0,y1-y0)
def xy(p):return [round(30+(p[0]-x0)*scale,1),round(30+(y1-p[1])*scale,1)]
def path(points,closed=False):return 'M'+'L'.join(','.join(map(str,xy(p))) for p in points)+('Z' if closed else '')
shore=path(shape.simplify(55).exterior.coords,True)
lines=[(abs(f['attributes']['depth']),LineString(p)) for f in contours for p in f['geometry']['paths']]
paths=[dict(depth=d,path=path(line.simplify(70).coords)) for d,line in lines]
cells=[]
for row in range(5):
 for col in range(5):
  x=x0+(col+.5)*(x1-x0)/5;y=y1-(row+.5)*(y1-y0)/5;p=Point(x,y)
  if not shape.contains(p):continue
  depth=int(min(lines,key=lambda dl:dl[1].distance(p))[0])
  depth=max(5,depth)
  shallow=depth<=15
  habitat='Weed edge' if shallow else 'Reef edge' if depth<=25 else 'Deep basin'
  cells.append(dict(id=chr(65+col)+str(row+1),x=xy([x,y])[0],y=xy([x,y])[1],depthFt=depth,temperatureF=34+round(depth/10),habitat=habitat,area='starter-shore' if shallow else 'deep-reef',likely=['perch','pike','rock-bass'] if shallow else ['walleye','smallmouth','muskie'],weightBonus={'perch':8,'pike':3} if shallow else {'walleye':8,'muskie':3,'smallmouth':3}))
# Ensure the first free cell is stable; ordering is used by the normal entry.
assert any(c['area']=='starter-shore' for c in cells)
data=dict(lakeId='48000200',width=500,height=500,shore=shore,contours=paths,cells=cells,source=BASE,attribution='Bathymetry © Minnesota Department of Natural Resources. Simplified for gameplay; not for navigation.')
(ROOT/'game/lake-map-data.mjs').write_text('// Derived from Minnesota DNR bathymetry. See assets/maps/README.md.\nexport default '+json.dumps(data,separators=(',',':'))+';\n')
svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500"><defs><pattern id="trees" width="35" height="45" patternUnits="userSpaceOnUse"><path d="M17 2L4 27H11L2 38H32L23 27H30Z" fill="#173f45" stroke="#a4c9c6" stroke-width="1"/></pattern><clipPath id="water"><path d="'+shore+'"/></clipPath></defs><rect width="500" height="500" fill="#19313b"/><rect width="500" height="500" fill="url(#trees)" opacity=".7"/><path d="'+shore+'" fill="#24687a" stroke="#cbd9bf" stroke-width="8"/><g clip-path="url(#water)" fill="none" stroke="#9bd2d5" stroke-opacity=".4">'+''.join('<path d="'+c['path']+'"/>' for c in paths)+'</g><path d="'+shore+'" fill="none" stroke="#e5e1bb" stroke-width="2"/><text x="454" y="28" fill="#fff4d4" font-family="sans-serif" font-size="18">N ↑</text></svg>'
(ROOT/'assets/maps/mille-lacs.svg').write_text(svg)
print(len(cells),'cells',len(paths),'contour paths',[(c['id'],c['depthFt']) for c in cells])
