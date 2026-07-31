#!/usr/bin/env python3
"""Generate boards/board-p/board-p.kicad_sch from the locked net table.

Strategy: place every symbol at a fixed grid position, attach a global label
directly at every connected pin endpoint (no wires), no_connect markers on
floating pins. Connectivity is then verified externally via kicad-cli netlist
export diffed against the same net spec.
"""
import sys, uuid, math, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sexp import load, atom, find_all, tokenize

PROJ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
LIB_PATH = f'{PROJ}/symbols/zudo-led-lamp.kicad_sym'
OUT = f'{PROJ}/boards/board-p/board-p.kicad_sch'
PROJECT_NAME = 'board-p'

def new_uuid():
    return str(uuid.uuid4())

# ---------- extract raw symbol text blocks from the library ----------
lib_text = open(LIB_PATH).read()

def extract_symbol_raw(name):
    """Return the raw s-expr text of (symbol "NAME" ...) at library top level."""
    needle = f'(symbol "{name}"'
    i = lib_text.find(needle)
    assert i >= 0, f'symbol {name} not found'
    depth = 0
    j = i
    in_str = False
    while j < len(lib_text):
        c = lib_text[j]
        if in_str:
            if c == '\\\\':
                j += 1
            elif c == '"':
                in_str = False
        elif c == '"':
            in_str = True
        elif c == '(':
            depth += 1
        elif c == ')':
            depth -= 1
            if depth == 0:
                return lib_text[i:j+1]
        j += 1
    raise AssertionError('unbalanced')

lib = load(LIB_PATH)

def pins_of(name):
    """[(number, name, x, y, angle_deg, length)] from the library symbol."""
    out = []
    for sym in find_all(lib, 'symbol'):
        if atom(sym[1]) != name:
            continue
        for sub in find_all(sym, 'symbol'):
            for pin in find_all(sub, 'pin'):
                at = find_all(pin, 'at')[0]
                num = atom(find_all(pin, 'number')[0][1])
                pname = atom(find_all(pin, 'name')[0][1])
                length = float(atom(find_all(pin, 'length')[0][1]))
                ang = float(atom(at[3])) if len(at) > 3 else 0.0
                out.append((num, pname, float(atom(at[1])), float(atom(at[2])), ang, length))
        return out
    raise AssertionError(f'symbol {name} not found in parsed lib')

