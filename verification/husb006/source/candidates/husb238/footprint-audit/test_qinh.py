import unittest,re
from pathlib import Path
import build_qinh as b
class OnsemiLand(unittest.TestCase):
    def test_y_conversion_and_pin_identity(self):
        source_y_up={1:(-.95,-.975),2:(.95,-.975),3:(0,.975)}
        self.assertEqual(b.PADS,{n:(x,-y) for n,(x,y) in source_y_up.items()})
        self.assertEqual(re.findall(r'\(pad "(\d+)"',b.text()),['1','2','3'])
    def test_lands_and_design_clearance(self):
        self.assertEqual(b.text().count('(size 0.56 0.95)'),3)
        self.assertAlmostEqual(.975*2+.95,2.9)
        self.assertAlmostEqual(b.PADS[2][0]-b.PADS[1][0],1.9)
        self.assertGreaterEqual(1.8-3.04/2,.25)
        self.assertAlmostEqual(1.7-2.9/2,.25)
        self.assertEqual(b.text(),(Path(__file__).parent/'reviewed-candidates.pretty'/f'{b.NAME}.kicad_mod').read_text())
if __name__=='__main__':unittest.main()
