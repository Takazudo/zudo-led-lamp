# G-Switch C5446803: project-derived G020 model

Selected part: **SS-12D01-G020 / C5446803**. The component's electrical, supplier
availability and footprint evidence is maintained by its component record. This
folder documents the CAD correction only.

The corrected `SW-TH_SS-12D01-G020.step` and `.wrl` are **project-derived from
supplier family CAD**, not unmodified, exact manufacturer CAD. Both describe the
same solid. The WRL uses a neutral gray material; supplier material colors are not
preserved.

## Source discrepancy

The EasyEDA assets retrieved for C5446803 are named `SW-TH_SS-12D01-GX`, a family
model. Their original bytes are retained here for reproducibility:

- STEP SHA256: `f6c8743b8d28de4a7cbed027ee66539c66e565d853dd9f9d756137ad410e2356`.
- WRL SHA256: `8180e3e024b79f364bb46790d19ddc8ae63afa7a91d479e3e72e1c1cd8e6be80`.
- Manufacturer drawing `SS-12D01-GXXX`, revision X1, 2019-05-29; supplied PDF
  SHA256: `bdb6ae64b9de1156d00ad4aefee51b14a43ccd3aeaf1bdc2f86d2242f1fe68a1`.
  It gives a 3.5 mm case, G020 = 2.0 mm actuator projection, 1.5 mm square actuator,
  2 mm travel, 2.5 mm contact pitch, and 0.5 × 0.3 mm terminals.

The original STEP is one valid solid. Its case base/top planes are Z0 and Z3.5;
its actuator reaches Z7.5, hence **4 mm projection**, not the selected 2 mm.
The original WRL uses a different seating frame: case base/top approximately
Z0.4963/Z3.9962 and actuator top Z7.9962. Its tessellated lug tips are Z−4.3.
Using that unmodified family model would overstate the G020 actuator height.

## Exact correction and seating frame

`derive-model.py` performs an Open CASCADE Boolean cut above **source Z5.5**.
Only the actuator occupies that volume: X−1.75…−0.25, Y−0.75…+0.75, Z3.5…7.5.
The cut leaves a 1.5 × 1.5 × 2.0 mm exposed actuator in the source's left travel
position. It creates a flat actuator top; the taller family model's tip chamfer
is removed. The precise molding/chamfer of a purchased G020 remains unverified.

All geometry below the cut, including case, internal geometry and all three
terminals, is unchanged. Boolean difference checks verify this in both directions.
The model is **not scaled**. A rigid +0.5 mm Z translation places both outputs in
a common seating frame corresponding to the original WRL's approximate +0.4963
mm offset. This normalizes a roughly 0.004 mm mesh/frame discrepancy while keeping
the case tabs above the nominal PCB surface. The original STEP included case/tab
planes below its case-base Z0, down to Z−0.4; treating that original case base as
the PCB surface would bury those features.

Resulting coordinates, in mm:

| Feature | Geometry |
| --- | --- |
| Complete XY envelope | X−4.4…+4.4, Y−1.95…+1.95 |
| Housing base/top | Z0.5 / Z4.0 |
| Exposed actuator | Z4.0…6.0; 2.0 mm projection |
| Lug tips | Z−4.3 |
| Terminal centers | X−2.5, 0, +2.5; Y0 |
| Terminal section | 0.5 × 0.3 mm |
| Maximum reach above nominal PCB | 6.0 mm, including the 0.5 mm seating offset |

Thus 3.5 + 2.0 = 5.5 mm is **case-base-to-actuator-tip**, while this seated model
reaches 6.0 mm above the PCB plane. The 0.5 mm seating assumption and actual
insertion depth require prototype confirmation. On a 1.6 mm PCB, the retained
4.3 mm terminal reach gives about 2.7 mm protrusion on the opposite side, before
solder or trimming. Check that volume in the assembled enclosure.

## Reproduction and validation

Use Python 3.12+ and `cadquery-ocp==7.9.3.1.1`, then run:

```sh
python footprints/vendor/C5446803/derive-model.py
```

The script hash-checks its input, checks the actuator-only cut volume, verifies
all three terminal sections and pitch, checks Boolean identity below the cut,
exports real STEP geometry, reloads it and verifies validity/volume/bounds. It
meshes that reloaded solid for WRL at 0.005 mm deflection, then divides coordinates
by 2.54 for KiCad's 0.1-inch WRL units. No footprint model scale correction is
required: both model transforms remain identity.

The result remains one valid solid. Its volume changes from 111.710729 to
107.444729 mm³. The WRL has 10,093 vertices and 12,380 triangles. Full measured
values and hashes are in `model-audit.json`. Repeated generation was checked to
produce identical output hashes:

- Derived STEP: `fc474ae1f7fde48b66f40c479a7e512004d33b76240da28d623a281ec1a7d261`.
- Derived WRL: `fe38c0a93172ea73ea736917b20612818d97438ed1d9c4d20911c7c4f35240e7`.

The CAD correction establishes the selected actuator projection without inventing
an exact supplier G020 model. It is an enclosure-layout aid, not certification of
as-built tolerances, insertion depth, molding details or assembly acceptance.
