# NKK WR11AS panel component model

The user supplied `WR11AS.stl`, downloaded from NKK's CADENAS/PARTcommunity
catalog on 2026-09-05. The portal's accompanying receipt names STL / WR11AS.

- Manufacturer product: https://www.nkkswitches.com/wp-content/themes/impress-blank/search/inc/part.php?part_no=WR11AS
- Model catalog: https://nkkswitches-embedded.partcommunity.com/3d-cad-models/?info=nkkswitches%2Frocker%2Fwr%2Fwr_asmtab.prj
- CADENAS terms: https://www.cadenas.de/terms-of-use-3d-cad-models
- NKK model notice: https://www.nkkswitches.com/3d-cad-library/
- Original STL SHA-256: `2917e08e2385bf3d1d0bf3f46104c4ece401c84fe50b4056710842b9430e4abe`
- Supplied WR.pdf SHA-256: `946b50150b72c85c6e67fb71001167e09f0f86ecea53abfb2bafabf2fb11160f`, identical to the audited manufacturer PDF already linked on the component page.

The ASCII STL contains 1,540 triangles and no material/color data. Its coordinate
bounds are X ±0.4725, Y −1.394 to 0.307, Z ±0.807. These match the datasheet's
inch dimensions: a 0.945 × 1.614 inch bezel and 1.394 + 0.307 inch total depth.
STL itself has no unit declaration; the inch interpretation was checked against
B127, including the note that WR11 omits terminal 1.

Run `python3 footprints/external/WR11AS/convert.py` from the repo to regenerate
`footprints/kicad/zudo-led-lamp.3dshapes/WR11AS.wrl`. This preserves the mesh,
rotates +90° around X so the actuator points +Z, and multiplies coordinates by 10
for KiCad's 0.1-inch WRL convention. The website applies an additional 2.54 scale
to present millimetres and rotates −90° around X for the viewer's Y-up display. Bounds in the stored KiCad frame are approximately 24.003 × 40.996 ×
43.205 mm. Neutral grey is a display choice, not manufacturer material data.

This is a manufacturer-catalog representation, not a dimensioned manufacturing
solid or an approved enclosure fit. No STEP was supplied or fabricated. WR11AS
remains external SW2: these assets are not a PCB footprint and are not attached
to J5. Panel placement and harness geometry remain separate assembly decisions.
