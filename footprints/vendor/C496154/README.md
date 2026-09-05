# Dailywell C496154 PCB assembly assets

Selected part: **1MS1T1B1M1QES-5 / C496154**. On 2026-09-06 JST the
[exact JLCPCB listing](https://jlcpcb.com/partdetail/C496154) showed 1,080 in stock,
995 available to order, Extended, Wave Soldering, and Economic/Standard PCBA.
These are dated observations, not a reservation or approval of this board's geometry.

The exact Dailywell drawing (1MSP0694, revision B, 2017 temperature amendment)
identifies **solder lugs and panel mounting**. The distributor's generic “PC Pin”
attribute does not change that identity. JLCPCB supplies this part for assembly;
its EasyEDA footprint accommodates the lugs with plated slots. Support the threaded
bushing with the enclosure and nuts; do not rely on solder joints to resist use.

## Sources and pin identity

- Exact drawing PDF SHA256: `74dfeb6b3051a03f56ed026f5dcded1f2f90d432d8db171fe68f25534c2b510c`.
- Symbol, footprint, STEP and WRL imported with `easyeda2kicad --lcsc_id C496154 --footprint --symbol --3d`.
- Original WRL SHA256: `1639e71b3704a90d3ab7456c073ece3a8489a877e5387d15d947d131b1226ca3`.
- Original STEP SHA256: `d2d33ef03a28eebe6350dfd5ccebddc979703863a1e29337a0c862b11dcc6c54`.
- Canonical footprint: `SW-TH_1MS1T1B1M1QES-5`; original model basename ends in
  `_L12.7-W6.9-H28.7-P4.7`. The model bytes and unit scale remain unchanged.
- Footprint pins: 1 at (0, +4.7), 2 at (0, 0), 3 at (0, -4.7) mm.
  Manufacturer terminal view and model lug centres agree. Pin 2 is common;
  one stable position connects 2–1 (lamp ON), the other 2–3 (lamp OFF).
  Pin 3 is deliberately unwired on the PCB but **live in OFF**.

## Project-adapted slots and courtyard

The imported 2.2 × 1.0 mm slots only accommodate nominal 2.03 × 0.76 mm lugs.
The project uses **4.0 × 2.4 mm plated oval slots**, **5.0 × 3.4 mm oval copper**,
4.7 mm pitch, and an 8 × 14 mm courtyard. These are project-derived dimensions,
not a manufacturer-recommended land pattern.

The drawing's ±0.25 mm general dimensional and ±5° angular tolerances give a
2.28 × 1.01 mm maximum rectangular lug. We additionally allow ±0.25 mm terminal
centre displacement and ±0.05 mm PCB registration (the latter is a design allowance,
not a claim of a quoted fabrication tolerance). JLCPCB lists plated-slot size
[tolerance +0.13 / −0.08 mm](https://jlcpcb.com/capabilities/Capabilities?type=1).
At the minimum 3.92 × 2.32 mm slot, the rounded-end radius is 1.16 mm and its
straight centre segment has half-length 0.80 mm. Bounding every corner across
±5° and ±0.30 mm total displacement gives:

```text
x = 1.14 cos(5°) + 0.505 sin(5°) + 0.30
y = 0.505 cos(5°) + 1.14 sin(5°) + 0.30
sqrt((x - 0.80)^2 + y^2) < 1.16 mm
```

This checks the rounded ends, not just a rectangular opening. Nominal copper
annulus is 0.50 mm; after +0.13 mm slot size and the 0.05 mm registration allowance,
it remains 0.385 mm. Run `python3 footprints/vendor/C496154/verify-fit.py`.
Actual fabrication registration, insertion, solder fill and assembly handling must
be checked with the fabricator and first prototypes. A larger slot is not proof
that this modified footprint has already been accepted by JLCPCB.

## Model origin and enclosure handoff

The imported model's housing begins approximately 0.06 mm above its PCB plane;
seal bottom is 0.46 mm, lug tips −3.50 mm, and maximum actuator height 28.67 mm.
On a 1.6 mm PCB, lugs therefore protrude about 1.90 mm on the opposite face,
plus solder. Check that volume against front LEDs and the light chamber.

The drawing gives an 8.89 mm body and 8.89 mm threaded bushing, then a 10.41 mm
actuator projection. The enclosure support plane must intersect the bushing above
the housing while leaving engagement for the nuts. The opening is 6.35 mm with
keyway details; the optional locking-ring layout adds a 2.38 mm locating hole
6.10 mm from centre. Use the exact drawing for the profile. Enclosure thickness,
nut stack, finger access and actuator travel remain prototype fit decisions.
