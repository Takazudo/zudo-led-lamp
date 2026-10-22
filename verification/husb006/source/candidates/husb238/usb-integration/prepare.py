"""Conditional source-only J1 reuse overlay. Never modifies the reviewed base candidate."""
import copy,csv,hashlib,importlib.util,json,pathlib,sys,types
HERE=pathlib.Path(__file__).resolve().parent;CAND=HERE.parent;ROOT=CAND.parents[1]
sys.path.insert(0,str(CAND));sys.path.insert(0,str(ROOT/'scripts/schgen'))
import spec,board_p_spec,schgen_core as core,sexp
def overlay():
 s=types.SimpleNamespace(PROJECT_NAME='husb006-usb-reuse-UNQUALIFIED',PAPER=spec.PAPER,
  OUT=str(HERE/'usb-reuse-proposal.kicad_sch'),COMPONENTS=copy.deepcopy(spec.COMPONENTS),
  NETS=copy.deepcopy(spec.NETS),NO_CONNECT=list(spec.NO_CONNECT))
 c=board_p_spec.COMPONENTS['J1'];s.COMPONENTS['J1']=(*c[:5],(38.1,76.2))
 s.NETS['RAW_USB_VBUS']+=['J1.2','J1.5'];s.NETS['GND']+=['J1.0','J1.1','J1.6']
 s.NETS['USB_CC1']=s.NETS.pop('USB_CC1_PORT_UNMAPPED')+['J1.3']
 s.NETS['USB_CC2']=s.NETS.pop('USB_CC2_PORT_UNMAPPED')+['J1.4']
 # D+/D- remain unresolved single-pin nets; no NC, tie or assumed mode.
 return s
def parse(p):return sexp.parse(sexp.tokenize(p.read_text(encoding='utf-8')))
def a(n):return sexp.atom(n)
def mechanics():
 path=ROOT/'footprints/kicad/USB-C-SMD_10P-P1.00-L6.8-W8.9.kicad_mod'
 f=parse(path);pads=sexp.find_all(f,'pad');bounds=[]
 for p in pads:
  at=sexp.find_all(p,'at')[0];sz=sexp.find_all(p,'size')[0]
  x,y=map(lambda t:float(a(t)),at[1:3]);w,h=map(lambda t:float(a(t)),sz[1:3])
  bounds.append([x-w/2,y-h/2,x+w/2,y+h/2])
 box=[min(b[0] for b in bounds),min(b[1] for b in bounds),max(b[2] for b in bounds),max(b[3] for b in bounds)]
 pcb=parse(ROOT/'boards/board-p/board-p.kicad_pcb')
 fps=sexp.find_all(pcb,'footprint')+sexp.find_all(pcb,'module')
 j=next(f for f in fps if any(len(t)>2 and a(t[1]) in ['Reference','reference'] and a(t[2])=='J1' for t in sexp.find_all(f,'property')+sexp.find_all(f,'fp_text')))
 at=[float(a(x)) for x in sexp.find_all(j,'at')[0][1:]];assert at==[13.506,5.,180.]
 rect=next(r for r in sexp.find_all(pcb,'gr_rect') if a(sexp.find_all(r,'layer')[0][1])=='Edge.Cuts')
 edges=[float(a(x)) for name in ['start','end'] for x in sexp.find_all(rect,name)[0][1:]];assert edges==[0.,0.,27.,40.]
 world=[at[0]-box[2],at[1]-box[3],at[0]-box[0],at[1]-box[1]]
 cy=[]
 for line in sexp.find_all(f,'fp_line'):
  if a(sexp.find_all(line,'layer')[0][1])=='F.CrtYd':
   for key in ['start','end']:cy.append([float(a(v)) for v in sexp.find_all(line,key)[0][1:]])
 courtyard=[min(x[0] for x in cy),min(x[1] for x in cy),max(x[0] for x in cy),max(x[1] for x in cy)]
 return {'basis':'retained CAD geometry, not manufacturer enclosure/plug clearance','original_board_edge_rect_mm':edges,
 'original_J1_xy_rotation':at,'local_pad_bbox_mm':box,'original_placed_pad_bbox_mm':world,
 'local_courtyard_bbox_mm':courtyard,'courtyard_contains_all_pad_extents':all([courtyard[0]<=box[0],courtyard[1]<=box[1],courtyard[2]>=box[2],courtyard[3]>=box[3]]),
 'candidate_placement':None,'enclosure_or_plug_clearance_verified':False}
def main():
 s=overlay();original=core.Library;core.Library=lambda:original(str(CAND/'candidate.kicad_sym'))
 try:path=pathlib.Path(core.generate(s))
 finally:core.Library=original
 text=path.read_text();note='(text "CONDITIONAL USB REUSE ONLY: D+/D- REQUIREMENTS UNRESOLVED; NO FABRICATION" (at 25.4 25.4 0) (effects (font (size 1.27 1.27)) (justify left)) (uuid "'+core.new_uuid('usb-reuse:warning')+'"))'
 path.write_text(text.rstrip()[:-1]+'\n'+note+'\n)\n',encoding='utf-8')
 with (HERE/'connections.csv').open('w',newline='',encoding='utf-8') as f:
  w=csv.writer(f);w.writerow(['net','ref.pin'])
  for net,pins in list(s.NETS.items())+[('NC',s.NO_CONNECT)]:
   for pin in pins:w.writerow([net,pin])
 module=importlib.util.spec_from_file_location('preorder_builder',CAND/'preorder-bom/build.py');b=importlib.util.module_from_spec(module);module.loader.exec_module(b)
 rows=b.rows();row=dict(rows[0]);row.update(references='J1',mpn='TYPE-C-31-M-17',jlc_id='C283540',placements_per_board=1,installed_qty_per_board=1,installed_qty_two_boards=2,
 identity_status='EXACT_IDENTITY_CONDITIONAL_REUSE',mounting='SMT contacts + plated through-hole shell tabs',
 assembly_type_evidence='UNKNOWN current JLC service; exact retained distributor identity only',
 procurement_evidence='.claude/skills/component-type-c-31-m-17/sources.json; board_p_spec.py J1',
 footprint_assignment='J1:'+s.COMPONENTS['J1'][3],remaining_inputs='HUSB D+/D- absence compatibility; numeric/physical contact orientation; courtyard correction review; fit and current PCBA service')
 rows.append(row)
 with (HERE/'conditional-two-board-bom.csv').open('w',newline='',encoding='utf-8-sig') as f:
  w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
 (HERE/'mechanical-observation.json').write_text(json.dumps(mechanics(),indent=2)+'\n')
 inputs=[CAND/'spec.py',CAND/'board-p-husb006-candidate.kicad_sch',CAND/'preorder-bom/two-board-preorder-bom.csv',ROOT/'scripts/schgen/board_p_spec.py',ROOT/'boards/board-p/board-p.kicad_pcb']
 (HERE/'base-input-hashes.json').write_text(json.dumps({str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in inputs},indent=2)+'\n')
 print('Conditional overlay:20 placements/17 grouped BOM rows;40 planned positions for2 copies incl2 unselectedCSLEW and2 conditionalJ1;67 unique logical contacts.')
if __name__=='__main__':main()
