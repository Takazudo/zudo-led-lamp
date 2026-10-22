"""TI RPW0010A example lands, parent visual transcription; NOT released CAD."""
from pathlib import Path
import math

NAME = 'TPS259474_RPW0010A_TI_EXAMPLE'
PDF_SHA256 = '8f96de389903091650d4f462dcfad3210071c3ae7093623a7978f34baf8a65b4'
RADIUS = .05
MASK = .02  # engineering choice within TI NSMD maximum .05; not TI prescribed
# Zero paste fields do not prove board-default override. Native effective settings
# and plotted apertures must be checked; these are nominal source geometries.
# Upper-left L, absolute top-view coordinates. Other corners reflect this.
COPPER_L = [(-1.2,-.85),(-.85,-.85),(-.85,-1.2),(-.6,-1.2),(-.6,-.55),(-1.2,-.55)]
PASTE_L = [(-1.2,-.825),(-.825,-.825),(-.825,-1.2),(-.6,-1.2),(-.6,-.55),(-1.2,-.55)]
CORNERS = {1:(1,1),4:(1,-1),7:(-1,-1),10:(-1,1)}
INNER = {2:(-.9,-.225),3:(-.9,.225),8:(.9,.225),9:(.9,-.225)}

def rounded(poly):
    """Tessellated .05 mm fillets, including concave corner; 5 degree steps.

    Maximum radial chord deviation .000048 mm. Native import/process checks pending.
    """
    result=[]
    for i,b in enumerate(poly):
        a=poly[i-1];c=poly[(i+1)%len(poly)]
        def unit(p):
            dx=p[0]-b[0];dy=p[1]-b[1];n=math.hypot(dx,dy)
            return dx/n,dy/n
        u=unit(a);v=unit(c)
        center=(b[0]+RADIUS*(u[0]+v[0]),b[1]+RADIUS*(u[1]+v[1]))
        start=math.atan2(-v[1],-v[0]);end=math.atan2(-u[1],-u[0])
        sweep=(end-start+math.pi)%(2*math.pi)-math.pi
        for k in range(19):
            t=start+sweep*k/18
            result.append((center[0]+RADIUS*math.cos(t),center[1]+RADIUS*math.sin(t)))
    return result

def custom(number,poly,sx,sy,paste=False):
    x=-.9*sx;y=(-.6875 if paste else -.7)*sy
    pts=' '.join(f'(xy {px*sx-x:.6f} {py*sy-y:.6f})' for px,py in rounded(poly))
    layers='"F.Paste"' if paste else '"F.Cu" "F.Mask"'
    margin=' (solder_paste_margin 0) (solder_paste_margin_ratio 0)' if paste else f' (solder_mask_margin {MASK})'
    return (f'  (pad "{number}" smd custom (at {x} {y}) (size 0.1 0.1) (layers {layers}){margin}\n'
            f'    (options (clearance outline) (anchor rect))\n'
            f'    (primitives (gr_poly (pts {pts}) (width 0) (fill yes))))\n')

def rect(number,x,y,w,h,layers):
    margin=f' (solder_mask_margin {MASK})' if 'F.Mask' in layers else ''
    if 'F.Paste' in layers:margin+=' (solder_paste_margin 0) (solder_paste_margin_ratio 0)'
    return (f'  (pad "{number}" smd roundrect (at {x} {y}) (size {w} {h}) '
            f'(layers {layers}) (roundrect_rratio {RADIUS/min(w,h):.9f}){margin})\n')

def text():
    s=f'''(footprint "{NAME}" (version 20240108) (generator "isolated_source_candidate")
  (layer "F.Cu")
  (descr "TI RPW0010A 4225183/A p73/74; no EP; source candidate, native unverified")
  (attr smd)
  (fp_text reference "REF**" (at 0 -1.9) (layer "F.SilkS") (effects (font (size 0.7 0.7) (thickness 0.12))))
  (fp_text value "TPS259474LRPWR" (at 0 1.9) (layer "F.Fab") (effects (font (size 0.7 0.7) (thickness 0.1))))
  (fp_rect (start -1 -1) (end 1 1) (stroke (width 0.1) (type default)) (fill none) (layer "F.Fab"))
  (fp_line (start -1 -0.6) (end -0.6 -1) (stroke (width 0.1) (type default)) (layer "F.Fab"))
  (fp_circle (center -1.4 -1.4) (end -1.35 -1.4) (stroke (width 0.1) (type default)) (fill none) (layer "F.SilkS"))
  (fp_rect (start -1.45 -1.45) (end 1.45 1.45) (stroke (width 0.05) (type default)) (fill none) (layer "F.CrtYd"))
'''
    for n,(sx,sy) in CORNERS.items():
        s+=custom(n,COPPER_L,sx,sy)+custom('',PASTE_L,sx,sy,True)
    for n,(x,y) in INNER.items():
        s+=rect(n,x,y,.6,.25,'"F.Cu" "F.Mask" "F.Paste"')
    for n,x in ((5,-.25),(6,.25)):
        s+=rect(n,x,0,.3,2.4,'"F.Cu" "F.Mask"')
        for y in (-.63,.63):s+=rect('',x,y,.28,1.06,'"F.Paste"')
    return s+')\n'

if __name__=='__main__':
    (Path(__file__).parent/'reviewed-candidates.pretty'/f'{NAME}.kicad_mod').write_text(text(),encoding='utf-8')
