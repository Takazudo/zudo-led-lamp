import unittest,re,hashlib,json,xml.etree.ElementTree as ET
import build as b
class Integration(unittest.TestCase):
 def test_only_reviewed_associations_change(self):
  old=b.usb.overlay();new=b.overlay()
  self.assertEqual(old.NETS,new.NETS);self.assertEqual(old.NO_CONNECT,new.NO_CONNECT)
  for ref,row in old.COMPONENTS.items():
   if ref not in ('U1','RBLEED','U2','QINH','CSLEW'):self.assertEqual(row,new.COMPONENTS[ref])
  self.assertEqual(new.COMPONENTS['U1'][3],b.FP)
  self.assertEqual(b.usb.spec.COMPONENTS['U1'][3],'')
  self.assertEqual(new.COMPONENTS['RBLEED'][3],'husb-candidate:'+b.BLEED_NAME)
  self.assertEqual(b.usb.spec.COMPONENTS['RBLEED'][3],'')
  for ref,name in (('U2',b.U2_NAME),('QINH',b.QINH_NAME)):
   self.assertEqual(new.COMPONENTS[ref][3],'husb-candidate:'+name)
   self.assertEqual(b.usb.spec.COMPONENTS[ref][3],'')
   self.assertEqual(old.COMPONENTS[ref][0],new.COMPONENTS[ref][0])
   self.assertEqual(old.COMPONENTS[ref][2],new.COMPONENTS[ref][2])
 def test_provisional_cslew_and_library_resolution(self):
  s=b.overlay();old=b.usb.overlay()
  self.assertEqual(s.NETS,old.NETS)
  self.assertEqual(s.COMPONENTS['CSLEW'][0],old.COMPONENTS['CSLEW'][0])
  self.assertIn('22nF 50V 5% C0G',s.COMPONENTS['CSLEW'][1])
  self.assertIn('GRM21B5C1H223JA01L',s.COMPONENTS['CSLEW'][1])
  self.assertEqual(s.COMPONENTS['CSLEW'][2],'C77069')
  self.assertEqual(s.COMPONENTS['CSLEW'][3],'')
  self.assertEqual(old.COMPONENTS['CSLEW'][2],'')
  for ref,row in s.COMPONENTS.items():
   if not row[3]:self.assertEqual(ref,'CSLEW');continue
   lib,name=row[3].split(':')
   folder='inherited.pretty' if lib=='zudo-led-lamp' else 'husb-candidate.pretty'
   p=b.HERE/folder/(name+'.kicad_mod');self.assertTrue(p.is_file())
   if lib=='zudo-led-lamp':self.assertEqual(p.read_bytes(),(b.usb.ROOT/'footprints/kicad'/p.name).read_bytes())
  self.assertIn('${KIPRJMOD}/inherited.pretty',(b.HERE/'fp-lib-table').read_text())
 def test_u2_qinh_pin_net_and_generated_associations(self):
  lib=b.usb.core.Library(str(b.CAND/'candidate.kicad_sym'))
  expected={'TPS259474LRPWR':{1:'EN_UVLO',2:'OVLO',3:'PG',4:'PGTH',5:'IN',6:'OUT',7:'DVDT',8:'GND',9:'ILM',10:'ITIMER'},'SMMBT3904LT1G':{1:'B',2:'E',3:'C'}}
  for symbol,pins in expected.items():
   self.assertEqual({int(n):name for n,name,*_ in lib.pins_of(symbol)},pins)
  s=b.overlay()
  for net,pins in {'INHIBIT_BASE':['QINH.1'],'GND':['QINH.2','U2.8'],'EN_UVLO':['QINH.3','U2.1'],'SWITCHED_OUTPUT':['U2.6']}.items():
   for pin in pins:self.assertIn(pin,s.NETS[net])
  self.assertEqual(s.COMPONENTS['U2'][2],'C2864845')
  self.assertEqual(s.COMPONENTS['QINH'][2],'C84555')
  tree=b.usb.parse(b.HERE/'shared-p-u1-candidate.kicad_sch')
  for ref,name,count in (('U2',b.U2_NAME,10),('QINH',b.QINH_NAME,3)):
   path=b.HERE/'husb-candidate.pretty'/f'{name}.kicad_mod'
   self.assertEqual(path.read_bytes(),(b.CAND/'footprint-audit/reviewed-candidates.pretty'/path.name).read_bytes())
   fp=b.usb.parse(path)
   pads=b.usb.sexp.find_all(fp,'pad')
   self.assertEqual(sorted(int(b.usb.a(p[1])) for p in pads if b.usb.a(p[1])),list(range(1,count+1)))
   symbol=next(x for x in b.usb.sexp.find_all(tree,'symbol') if any(b.usb.a(p[1])=='Reference' and b.usb.a(p[2])==ref for p in b.usb.sexp.find_all(x,'property')))
   self.assertTrue(any(b.usb.a(p[1])=='Footprint' and b.usb.a(p[2])=='husb-candidate:'+name for p in b.usb.sexp.find_all(symbol,'property')))
 def test_bleed_mapping_identity_and_exact_footprint(self):
  s=b.overlay()
  self.assertEqual(s.COMPONENTS['RBLEED'][2],'C422361')
  self.assertIn('RBLEED.1',s.NETS['SWITCHED_OUTPUT'])
  self.assertIn('RBLEED.2',s.NETS['GND'])
  p=b.HERE/'husb-candidate.pretty'/f'{b.BLEED_NAME}.kicad_mod'
  self.assertEqual(p.read_bytes(),(b.CAND/'footprint-audit/reviewed-candidates.pretty'/p.name).read_bytes())
  self.assertEqual(re.findall(r'\(pad (\d+) ',p.read_text()),['1','2'])
  tree=b.usb.parse(b.HERE/'shared-p-u1-candidate.kicad_sch')
  s=next(s for s in b.usb.sexp.find_all(tree,'symbol') if any(b.usb.a(p[1])=='Reference' and b.usb.a(p[2])=='RBLEED' for p in b.usb.sexp.find_all(s,'property')))
  self.assertTrue(any(b.usb.a(p[1])=='Footprint' and b.usb.a(p[2])=='husb-candidate:'+b.BLEED_NAME for p in b.usb.sexp.find_all(s,'property')))
 def test_symbol_pad_pin_function_and_ep(self):
  lib=b.usb.core.Library(str(b.CAND/'candidate.kicad_sym'))
  pins={int(n):name for n,name,*_ in lib.pins_of('HUSB238_006DD')}
  self.assertEqual(pins,{1:'VIN',2:'D+',3:'D-',4:'CC1',5:'CC2',6:'SDA',7:'SCL',8:'VSET',9:'ISET',10:'GATE',11:'GND_EP'})
  fp=(b.HERE/'husb-candidate.pretty'/f'{b.NAME}.kicad_mod').read_text()
  self.assertEqual(sorted(map(int,re.findall(r'\(pad "(\d+)"',fp))),list(range(1,12)))
  self.assertIn('U1.11',b.overlay().NETS['GND'])
  self.assertIn('U1.10',b.overlay().NETS['CONTRACT_GATE_N'])
  self.assertEqual((b.CAND/'footprint-audit/reviewed-candidates.pretty'/f'{b.NAME}.kicad_mod').read_bytes(),(b.HERE/'husb-candidate.pretty'/f'{b.NAME}.kicad_mod').read_bytes())
 def test_generated_assignment_and_tables(self):
  tree=b.usb.parse(b.HERE/'shared-p-u1-candidate.kicad_sch')
  symbols=b.usb.sexp.find_all(tree,'symbol')
  u1=next(s for s in symbols if any(b.usb.a(p[1])=='Reference' and b.usb.a(p[2])=='U1' for p in b.usb.sexp.find_all(s,'property')))
  self.assertTrue(any(b.usb.a(p[1])=='Footprint' and b.usb.a(p[2])==b.FP for p in b.usb.sexp.find_all(u1,'property')))
  self.assertIn('${KIPRJMOD}/husb-candidate.pretty',(b.HERE/'fp-lib-table').read_text())
  self.assertIn('${KIPRJMOD}/../candidate.kicad_sym',(b.HERE/'sym-lib-table').read_text())
 def test_overlay_and_hashes(self):
  ET.parse(b.HERE/'land-outline-overlay.svg')
  for name,h in json.loads((b.HERE/'hashes.json').read_text()).items():
   self.assertEqual(hashlib.sha256((b.HERE/name).read_bytes()).hexdigest(),h)
if __name__=='__main__':unittest.main()
