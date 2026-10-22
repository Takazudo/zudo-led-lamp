"""Associate reviewed U1 with a new isolated copy of conditional USB candidate."""
import sys,pathlib,importlib.util,hashlib,json,shutil
HERE=pathlib.Path(__file__).resolve().parent;CAND=HERE.parent
sys.path.insert(0,str(CAND))
m=importlib.util.spec_from_file_location('usb_proposal',CAND/'usb-integration/prepare.py');usb=importlib.util.module_from_spec(m);m.loader.exec_module(usb)
NAME='HUSB238_DFN10_3x3_EP1.7x2.4_PASTE_PROPOSAL'
FP='husb-candidate:'+NAME
BLEED_NAME='RBLEED_1210W2F2201T5E'
U2_NAME='TPS259474_RPW0010A_TI_EXAMPLE'
QINH_NAME='SMMBT3904LT1G_CASE318_ONSEMI_EXAMPLE'
CSLEW_MPN='GRM21B5C1H223JA01L'
CSLEW_JLC='C77069'
def overlay():
 s=usb.overlay();s.PROJECT_NAME='husb006-u1-associated-UNQUALIFIED';s.OUT=str(HERE/'shared-p-u1-candidate.kicad_sch')
 old=s.COMPONENTS['U1'];s.COMPONENTS['U1']=(old[0],'HUSB238_006DD - DRAFT LAND / NOT RELEASED',old[2],FP,*old[4:])
 old=s.COMPONENTS['RBLEED'];s.COMPONENTS['RBLEED']=(*old[:3],'husb-candidate:'+BLEED_NAME,*old[4:])
 for ref,name in (('U2',U2_NAME),('QINH',QINH_NAME)):
  old=s.COMPONENTS[ref]
  value='TPS259474LRPWR - TI LAND CANDIDATE / NOT RELEASED' if ref=='U2' else old[1]
  s.COMPONENTS[ref]=(old[0],value,old[2],'husb-candidate:'+name,*old[4:])
 old=s.COMPONENTS['CSLEW']
 s.COMPONENTS['CSLEW']=(old[0],'22nF 50V 5% C0G / '+CSLEW_MPN+' - PROVISIONAL',CSLEW_JLC,'',*old[4:])
 return s
def svg():
 # Geometry in mm, top view; nominal body/terminals vs designed copper.
 parts=['<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="720" viewBox="0 0 1000 720">',
 '<rect width="1000" height="720" fill="white"/><g font-family="sans-serif" fill="#111">',
 '<text x="25" y="30" font-size="22">HUSB238_006DD: package vs proposed lands (TOP VIEW)</text>',
 '<text x="25" y="57" font-size="14">Attachment Rev2.5 p13 via parent visual review; not a manufacturer land pattern</text>']
 def rect(x,y,w,h,color,fill='none',dash=''):
  return f'<rect x="{300+x*100}" y="{340+y*100}" width="{w*100}" height="{h*100}" fill="{fill}" stroke="{color}" stroke-width="2" stroke-dasharray="{dash}"/>'
 parts += [rect(-2.05,-1.8,4.1,3.6,'#777',dash='6 4'),rect(-1.538,-1.538,3.076,3.076,'#111',dash='3 3'),rect(-1.5,-1.5,3,3,'#111')]
 parts += [rect(-.9,-1.25,1.8,2.5,'#16a34a',dash='4 3'),rect(-.85,-1.2,1.7,2.4,'#2563eb')]
 for pin in range(1,11):
  x=-1.4 if pin<=5 else 1.4;y=(pin-3)*.5 if pin<=5 else (8-pin)*.5
  parts.append(rect(x-.4,y-.175,.8,.35,'#2563eb'))
  tx=-1.3 if pin<=5 else 1.3
  parts.append(rect(tx-.2,y-.125,.4,.25,'#16a34a'))
  parts.append(f'<text x="{300+x*100}" y="{344+y*100}" text-anchor="middle" font-size="11">{pin}</text>')
 for x in (-.425,.425):
  for y in (-.6,.6):parts.append(rect(x-.325,y-.475,.65,.95,'#d97706'))
 labels=['Black: body nominal3.000 / maximum3.076 mm', 'Green: terminals0.40 x0.25 nominal; pitch0.50 BSC', 'Green dashed: EP maximum1.8 x2.5 mm', 'Blue: designed side lands0.80 x0.35; x=+/-1.40', 'Blue EP: designed copper1.70 x2.40, pad11 GND', 'Orange: four paste windows0.65 x0.95', 'Grey: designed courtyard4.10 x3.60', 'Pin1 upper-left; no bottom-view mirroring', 'Body max to courtyard: X0.512 / Y0.262 mm', 'Land-to-EP and adjacent copper gap:0.150 mm', 'Mask expansion0.020 -> opening gap0.110 mm', 'Mask openings omitted visually; source is authoritative', 'Nominal terminal positions assume centered body/EP.', 'No tolerance stack, wetting or process approval implied.']
 for i,t in enumerate(labels):parts.append(f'<text x="540" y="{115+i*30}" font-size="14">{t}</text>')
 parts.append('<text x="25" y="650" font-size="15">Source candidate only. Native/CPL/assembly checks pending. No production assignment.</text></g></svg>')
 return '\n'.join(parts)
