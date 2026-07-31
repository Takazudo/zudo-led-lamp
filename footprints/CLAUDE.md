# CLAUDE.md - KiCad Library Management

This project uses [easyeda2kicad.py](https://github.com/uPesy/easyeda2kicad.py) to download KiCad footprints and symbols from LCSC/EasyEDA for the parts in the [Final BOM](../doc/src/content/docs/architecture/bom.mdx).

## File Organization

- **Footprints (master / source of truth)**: `footprints/kicad/*.kicad_mod`
- **Footprints (KiCad library resolution path)**: `footprints/kicad/zudo-led-lamp.pretty/*.kicad_mod`
- **3D models**: `footprints/kicad/zudo-led-lamp.3dshapes/*.{step,wrl}` — footprints reference the `.wrl` via `${KIPRJMOD}/../../footprints/kicad/zudo-led-lamp.3dshapes/`
- **Symbols**: `symbols/zudo-led-lamp.kicad_sym` (single file containing all project symbols)
- **KiCad projects**: `boards/board-p/` and `boards/board-l/` — one project per board (they are separate PCBA orders). Each has its own `sym-lib-table` / `fp-lib-table` registering library nickname `zudo-led-lamp` via `${KIPRJMOD}/../../...` paths into the shared root `symbols/` and `footprints/` dirs. Both projects MUST sit at the same depth (`boards/<name>/`) or the relative library and 3D paths break.

## Dual-location sync rule

> Every `.kicad_mod` file must exist in BOTH `footprints/kicad/` (master) AND `footprints/kicad/zudo-led-lamp.pretty/` (resolution path). A file only in the master dir will NOT resolve when KiCad opens the PCB. Copying into the `.pretty` dir is mandatory, not optional.

## Downloading parts

```bash
# Download both footprint and symbol for one LCSC part
easyeda2kicad --lcsc_id <LCSC_ID> --footprint --symbol --output /path/to/dl/zudo-led-lamp

# Then copy into the project
cp /path/to/dl/zudo-led-lamp.pretty/*.kicad_mod footprints/kicad/
cp /path/to/dl/zudo-led-lamp.pretty/*.kicad_mod footprints/kicad/zudo-led-lamp.pretty/
cp /path/to/dl/zudo-led-lamp.kicad_sym symbols/zudo-led-lamp.kicad_sym
```

Notes learned during the initial bulk download (2026-08-01):

- The EasyEDA API rate-limits bulk downloads with HTTP 403 after ~20 rapid requests. Space requests ~10 s apart, or wait ~90 s and retry on 403.
- Passives sharing a package (all 0603 resistors, etc.) share one footprint file (`R0603.kicad_mod`); the tool errors with "already exists" on the footprint but still adds the symbol. That error is expected and harmless.
- The symbol file is append-only per part; `--overwrite` replaces an existing entry.

## Hand-created footprints

Parts with no LCSC/EasyEDA source (bare pads, pogo/test pads, silkscreen art) are drawn by hand in the same S-expression format, saved to BOTH locations like downloaded ones.

Current inventory:

- `PogoPad_1x04_P2.54mm` — Board P J2, NVM I2C programming (SCL/SDA/GND/NC silkscreen)
- `PogoPad_1x08_P2.54mm` — Board P J3, STUSB4500 debug pads
- `PogoPad_1x03_P2.54mm` — Board L J4, UART debug (TX/RX/GND silkscreen)

The 1x04/1x08 are proven pad arrays for an edge-clamp programming clip (place at the PCB edge, silkscreen line marks the edge side); the 1x03 follows the same style. Matching schematic symbols `Conn_1x03/1x04/1x08` live in `symbols/zudo-led-lamp.kicad_sym`.

## Rotation warning (CPL export)

EasyEDA-derived footprints are already drawn in JLCPCB's pin-1 convention. When exporting CPL with kicad-jlcpcb-tools, add explicit rotation overrides in its Corrections Manager for every footprint family here (SOT-23, TSOT-23-6, MSOP-8-EP, QFN-24-EP, TSSOP-20) BEFORE trusting a generated CPL — generic rules like `^SOT-23 → -90°` over-correct these footprints. See `doc/src/content/docs/architecture/next-steps.mdx` (Footprint pipeline).

## Downloaded inventory (initial batch, all 32 BOM lines)

All fitted + DNP + footprint-only parts from both boards were downloaded 2026-08-01, including J3's suggested pin header (C492404). 3D models (`--3d`, both `.step` and `.wrl`) were downloaded for all parts; every footprint's model reference was verified to resolve.
