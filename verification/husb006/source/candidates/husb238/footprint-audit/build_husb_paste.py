"""Separate 1oz/green-mask process proposal; original draft preserved."""
from pathlib import Path
from build_husb_draft import text as original
MASK_EXPANSION=.02
BODY_MAX=3.076 # parent visual verification: Rev2.5 p13 D/E; not land size
WINDOW=(.65,.95)
CENTERS=[(x,y) for x in (-.425,.425) for y in (-.6,.6)]
NAME='HUSB238_DFN10_3x3_EP1.7x2.4_PASTE_PROPOSAL'
def text():
    s=original().replace('HUSB238_DFN10_3x3_EP1.7x2.4_DRAFT',NAME)
    # Max body half-height1.538 + engineering clearance.25 =1.788;
    # round outward to1.80. X stays2.05 because copper reaches1.80.
    s=s.replace('(start -2.05 -1.75) (end 2.05 1.75)',
                '(start -2.05 -1.80) (end 2.05 1.80)')
    # Explicit nonzero per-pad margin, so board defaults cannot silently widen it.
    s=s.replace('(layers "F.Cu" "F.Paste" "F.Mask"))','(layers "F.Cu" "F.Paste" "F.Mask") (solder_mask_margin 0.02))')
    s=s.replace('(layers "F.Cu" "F.Mask"))','(layers "F.Cu" "F.Mask") (solder_mask_margin 0.02))')
    s=s.rstrip()[:-1]
    for x,y in CENTERS:
        s+=f'  (pad "" smd rect (at {x} {y}) (size 0.65 0.95) (layers "F.Paste"))\n'
    return s+')\n'
if __name__=='__main__':
    (Path(__file__).parent/'reviewed-candidates.pretty'/f'{NAME}.kicad_mod').write_text(text(),encoding='utf-8')
