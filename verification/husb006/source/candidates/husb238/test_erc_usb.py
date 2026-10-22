"""Local source consistency, not native ERC or physical connector acceptance."""
import pathlib,sys,unittest,json,collections
HERE=pathlib.Path(__file__).parent;ROOT=HERE.parents[1]
sys.path.insert(0,str(ROOT/'scripts/schgen'))
import sexp,schgen_core,board_p_spec,generate,erc_pin_types

def parse(path):return sexp.parse(sexp.tokenize(path.read_text(encoding='utf-8')))
def children(n,key):return sexp.find_all(n,key)
def types(name):
 lib=parse(HERE/'candidate.kicad_sym')
 sym=next(s for s in children(lib,'symbol') if sexp.atom(s[1])==name)
 return {int(sexp.atom(children(p,'number')[0][1])):sexp.atom(p[1]) for unit in children(sym,'symbol') for p in children(unit,'pin')}

class Checks(unittest.TestCase):
 def test_exported_pin_semantics(self):
  generate.generate()
  self.assertEqual(types('HUSB238_006DD'),{1:'power_in',2:'passive',3:'passive',4:'passive',5:'passive',6:'passive',7:'passive',8:'passive',9:'passive',10:'open_collector',11:'power_in'})
  self.assertEqual(types('TPS259474LRPWR'),{1:'input',2:'input',3:'open_collector',4:'input',5:'power_in',6:'power_out',7:'passive',8:'power_in',9:'passive',10:'passive'})
  for name in ('SMMBT3904LT1G','R_CANDIDATE','C_CANDIDATE'):
   self.assertEqual(set(types(name).values()),{'passive'})
 def test_usb_symbol_generator_and_fact_map(self):
  record=json.loads((ROOT/'.claude/skills/component-type-c-31-m-17/pin-map.json').read_text(encoding='utf-8'))['pin_maps'][0]
  lib=schgen_core.Library(str(ROOT/'symbols/zudo-led-lamp.kicad_sym'))
  pins={str(n):name for n,name,*rest in lib.pins_of('TYPE-C-31-M-17')}
  self.assertEqual(set(pins),{'0','1','2','3','4','5','6'})
  self.assertEqual(pins,{'0':'0','1':'B12','2':'B9','3':'A5','4':'B5','5':'A9','6':'A12'})
  self.assertEqual(collections.Counter(str(p[0]) for p in lib.pins_of('TYPE-C-31-M-17')),collections.Counter({'0':4,**{str(n):1 for n in range(1,7)}}))
  self.assertEqual({r['symbol_pin'] for r in record['pins']},set(pins))
  record_names={'0':'SHIELD','1':'GND1','2':'VBUS1','3':'CC1','4':'CC2','5':'VBUS2','6':'GND2'}
  for row in record['pins']:
   self.assertEqual(row['footprint_pad'],row['symbol_pin'])
   self.assertEqual(row['name'],record_names[row['symbol_pin']])
  for net,nums in {'VBUS_IN':('2','5'),'CC1':('3',),'CC2':('4',),'GND':('0','1','6')}.items():
   for n in nums:self.assertIn('J1.'+n,board_p_spec.NETS[net])
  self.assertEqual(board_p_spec.COMPONENTS['J1'][2],'C283540')
 def test_usb_available_footprint_and_placed_pad_nets(self):
  filename='USB-C-SMD_10P-P1.00-L6.8-W8.9.kicad_mod'
  a=ROOT/'footprints/kicad'/filename;b=ROOT/'footprints/kicad/zudo-led-lamp.pretty'/filename
  # The pretty-library copy is absent from this partial snapshot; no equivalence claim.
  expected=collections.Counter({'0':4,**{str(n):1 for n in range(1,7)}})
  self.assertEqual(collections.Counter(sexp.atom(p[1]) for p in children(parse(a),'pad')),expected)
  pcb=parse(ROOT/'boards/board-p/board-p.kicad_pcb')
  fps=children(pcb,'footprint')+children(pcb,'module')
  j1=next(f for f in fps if any(sexp.atom(t[1])=='reference' and sexp.atom(t[2])=='J1' for t in children(f,'fp_text')) or any(sexp.atom(t[1])=='Reference' and sexp.atom(t[2])=='J1' for t in children(f,'property')))
  mapping={'0':'GND','1':'GND','2':'VBUS_IN','3':'CC1','4':'CC2','5':'VBUS_IN','6':'GND'}
  pads=children(j1,'pad');self.assertEqual(collections.Counter(sexp.atom(p[1]) for p in pads),expected)
  for p in pads:self.assertEqual(sexp.atom(children(p,'net')[0][-1]),mapping[sexp.atom(p[1])])
 def test_candidate_still_has_no_assumed_usb_or_geometry(self):
  import spec
  self.assertNotIn('J1',spec.COMPONENTS)
  for ref in ('U1','U2','QINH','RBLEED','CSLEW'):self.assertEqual(spec.COMPONENTS[ref][3],'')
  self.assertEqual(spec.NETS['USB_CC1_PORT_UNMAPPED'],['U1.4'])
  self.assertEqual(spec.NETS['USB_CC2_PORT_UNMAPPED'],['U1.5'])

if __name__=='__main__':unittest.main()


