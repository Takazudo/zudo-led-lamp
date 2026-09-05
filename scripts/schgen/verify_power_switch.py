#!/usr/bin/env python3
"""Audit the external rocker boundary, and optionally a real assembly netlist export."""
import argparse
from pathlib import Path

import board_l_spec as spec
from schgen_core import Library, abs_pin_positions
from sexp import atom, find_all, load

ROOT = Path(__file__).resolve().parents[2]


def field(node, key):
    return atom(find_all(node, key)[0][1])


def check_topology(nets):
    inverse = {pin: name for name, pins in nets.items() for pin in pins}
    assert len(inverse) == sum(map(len, nets.values())), 'A pin occurs on multiple nets'
    assert set(nets['VBUS_L']) == {'J2.1', 'J2.2', 'F1.1'}
    assert set(nets['V15_FUSED']) == {'F1.2', 'J5.1', 'SW2.1a'}
    for pin in ['SW2.1b', 'J5.2', 'U2.8', 'U4.3', 'D10.1']:
        assert inverse[pin] == 'V15', pin
    assert inverse['D10.2'] == 'GND'
    assert inverse['J2.5'] == inverse['J2.6'] == 'GND'
    assert inverse['J2.3'] == 'ATT' and inverse['J2.4'] == 'PDOK'
    assert {pin for pin in inverse if pin.startswith('SW2.')} == {'SW2.1a', 'SW2.1b'}
    # State graph of the deliberate conductive feed elements: fuse and rocker.
    for closed in (False, True):
        graph = {name: set() for name in nets}
        pairs = [('F1.1', 'F1.2')] + ([('SW2.1a', 'SW2.1b')] if closed else [])
        for a, b in pairs:
            x, y = inverse[a], inverse[b]
            graph[x].add(y)
            graph[y].add(x)
        seen, todo = set(), [inverse['J2.1']]
        while todo:
            net = todo.pop()
            if net not in seen:
                seen.add(net)
                todo.extend(graph[net] - seen)
        assert (inverse['U2.8'] in seen) == closed
        assert (inverse['U4.3'] in seen) == closed
        assert 'GND' not in seen


def check_schematic(path):
    tree = load(str(path))
    instances = {next(atom(p[2]) for p in find_all(s, 'property') if atom(p[1]) == 'Reference'): s
                 for s in find_all(tree, 'symbol')}
    sw, pads = instances['SW2'], instances['J5']
    assert field(sw, 'on_board') == 'no' and field(sw, 'in_bom') == 'yes'
    assert field(sw, 'dnp') == 'no'
    assert next(atom(p[2]) for p in find_all(sw, 'property') if atom(p[1]) == 'Footprint') == ''
    assert field(pads, 'on_board') == 'yes' and field(pads, 'in_bom') == 'no'
    library = Library()
    pin_cache = {name: library.pins_of(name) for name in ['WR11AS', 'Conn_1x02']}
    labels = {(round(float(atom(a[1])), 4), round(float(atom(a[2])), 4)): atom(n[1])
              for n in find_all(tree, 'global_label') for a in find_all(n, 'at')}
    for ref, targets in [('SW2', {'1a': 'V15_FUSED', '1b': 'V15'}), ('J5', {'1': 'V15_FUSED', '2': 'V15'})]:
        for pin, positions in abs_pin_positions(spec, pin_cache, ref).items():
            for x, y, _ in positions:
                assert labels[(round(x, 4), round(y, 4))] == targets[pin]
    master = ROOT / 'footprints/kicad/SolderWire_1x02_P5.08mm.kicad_mod'
    mirror = ROOT / 'footprints/kicad/zudo-led-lamp.pretty' / master.name
    assert master.read_bytes() == mirror.read_bytes()
    pads = find_all(load(str(master)), 'pad')
    assert {atom(p[1]) for p in pads} == {'1', '2'}
    assert all(atom(p[2]) == 'thru_hole' for p in pads)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--export-copy', nargs=2, metavar=('SOURCE', 'TEMP_DESTINATION'))
    parser.add_argument('--netlist')
    args = parser.parse_args()
    check_topology(spec.NETS)
    check_schematic(ROOT / spec.OUT)
    if args.export_copy:
        source, destination = map(Path, args.export_copy)
        assert source.resolve() != destination.resolve()
        raw = source.read_text()
        assert raw.count('(on_board no)') == 2, 'Only SW2 library and instance may be off-board'
        destination.write_text(raw.replace('(on_board no)', '(on_board yes)'))
    if args.netlist:
        nets = {}
        for net in find_all(find_all(load(args.netlist), 'nets')[0], 'net'):
            nets[field(net, 'name')] = [field(n, 'ref') + '.' + field(n, 'pin') for n in find_all(net, 'node')]
        check_topology(nets)
    print('PASS: WR11AS terminal mapping, PCB exclusion, solder pads and open/closed feed topology; not a bench back-power test')


if __name__ == '__main__':
    main()
