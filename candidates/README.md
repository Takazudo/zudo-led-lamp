# Isolated hardware candidates — NOT ADOPTED

Directories here hold isolated design candidates imported from outside Git history
for review. They are not canonical hardware: `boards/` and
`manufacturing/` remain the source of truth for what was ordered. Nothing here is
validated, qualified, released, or order-ready, and no fabrication output may be
generated from it without a separate explicit approval.

| Directory | Candidate | State |
| --- | --- | --- |
| [`board-p-v196-unadopted/`](board-p-v196-unadopted/PROVENANCE.md) | HUSB238_006DD 15 V-only shared Board P, V196 routed PCB | UNADOPTED; native DRC exit 5 (22 known findings), not DRC PASS |
| [`board-p-v198-unadopted/`](board-p-v198-unadopted/PROVENANCE.md) | V196 + PCB/schematic field sync, J1 bound to USB4105-GF-A / C3020560 | UNADOPTED; same 22 DRC findings (exit 5), not DRC PASS |
| [`FIRMWARE-V72-INVENTORY.md`](FIRMWARE-V72-INVENTORY.md) | Board L V72 portable C firmware, imported to [`firmware/board-l/`](../firmware/board-l/README.md) | Source only; not target-linked or flashed |

The KiCad project directories sit two levels below the repository root on purpose:
their library footprints resolve 3D models via
`${KIPRJMOD}/../../footprints/kicad/zudo-led-lamp.3dshapes/`.