# ---------- component table ----------
# ref: (lib symbol name, value, lcsc, footprint, dnp, position)
COMPONENTS = {
    'J1':   ('TYPE-C-31-M-17', 'TYPE-C-31-M-17', 'C283540', 'zudo-led-lamp:USB-C-SMD_10P-P1.00-L6.8-W8.9', False, (63.5, 88.9)),
    'U1':   ('STUSB4500QTR', 'STUSB4500QTR', 'C2678061', 'zudo-led-lamp:QFN-24_L4.0-W4.0-P0.50-BL-EP2.8', False, (152.4, 88.9)),
    'Q1':   ('AO3401A_C347476', 'AO3401A', 'C347476', 'zudo-led-lamp:SOT-23_L2.9-W1.3-P1.90-LS2.4-BR', False, (241.3, 50.8)),
    'D5':   ('SMAJ20A_C571370', 'SMAJ20A', 'C571370', 'zudo-led-lamp:SMA_L4.2-W2.6-LS5.3-RD', False, (203.2, 38.1)),
    'D6':   ('PESD24VS1UB,115', 'PESD24VS1UB', 'C85382', 'zudo-led-lamp:SOD-523_L1.2-W0.8-LS1.6-RD', True, (228.6, 165.1)),
    'D7':   ('PESD24VS1UB,115', 'PESD24VS1UB', 'C85382', 'zudo-led-lamp:SOD-523_L1.2-W0.8-LS1.6-RD', True, (190.5, 215.9)),
    'C1':   ('CL31A106KBHNNNE', '10uF/50V', 'C13585', 'zudo-led-lamp:C1206', False, (38.1, 165.1)),
    'C2':   ('CC0603KRX7R9BB104', '100nF/50V', 'C14663', 'zudo-led-lamp:C0603', False, (76.2, 165.1)),
    'C30':  ('CL10A105KB8NNNC', '1uF/50V', 'C15849', 'zudo-led-lamp:C0603', False, (114.3, 165.1)),
    'C34':  ('CL10A105KB8NNNC', '1uF/50V', 'C15849', 'zudo-led-lamp:C0603', False, (152.4, 165.1)),
    'C35':  ('CC0603KRX7R9BB104', '100nF/50V', 'C14663', 'zudo-led-lamp:C0603', False, (190.5, 165.1)),
    'R11':  ('0603WAF1003T5E', '100k', 'C25803', 'zudo-led-lamp:R0603', False, (38.1, 190.5)),
    'R12':  ('0603WAF5602T5E', '56k', 'C23206', 'zudo-led-lamp:R0603', False, (76.2, 190.5)),
    'R13':  ('0603WAF4700T5E', '470R', 'C23179', 'zudo-led-lamp:R0603', False, (114.3, 190.5)),
    'R14':  ('0603WAF4700T5E', '470R', 'C23179', 'zudo-led-lamp:R0603', False, (152.4, 190.5)),
    'R15':  ('0603WAF4701T5E', '4.7k', 'C23162', 'zudo-led-lamp:R0603', False, (190.5, 190.5)),
    'R16':  ('0603WAF4701T5E', '4.7k', 'C23162', 'zudo-led-lamp:R0603', False, (228.6, 190.5)),
    'R17':  ('0603WAF5101T5E', '5.1k', 'C23186', 'zudo-led-lamp:R0603', True, (38.1, 215.9)),
    'R18':  ('0603WAF5101T5E', '5.1k', 'C23186', 'zudo-led-lamp:R0603', True, (76.2, 215.9)),
    'R19':  ('0603WAF0000T5E', '0R', 'C21189', 'zudo-led-lamp:R0603', False, (114.3, 215.9)),
    'R20':  ('0603WAF0000T5E', '0R', 'C21189', 'zudo-led-lamp:R0603', False, (152.4, 215.9)),
    'JOUT1': ('B6B-XH-A', 'B6B-XH-A(LF)(SN)', 'C144397', 'zudo-led-lamp:CONN-TH_6P-P2.50_B6B-XH-A-LF-SN', False, (317.5, 88.9)),
    'J2':   ('Conn_1x04', 'PogoPad_1x4_NVM_I2C', '', 'zudo-led-lamp:PogoPad_1x04_P2.54mm', False, (317.5, 139.7)),
    'J3':   ('Conn_1x08', 'PogoPad_1x8_Debug', '', 'zudo-led-lamp:PogoPad_1x08_P2.54mm', False, (317.5, 190.5)),
}

# ---------- net table (from doc/architecture/board-p.mdx, locked) ----------
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

# ---------- pin geometry ----------
pin_cache = {}
for ref, (symname, *_rest) in COMPONENTS.items():
    if symname not in pin_cache:
        pin_cache[symname] = pins_of(symname)

def abs_pin_positions(ref):
    """{spec_pin_number: [(x, y, label_angle)]} — several entries for duplicated numbers."""
    symname, _v, _l, _fp, _dnp, (X, Y) = COMPONENTS[ref]
    out = {}
    for num, _pname, px, py, ang, length in pin_cache[symname]:
        x = X + px
        y = Y - py
        rad = math.radians(ang)
        # direction pin points (toward body) in sheet coords (y down):
        dx, dy = math.cos(rad), -math.sin(rad)
        away = (-dx, -dy)
        if abs(away[0]) > abs(away[1]):
            label_ang = 0 if away[0] > 0 else 180
        else:
            label_ang = 270 if away[1] > 0 else 90
        out.setdefault(num, []).append((x, y, label_ang))
    return out

# coverage check: every pin used exactly once
used = {}
for net, specs in NETS.items():
    for s in specs:
        assert s not in used, f'{s} appears in both {used[s]} and {net}'
        used[s] = net
for s in NO_CONNECT:
    assert s not in used, f'{s} is both connected and NC'
    used[s] = 'NC'
for ref in COMPONENTS:
    numbers = {num for num, *_ in pin_cache[COMPONENTS[ref][0]]}
    for num in numbers:
        spec = f'{ref}.{num}'
        assert spec in used, f'pin {spec} not assigned to any net or NC'
for s in used:
    ref, num = s.split('.')
    assert ref in COMPONENTS, f'unknown ref {ref}'
    numbers = {n for n, *_ in pin_cache[COMPONENTS[ref][0]]}
    assert num in numbers, f'{s}: pin {num} not in symbol ({sorted(numbers)})'
