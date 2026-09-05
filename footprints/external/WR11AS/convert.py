#!/usr/bin/env python3
"""Convert the reviewed CADENAS inch-coordinate STL into KiCad's 0.1-inch WRL units."""
import hashlib
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[3]
SOURCE = Path(__file__).with_name('WR11AS.stl')
TARGET = ROOT / 'footprints/kicad/zudo-led-lamp.3dshapes/WR11AS.wrl'
raw = SOURCE.read_bytes()
assert hashlib.sha256(raw).hexdigest() == '2917e08e2385bf3d1d0bf3f46104c4ece401c84fe50b4056710842b9430e4abe'
vertices = [tuple(map(float, point)) for point in re.findall(
    rb'vertex\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)', raw)]
assert len(vertices) == 1540 * 3
points, indices, lookup = [], [], {}
for x, y, z in vertices:
    # Rigid +90-degree X rotation puts the actuator above the panel in KiCad Z.
    point = (x * 10, -z * 10, y * 10)
    if point not in lookup:
        lookup[point] = len(points)
        points.append(point)
    indices.append(lookup[point])
lines = ['#VRML V2.0 utf8', '# NKK WR11AS; derived from the supplied CADENAS STL, see footprints/external/WR11AS/README.md',
         'Shape { appearance Appearance { material Material { diffuseColor 0.24 0.26 0.28 } }',
         'geometry IndexedFaceSet { solid FALSE creaseAngle 0.35 coord Coordinate { point [']
lines += [' '.join(f'{v:.6f}' for v in point) + ',' for point in points]
lines += ['] } coordIndex [']
lines += [','.join(map(str, indices[i:i+3])) + ',-1,' for i in range(0,len(indices),3)]
lines += ['] } }', '']
TARGET.write_text('\n'.join(lines))
print(TARGET)
print(hashlib.sha256(TARGET.read_bytes()).hexdigest())
