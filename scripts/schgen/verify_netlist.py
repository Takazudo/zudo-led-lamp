import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sexp import load, atom, find_all
import importlib.util
spec = importlib.util.spec_from_file_location('gen', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'gen_board_p.py'))

# re-declare expected nets (same source as generator)
NETS = {
    'VBUS_IN':       ['J1.2', 'J1.5', 'U1.24', 'C1.2', 'C2.2', 'R14.1', 'R11.2', 'Q1.2', 'J3.4', 'D5.1'],
    'CC1':           ['J1.3', 'U1.2', 'R17.1', 'R19.2', 'D6.1'],
    'CC2':           ['J1.4', 'U1.4', 'R18.1', 'R20.2', 'D7.1'],
    'CC1DB':         ['U1.1', 'R19.1', 'J3.1'],
    'CC2DB':         ['U1.5', 'R20.1', 'J3.2'],
    'VBUS_VS_DISCH': ['U1.18', 'R14.2'],
    'VBEN':          ['U1.16', 'R12.1', 'J3.8'],
    'Q1_G':          ['Q1.1', 'R11.1', 'R12.2', 'C35.1'],
    'VBUS_OUT':      ['Q1.3', 'R13.1', 'JOUT1.1', 'JOUT1.2'],
    'DISCH':         ['U1.9', 'R13.2'],
    'VREG_2V7':      ['U1.23', 'C30.2', 'R15.2', 'R16.2', 'J3.3'],
    'VREG_1V2':      ['U1.21', 'C34.1'],
    'SCL':           ['U1.7', 'R15.1', 'J2.1'],
    'SDA':           ['U1.8', 'R16.1', 'J2.2'],
    'ATT':           ['U1.11', 'J3.6', 'JOUT1.3'],
    'PDOK':          ['U1.20', 'J3.7', 'JOUT1.4'],
    'GND':           ['U1.10', 'U1.6', 'U1.12', 'U1.13', 'U1.22', 'U1.25',
                      'J1.1', 'J1.6', 'J1.0',
                      'C1.1', 'C2.1', 'C30.1', 'C34.2', 'C35.2',
                      'R17.2', 'R18.2', 'J2.3', 'J3.5',
                      'D5.2', 'D6.2', 'D7.2', 'JOUT1.5', 'JOUT1.6'],
}
NO_CONNECT = ['U1.3', 'U1.14', 'U1.15', 'U1.17', 'U1.19', 'J2.4']

nl = load(sys.argv[1])
nets_node = find_all(nl, 'nets')[0]
actual = {}
for net in find_all(nets_node, 'net'):
    name = atom(find_all(net, 'name')[0][1])
    nodes = set()
    for node in find_all(net, 'node'):
        ref = atom(find_all(node, 'ref')[0][1])
        pin = atom(find_all(node, 'pin')[0][1])
        nodes.add(f'{ref}.{pin}')
    actual[name] = nodes

expected = {name: set(specs) for name, specs in NETS.items()}
ok = True
for name, exp in expected.items():
    act = actual.get(name)
    if act is None:
        print(f'MISSING net {name}'); ok = False; continue
    if act != exp:
        print(f'MISMATCH {name}:')
        if exp - act: print(f'   missing: {sorted(exp - act)}')
        if act - exp: print(f'   extra:   {sorted(act - exp)}')
        ok = False
extra_nets = set(actual) - set(expected)
for name in sorted(extra_nets):
    members = actual[name]
    if name.startswith('unconnected-'):
        spec = next(iter(members))
        if len(members) == 1 and spec in NO_CONNECT:
            continue
        print(f'BAD unconnected net {name}: {sorted(members)}'); ok = False
    else:
        print(f'UNEXPECTED net {name}: {sorted(members)}'); ok = False
nc_seen = {next(iter(actual[n])) for n in actual if n.startswith('unconnected-') and len(actual[n]) == 1}
missing_nc = set(NO_CONNECT) - nc_seen
if missing_nc:
    print(f'NC pins missing from netlist: {sorted(missing_nc)}'); ok = False
total_nodes = sum(len(v) for v in actual.values())
print(f'{"PASS" if ok else "FAIL"}: {len(actual)} nets, {total_nodes} nodes '
      f'({len(expected)} expected nets + {len(extra_nets)} unconnected)')
sys.exit(0 if ok else 1)