def main():
 s=overlay();original=usb.core.Library;usb.core.Library=lambda:original(str(CAND/'candidate.kicad_sym'))
 try:p=pathlib.Path(usb.core.generate(s))
 finally:usb.core.Library=original
 note='(text "ISOLATED U1 LAND PROPOSAL: NOT FABRICATION READY; PD-ONLY D PINS UNQUALIFIED" (at 25.4 25.4 0) (effects (font (size 1.27 1.27)) (justify left)) (uuid "'+usb.core.new_uuid('u1-associated:warning')+'"))'
 p.write_text(p.read_text().rstrip()[:-1]+'\n'+note+'\n)\n',encoding='utf-8')
 dest=HERE/'husb-candidate.pretty';dest.mkdir(exist_ok=True)
 shutil.copyfile(CAND/'footprint-audit/reviewed-candidates.pretty'/f'{NAME}.kicad_mod',dest/f'{NAME}.kicad_mod')
 shutil.copyfile(CAND/'footprint-audit/reviewed-candidates.pretty'/f'{BLEED_NAME}.kicad_mod',dest/f'{BLEED_NAME}.kicad_mod')
 for name in (U2_NAME,QINH_NAME):
  shutil.copyfile(CAND/'footprint-audit/reviewed-candidates.pretty'/f'{name}.kicad_mod',dest/f'{name}.kicad_mod')
 inherited=HERE/'inherited.pretty';inherited.mkdir(exist_ok=True)
 inherited_files=[]
 for fp in sorted({row[3] for row in s.COMPONENTS.values() if row[3].startswith('zudo-led-lamp:')}):
  name=fp.split(':',1)[1]+'.kicad_mod'
  target=inherited/name;shutil.copyfile(usb.ROOT/'footprints/kicad'/name,target);inherited_files.append(target)
 (HERE/'fp-lib-table').write_text('(fp_lib_table (version 7) (lib (name "husb-candidate") (type "KiCad") (uri "${KIPRJMOD}/husb-candidate.pretty") (options "") (descr "Isolated reviewed source candidates")) (lib (name "zudo-led-lamp") (type "KiCad") (uri "${KIPRJMOD}/inherited.pretty") (options "") (descr "Exact original copies; geometry not requalified")))\n')
 (HERE/'sym-lib-table').write_text('(sym_lib_table (version 7) (lib (name "zudo-led-lamp") (type "KiCad") (uri "${KIPRJMOD}/../candidate.kicad_sym") (options "") (descr "Existing isolated symbols")))\n')
 (HERE/'land-outline-overlay.svg').write_text(svg(),encoding='utf-8')
 files=[p,HERE/'fp-lib-table',HERE/'sym-lib-table',HERE/'land-outline-overlay.svg',dest/f'{NAME}.kicad_mod',dest/f'{BLEED_NAME}.kicad_mod',HERE/'build.py']
 files.extend(dest/f'{name}.kicad_mod' for name in (U2_NAME,QINH_NAME))
 files.extend(inherited_files)
 (HERE/'hashes.json').write_text(json.dumps({f.relative_to(HERE).as_posix():hashlib.sha256(f.read_bytes()).hexdigest() for f in files},indent=2)+'\n')
if __name__=='__main__':main()
