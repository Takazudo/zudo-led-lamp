# V199 Board P scratch candidate (PENDING USER DECISION, UNADOPTED)

**Status: PENDING-USER-DECISION / UNADOPTED.** This is a scratch engineering
candidate built from V198 using the options recommended in
`../board-p-v196-unadopted/FAILOFF-WINDOW.md` and `DRC-CLASSIFICATION.md`. Every one of
those options is still a user decision. It is an unvalidated draft and is not order-ready.
No fabrication or assembly output exists, and none may be produced from it.

Parent: `../board-p-v198-unadopted/`. Every file here is rebuilt from the V198 files by
`tools/build_v199.py`, using one named change per option. Rebuilding with `--skip NAME`
drops that option. Git revert cannot do this, because the PCB keeps all footprints on
one line and the commits touch the same line.

| Change (`--skip` name) | What | Decision it waits on |
| --- | --- | --- |
| `rmh2-187k` | RMH2 value: 180k → 187k 0.1 % (RT0603BRD07187KL). Same land and same footprint ID. LCSC is left empty because no code is verified | O3 and the RAW ≥ 14.0 V LED-first scope |
| `cout-datasheet` | Adds the COUT `Datasheet` property to the PCB footprint, copied from the schematic URL. This clears the one V198 field-parity notice | None; this is a field sync |
| `j1-gnd-trim` | J1 A1/B12 and B1/A12 GND lands are shortened 0.025 mm at the end facing the Ø0.65 mm NPTH: length 1.15 → 1.125 mm, centre moved 0.0125 mm away from the hole. Applied to both the PCB and the candidate library footprint. The nominal hole-to-land distance goes 0.1751 → 0.2001 mm | The J1 GND choice: waiver or trim. This departs from the printed GCT land pattern |
