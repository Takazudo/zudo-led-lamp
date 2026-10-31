# Isolated hardware candidates — NOT ADOPTED

Directories here hold isolated design candidates imported from outside Git history
for review. They are not canonical hardware: `boards/` and
`manufacturing/` remain the source of truth for what was ordered. Nothing here is
validated, qualified, released, or order-ready, and no fabrication output may be
generated from it without a separate explicit approval.

| Directory | Candidate | State |
| --- | --- | --- |
| [`board-p-v196-unadopted/`](board-p-v196-unadopted/PROVENANCE.md) | HUSB238_006DD 15 V-only shared Board P, V196 routed PCB | UNADOPTED; native DRC exit 5 (22 known findings), not DRC PASS |

The KiCad project directories sit two levels below the repository root on purpose:
their library footprints resolve 3D models via
`${KIPRJMOD}/../../footprints/kicad/zudo-led-lamp.3dshapes/`.
