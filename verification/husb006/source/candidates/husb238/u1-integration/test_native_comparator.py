"""Synthetic comparator unit tests; NOT native KiCad export evidence."""
import unittest,tempfile,json
from pathlib import Path
from check_native_netlist import check
class Comparator(unittest.TestCase):
 def test_reject_short_missing_pin_and_unexpected_ref(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d);e=p/'e.json';x=p/'x.xml'
   e.write_text(json.dumps({'components':{'U1':{},'R1':{}},'nets':{'A':['U1.1','R1.1']},'no_connect':['U1.2']}))
   prefix='<export><components><comp ref="U1"/><comp ref="R1"/></components><nets><net>'
   suffix='</net></nets></export>'
   valid='<node ref="U1" pin="1"/><node ref="R1" pin="1"/>'
   x.write_text(prefix+valid+suffix);check(x,e)
   for bad in (valid+'<node ref="U1" pin="2"/>','<node ref="U1" pin="1"/>',valid+'<node ref="Q1" pin="1"/>',valid+'<node ref="U1" pin="1"/>'):
    x.write_text(prefix+bad+suffix)
    with self.assertRaises(AssertionError):check(x,e)
   x.write_text(prefix.replace('<comp ref="R1"/>','<comp ref="R1"/><comp ref="R1"/>')+valid+suffix)
   with self.assertRaises(AssertionError):check(x,e)
   x.write_text(prefix+valid+suffix)
   e.write_text(json.dumps({'components':{'U1':{},'R1':{}},'nets':{'A':['U1.1','R1.1']},'no_connect':['U1.1']}))
   with self.assertRaises(AssertionError):check(x,e)
if __name__=='__main__':unittest.main()
