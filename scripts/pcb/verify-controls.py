#!/usr/bin/env python3
"""Check Board L's rear controls against the schematic spec and a KiCad DRC report."""
import argparse
import json
import math
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts/schgen'))
import board_l_spec as spec
from sexp import atom, find_all, load


def field(node, name):
    return atom(find_all(node, name)[0][1])


def check_board(path):
    board = load(str(path))
    footprints = {}
    nets = {}
    for fp in find_all(board, 'footprint'):
        properties = {atom(p[1]): atom(p[2]) for p in find_all(fp, 'property')}
        ref = properties['Reference']
        if ref not in spec.COMPONENTS:
            continue
        assert ref not in footprints, f'Duplicate footprint {ref}'
        footprints[ref] = fp
        assert atom(fp[1]) == spec.COMPONENTS[ref][3], f'Wrong footprint for {ref}'
        for pad in find_all(fp, 'pad'):
            net = find_all(pad, 'net')
            if net:
                nets[f'{ref}.{atom(pad[1])}'] = atom(net[0][-1])
    assert set(footprints) == set(spec.COMPONENTS) - set(spec.EXTERNAL_COMPONENTS)
    for name, pins in spec.NETS.items():
        for pin in pins:
            if pin.split('.')[0] not in spec.EXTERNAL_COMPONENTS:
                assert nets.get(pin) == name, f'{pin}: {nets.get(pin)} != {name}'
    assert {p for p, net in nets.items() if net == 'V15_FUSED'} == {'F1.2', 'J5.1'}
    assert field(footprints['SW1'], 'layer') == 'B.Cu'
    assert field(footprints['J5'], 'layer') == 'B.Cu'
    assert all(field(footprints[f'LED{i}'], 'layer') == 'F.Cu' for i in range(1, 25))
    attrs = {atom(a) for a in find_all(footprints['J5'], 'attr')[0][1:]}
    assert {'through_hole', 'exclude_from_bom', 'exclude_from_pos_files'} <= attrs
    assert nets['SW1.D'].startswith('unconnected-') and nets['SW1.E'].startswith('unconnected-')
    return len(footprints)


def footprints(path):
    return {next(atom(p[2]) for p in find_all(f, 'property') if atom(p[1]) == 'Reference'): f
            for f in find_all(load(str(path)), 'footprint')}


def xy(node):
    return tuple(float(atom(v)) for v in node[1:3])


def transform(fp, point):
    at = find_all(fp, 'at')[0]
    x, y = xy(at)
    angle = math.radians(float(atom(at[3])) if len(at) > 3 else 0)
    px, py = point
    return x + px * math.cos(angle) + py * math.sin(angle), y - px * math.sin(angle) + py * math.cos(angle)


def pad_position(fp, number):
    pad = next(p for p in find_all(fp, 'pad') if atom(p[1]) == number)
    return transform(fp, xy(find_all(pad, 'at')[0]))


def check_stack(board_path, power_path):
    lamp, power = footprints(board_path), footprints(power_path)
    for path, expected in [(board_path, (0, 0, 60, 60)), (power_path, (0, 0, 27, 40))]:
        edges = [item for item in load(str(path)) if isinstance(item, list)
                 and find_all(item, 'layer') and field(item, 'layer') == 'Edge.Cuts']
        assert len(edges) == 1 and atom(edges[0][0]) == 'gr_rect', \
            'Recheck stack occupancy after changing the rectangular board outline'
        points = [xy(find_all(line, end)[0]) for line in edges for end in ['start', 'end']]
        bounds = (min(x for x, y in points), min(y for x, y in points),
                  max(x for x, y in points), max(y for x, y in points))
        assert bounds == expected, 'Recheck stack occupancy after resizing a board'
    # The two shared pillar pairs lock the translation, independently of connector pin order.
    for path, targets in [(power_path, [(4, 4), (23, 4)]),
                          (board_path, [(20.5, 4), (39.5, 4)])]:
        holes = [xy(find_all(f, 'at')[0]) for f in find_all(load(str(path)), 'footprint')
                 if 'MountingHole' in atom(f[1])]
        assert all(any(math.dist(target, hole) < .001 for hole in holes) for target in targets)
    assert field(lamp['J2'], 'layer') == 'B.Cu' and field(power['JOUT1'], 'layer') == 'F.Cu'
    expected_power = ['VBUS_OUT', 'VBUS_OUT', 'ATT', 'PDOK', 'GND', 'GND']
    for number in map(str, range(1, 7)):
        ppad = next(p for p in find_all(power['JOUT1'], 'pad') if atom(p[1]) == number)
        assert atom(find_all(ppad, 'net')[0][-1]) == expected_power[int(number)-1]
        px, py = pad_position(power['JOUT1'], number)
        assert math.dist(pad_position(lamp['J2'], number), (px + 16.5, py)) < .001, \
            f'Pin {number} does not mate at the pillar-aligned position'
    for ref, expected in [('SW1', (51.5, 12.5)), ('J5', (8.5, 28))]:
        assert math.dist(xy(find_all(lamp[ref], 'at')[0]), expected) < .001, \
            f'{ref} moved: recheck the complete footprint against Board P and pillars'
    # These conservative half-extents enclose the exact placed footprint graphics and pads.
    for ref, half in [('SW1', (6.61, 8.15)), ('J5', (0, 0))]:
        if ref == 'SW1':
            x, y = xy(find_all(lamp[ref], 'at')[0]); bounds = (x-half[0], y-half[1], x+half[0], y+half[1])
            at = find_all(lamp[ref], 'at')[0]
            angle = float(atom(at[3])) if len(at) > 3 else 0
            assert abs(angle) < .001, 'Recheck the encoder envelope after rotation'
        else:
            x1, y1 = pad_position(lamp[ref], '1'); x2, y2 = pad_position(lamp[ref], '2')
            bounds = (min(x1,x2)-1.5, min(y1,y2)-1.5, max(x1,x2)+1.5, max(y1,y2)+1.5)
        left, top, right, bottom = bounds
        assert left >= .5 and top >= .5 and right <= 59.5 and bottom <= 59.5
        assert right <= 15.5 or left >= 44.5 or top >= 41, f'{ref} intrudes into Board P plus 1 mm margin'


def check_drc(path):
    report = json.loads(path.read_text())
    assert not report['unconnected_items'], 'Unrouted connections remain'
    assert not report['schematic_parity'], 'PCB differs from schematic'
    unexpected = [v for v in report['violations']
                  if v['severity'] == 'error' or v['type'] not in {'silk_overlap', 'silk_over_copper'}]
    assert not unexpected, f'Electrical/layout violations: {unexpected}'
    return len(report['violations'])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--board', type=Path, default=ROOT / 'boards/board-l/board-l.kicad_pcb')
    parser.add_argument('--drc-report', type=Path, required=True,
                        help='Fresh kicad-cli pcb drc --format json --schematic-parity --refill-zones report')
    args = parser.parse_args()
    count = check_board(args.board)
    check_stack(args.board, ROOT / 'boards/board-p/board-p.kicad_pcb')
    warnings = check_drc(args.drc_report)
    print(f'PASS: {count} schematic footprints, rear controls, LED orientation and switch nets; '
          f'pillar-aligned 6-pin mating and Board P clearance; 0 electrical errors, 0 unrouted, 0 parity issues; {warnings} silkscreen warnings')
    print('DRC validates copper; enclosure fit, assembled OFF isolation and knob direction require hardware.')


if __name__ == '__main__':
    main()
