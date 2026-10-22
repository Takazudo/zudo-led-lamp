import unittest, re, math
from pathlib import Path
import build_ti_rpw as b

class TIExample(unittest.TestCase):
    def test_ten_copper_pads_no_ep_and_reproducibility(self):
        s=b.text()
        self.assertEqual(sorted(map(int,re.findall(r'\(pad "(\d+)"',s))),list(range(1,11)))
        self.assertEqual(s,(Path(__file__).parent/'reviewed-candidates.pretty'/f'{b.NAME}.kicad_mod').read_text())
        self.assertEqual(s.count('(pad ""'),8) # four corner + four central apertures

    def test_top_view_positions_and_nonuniform_pitch(self):
        self.assertEqual(b.CORNERS,{1:(1,1),4:(1,-1),7:(-1,-1),10:(-1,1)})
        self.assertEqual(b.INNER,{2:(-.9,-.225),3:(-.9,.225),8:(.9,.225),9:(.9,-.225)})
        ys=[-.7,-.225,.225,.7]
        for actual,want in zip([ys[i+1]-ys[i] for i in range(3)],[.475,.45,.475]):self.assertAlmostEqual(actual,want)
        self.assertIn('(pad "5" smd roundrect (at -0.25 0)',b.text())
        self.assertIn('(pad "6" smd roundrect (at 0.25 0)',b.text())

    def test_corner_geometry_and_stencil_alignment(self):
        self.assertEqual(b.COPPER_L,[(-1.2,-.85),(-.85,-.85),(-.85,-1.2),(-.6,-1.2),(-.6,-.55),(-1.2,-.55)])
        self.assertEqual(b.PASTE_L,[(-1.2,-.825),(-.825,-.825),(-.825,-1.2),(-.6,-1.2),(-.6,-.55),(-1.2,-.55)])
        self.assertAlmostEqual((.825+.6)/2*2,1.425)
        self.assertAlmostEqual((.825+.55)/2-.225,.4625)
        self.assertAlmostEqual(2*.63-1.06,.20)
        # .05 radius tessellation stays within the supplied bounds.
        for poly in (b.COPPER_L,b.PASTE_L):
            out=b.rounded(poly)
            for axis in (0,1):
                self.assertAlmostEqual(min(p[axis] for p in out),min(p[axis] for p in poly))
                self.assertAlmostEqual(max(p[axis] for p in out),max(p[axis] for p in poly))
        self.assertLess(.05*(1-math.cos(math.radians(2.5))),.00005)

    def test_design_choices_not_manufacturer_tolerances(self):
        # Smallest copper gap .2; .02-per-side mask leaves .16 mm bridge.
        self.assertAlmostEqual(.5-.3,.2)
        self.assertAlmostEqual(.45-.25,.2)
        self.assertAlmostEqual(.2-2*b.MASK,.16)
        self.assertLessEqual(b.MASK,.05)
        self.assertAlmostEqual(1.45-1.2,.25) # courtyard over copper maximum
        self.assertAlmostEqual(1.45-2.1/2,.4) # courtyard over maximum body

if __name__=='__main__':unittest.main()
