#!/usr/bin/env python3
"""Check the documented worst-case rectangular lug against the actual oval slots."""
import math
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'scripts/schgen'))
from sexp import atom, find_all, load

path = ROOT / 'footprints/kicad/SW-TH_1MS1T1B1M1QES-5.kicad_mod'
for pad in find_all(load(str(path)), 'pad'):
    drill = find_all(pad, 'drill')[0]
    assert atom(drill[1]) == 'oval'
    width, length = map(lambda a: float(atom(a)), drill[2:4])
    assert (width, length) == (2.4, 4.0)
    r = (width - 0.08) / 2
    half_segment = (length - width) / 2
    theta = math.radians(5)
    x = 1.14 * math.cos(theta) + .505 * math.sin(theta) + .30
    y = .505 * math.cos(theta) + 1.14 * math.sin(theta) + .30
    margin = r - math.hypot(max(0, x - half_segment), y)
    assert margin > 0, (atom(pad[1]), margin)
    copper = [float(atom(a)) for a in find_all(pad, 'size')[0][1:3]]
    ring = min((copper[0] - width - .13) / 2, (copper[1] - length - .13) / 2) - .05
    assert ring >= .38
print(f'PASS: worst-case oval corner clearance {margin:.3f} mm; annulus {ring:.3f} mm under documented allowances')