print(f'coverage OK: {len(used)} pin specs over {len(COMPONENTS)} components')

# ---------- emit ----------
ROOT_UUID = new_uuid()
parts = []
parts.append('(kicad_sch')
parts.append('\t(version 20260306)')
parts.append('\t(generator "eeschema")')
parts.append('\t(generator_version "10.0")')
parts.append(f'\t(uuid "{ROOT_UUID}")')
parts.append('\t(paper "A3")')

# lib_symbols
embedded = []
seen = set()
for ref, (symname, *_r) in COMPONENTS.items():
    if symname in seen:
        continue
    seen.add(symname)
    raw = extract_symbol_raw(symname)
    raw = raw.replace(f'(symbol "{symname}"', f'(symbol "zudo-led-lamp:{symname}"', 1)
    embedded.append('\t\t' + raw.replace('\n', '\n\t\t'))
parts.append('\t(lib_symbols')
parts.extend(embedded)
parts.append('\t)')

# symbol instances
for ref, (symname, value, lcsc, fp, dnp, (X, Y)) in COMPONENTS.items():
    u = new_uuid()
    dnp_s = 'yes' if dnp else 'no'
    body = []
    body.append('\t(symbol')
    body.append(f'\t\t(lib_id "zudo-led-lamp:{symname}")')
    body.append(f'\t\t(at {X:g} {Y:g} 0)')
    body.append('\t\t(unit 1)')
    body.append('\t\t(exclude_from_sim no)')
    body.append('\t\t(in_bom yes)')
    body.append('\t\t(on_board yes)')
    body.append(f'\t\t(dnp {dnp_s})')
    body.append(f'\t\t(uuid "{u}")')
    props = [
        ('Reference', ref, X + 2.54, Y - 5.08, False),
        ('Value', value, X + 2.54, Y + 5.08, False),
        ('Footprint', fp, X, Y, True),
        ('Datasheet', '', X, Y, True),
    ]
    if lcsc:
        props.append(('LCSC', lcsc, X, Y + 7.62, True))
    if dnp:
        props.append(('DNP', 'DNP', X, Y + 10.16, True))
    for pname, pval, px, py, hide in props:
        hide_s = '\n\t\t\t\t(hide yes)' if hide else ''
        body.append(f'\t\t(property "{pname}" "{pval}"\n\t\t\t(at {px:g} {py:g} 0)\n\t\t\t(effects\n\t\t\t\t(font (size 1.27 1.27)){hide_s}\n\t\t\t)\n\t\t)')
    for num, *_r in pin_cache[symname]:
        body.append(f'\t\t(pin "{num}"\n\t\t\t(uuid "{new_uuid()}")\n\t\t)')
    body.append(f'\t\t(instances\n\t\t\t(project "{PROJECT_NAME}"\n\t\t\t\t(path "/{ROOT_UUID}"\n\t\t\t\t\t(reference "{ref}")\n\t\t\t\t\t(unit 1)\n\t\t\t\t)\n\t\t\t)\n\t\t)')
    body.append('\t)')
    parts.append('\n'.join(body))

# global labels at pin endpoints
for net, specs in NETS.items():
    for s in specs:
        ref, num = s.split('.')
        for (x, y, ang) in abs_pin_positions(ref)[num]:
            justify = {0: 'left', 90: 'left', 180: 'right', 270: 'right'}[ang]
            parts.append(
                f'\t(global_label "{net}"\n'
                f'\t\t(shape passive)\n'
                f'\t\t(at {x:g} {y:g} {ang})\n'
                f'\t\t(effects\n\t\t\t(font (size 1.27 1.27))\n\t\t\t(justify {justify})\n\t\t)\n'
                f'\t\t(uuid "{new_uuid()}")\n'
                f'\t)'
            )

# no_connect markers
for s in NO_CONNECT:
    ref, num = s.split('.')
    for (x, y, _ang) in abs_pin_positions(ref)[num]:
        parts.append(f'\t(no_connect\n\t\t(at {x:g} {y:g})\n\t\t(uuid "{new_uuid()}")\n\t)')

parts.append('\t(sheet_instances\n\t\t(path "/"\n\t\t\t(page "1")\n\t\t)\n\t)')
parts.append('\t(embedded_fonts no)')
parts.append(')')

open(OUT, 'w').write('\n'.join(parts) + '\n')
print(f'wrote {OUT}')
