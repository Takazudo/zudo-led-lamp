"""Exact SMMBT3904LT1G source candidate from user attachment via parent review."""
from pathlib import Path
NAME='SMMBT3904LT1G_CASE318_ONSEMI_EXAMPLE'
PDF_SHA256='0f63b9b917cc0e06015e1d647a44eb0b1d98c311d5e33bed54392a316033e658'
# Component-side view, KiCad Y down. Correspondence inferred from adjacent
# numbered TOP VIEW and STYLE 6; mounting-land graphic itself is unnumbered.
PADS={1:(-.95,.975),2:(.95,.975),3:(0,-.975)}
# Zero paste fields do not prove board-default override; native plot check pending.
def text():
    s=f'''(footprint "{NAME}" (version 20240108) (generator "isolated_source_candidate")
 (layer "F.Cu") (attr smd)
 (descr "onsemi CASE318 issue AU p9 lands; STYLE6 B1 E2 C3; process assumptions unqualified")
 (fp_text reference "REF**" (at 0 -2.1) (layer "F.SilkS") (effects (font (size 0.7 0.7) (thickness 0.12))))
 (fp_text value "SMMBT3904LT1G" (at 0 2.1) (layer "F.Fab") (effects (font (size 0.7 0.7) (thickness 0.1))))
 (fp_rect (start -1.45 -0.65) (end 1.45 0.65) (stroke (width 0.1) (type default)) (fill none) (layer "F.Fab"))
 (fp_line (start -1.45 0.3) (end -1.1 0.65) (stroke (width 0.1) (type default)) (layer "F.Fab"))
 (fp_circle (center -1.5 1.3) (end -1.45 1.3) (stroke (width 0.1) (type default)) (fill none) (layer "F.SilkS"))
 (fp_rect (start -1.8 -1.7) (end 1.8 1.7) (stroke (width 0.05) (type default)) (fill none) (layer "F.CrtYd"))
'''
    for n,(x,y) in PADS.items():
        s+=f' (pad "{n}" smd rect (at {x} {y}) (size 0.56 0.95) (layers "F.Cu" "F.Paste" "F.Mask") (solder_mask_margin 0.02) (solder_paste_margin 0) (solder_paste_margin_ratio 0))\n'
    return s+')\n'
if __name__=='__main__':
    (Path(__file__).parent/'reviewed-candidates.pretty'/f'{NAME}.kicad_mod').write_text(text(),encoding='utf-8')
