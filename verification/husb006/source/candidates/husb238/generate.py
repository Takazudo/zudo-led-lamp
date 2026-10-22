"""Generate a visibly incomplete KiCad subcircuit using the existing generator.

No footprint dimensions inferred. Candidate symbols are isolated from the
production library. Evidence-backed power/control pin types are assigned; unresolved pins retain passive placeholders;
native ERC has not been qualified and cannot certify the controller.
"""
import argparse, csv, json, pathlib, sys
HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT/'scripts/schgen'))
import schgen_core as core
import spec
import power_path
import sourcing
import erc_pin_types

def symbol(name, pins):
    rows = [f'(symbol "{name}" (pin_names (offset 0.508)) (in_bom yes) (on_board yes)',
            '(property "Reference" "U" (at 0 20.32 0) (effects (font (size 1.27 1.27))))',
            f'(property "Value" "{name}" (at 0 -20.32 0) (effects (font (size 1.27 1.27))))',
            f'(symbol "{name}_0_1" (rectangle (start -12.7 17.78) (end 12.7 -17.78) (stroke (width 0.254) (type default)) (fill (type background))))',
            f'(symbol "{name}_1_1"']
    for i,(num,label) in enumerate(pins.items()):
        left = i < 6
        x, angle = (-17.78,0) if left else (17.78,180)
        y = 12.7-5.08*(i if left else i-6)
        kind = erc_pin_types.pin_type(name,num)
        rows.append(f'(pin {kind} line (at {x:g} {y:g} {angle}) (length 5.08) (name "{label}" (effects (font (size 1.27 1.27)))) (number "{num}" (effects (font (size 1.27 1.27)))))')
    return '\n'.join(rows+['))'])

def generate():
    lib = (ROOT/'symbols/zudo-led-lamp.kicad_sym').read_text(encoding='utf-8').rstrip()
    assert lib.endswith(')')
    appended = symbol('HUSB238_006DD',spec.PIN_NAMES)+'\n'+symbol('R_CANDIDATE',{1:'1',2:'2'})
    appended += '\n'+symbol('TPS259474LRPWR',power_path.EFUSE_PINS)
    appended += '\n'+symbol('SMMBT3904LT1G',power_path.NPN_PINS)
    appended += '\n'+symbol('C_CANDIDATE',{1:'1',2:'2'})
    candidate_lib = HERE/'candidate.kicad_sym'
    candidate_lib.write_text(lib[:-1]+'\n'+appended+'\n)\n',encoding='utf-8',newline='\n')
    original = core.Library
    core.Library = lambda: original(str(candidate_lib))
    try:
        path = pathlib.Path(core.generate(spec))
    finally:
        core.Library = original
    text = path.read_text(encoding='utf-8')
    note = '(text "UNQUALIFIED POWER PATH: NO FABRICATION OR ENERGIZING. CONTRACT TIMING, FOOTPRINTS AND USB CONNECTOR OPEN." (at 25.4 25.4 0) (effects (font (size 1.27 1.27)) (justify left)) (uuid "'+core.new_uuid('husb006:incomplete-warning')+'"))'
    path.write_text(text.rstrip()[:-1]+'\n'+note+'\n)\n',encoding='utf-8',newline='\n')
    with (HERE/'draft-connections.csv').open('w',encoding='utf-8',newline='') as f:
        writer=csv.writer(f); writer.writerow(['net','ref.pin'])
        for net,nodes in spec.NETS.items():
            for node in nodes: writer.writerow([net,node])
        for node in spec.NO_CONNECT: writer.writerow(['NC',node])
    (HERE/'release-status.json').write_text(json.dumps({'ready':False,'order_status':'REJECTED_PENDING_ADMISSION_SAFETY','errors':spec.release_errors()},indent=2)+'\n',encoding='utf-8',newline='\n')
    with (HERE/'candidate-sourcing.csv').open('w',encoding='utf-8',newline='') as f:
        writer=csv.writer(f);writer.writerow(['ref','MPN','JLC_ID','package','status'])
        for ref,row in sourcing.PARTS.items(): writer.writerow([ref,*row])

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--check-release',action='store_true');args=parser.parse_args()
    if args.check_release:
        print(json.dumps({'ready':False,'order_status':'REJECTED_PENDING_ADMISSION_SAFETY','errors':spec.release_errors()},indent=2));sys.exit(2)
    generate()

