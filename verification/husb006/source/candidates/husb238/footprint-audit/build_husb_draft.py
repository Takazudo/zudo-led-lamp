"""Draft land assumptions, not manufacturer land recommendation or native CAD."""
from pathlib import Path
ROOT=Path(__file__).resolve().parent
def text():
    s=['(footprint "HUSB238_DFN10_3x3_EP1.7x2.4_DRAFT" (version 20240108) (generator pcbnew)',
       '  (layer "F.Cu") (attr smd)',
       '  (descr "UNQUALIFIED draft: HUSB238 Rev2.5 p13 package outline; engineering land assumptions; no manufacturer land pattern")',
       '  (fp_text reference "REF**" (at 0 -2.5) (layer "F.SilkS") (effects (font (size 0.8 0.8) (thickness 0.12))))',
       '  (fp_text value "HUSB238_006DD_DRAFT" (at 0 2.5) (layer "F.Fab") (effects (font (size 0.7 0.7) (thickness 0.1))))',
       '  (fp_rect (start -1.5 -1.5) (end 1.5 1.5) (stroke (width 0.1) (type default)) (fill none) (layer "F.Fab"))',
       '  (fp_rect (start -2.05 -1.75) (end 2.05 1.75) (stroke (width 0.05) (type default)) (fill none) (layer "F.CrtYd"))',
       '  (fp_circle (center -1.7 -1.7) (end -1.6 -1.7) (stroke (width 0.12) (type default)) (fill none) (layer "F.SilkS"))']
    for pin in range(1,11):
        x=-1.4 if pin<=5 else 1.4
        y=(pin-3)*.5 if pin<=5 else (8-pin)*.5
        s.append(f'  (pad "{pin}" smd rect (at {x} {y}) (size 0.8 0.35) (layers "F.Cu" "F.Paste" "F.Mask"))')
    # No EP paste until stencil windowing is reviewed; explicit release blocker.
    s.append('  (pad "11" smd rect (at 0 0) (size 1.7 2.4) (layers "F.Cu" "F.Mask"))')
    return '\n'.join(s)+'\n)\n'
if __name__=='__main__':
    (ROOT/'reviewed-candidates.pretty/HUSB238_DFN10_3x3_EP1.7x2.4_DRAFT.kicad_mod').write_text(text(),encoding='utf-8')
