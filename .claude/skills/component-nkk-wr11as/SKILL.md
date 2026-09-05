---
name: component-nkk-wr11as
description: Use to audit the exact NKK WR11AS external maintained lamp power rocker, its solder lugs, ratings and Board L hand-wire interface.
---

# NKK WR11AS external power rocker

Run the central component-spec-audit validator first. Read every JSON file in this owner bundle. WR11AS is a fitted panel component with no LCSC identity or PCB footprint. Route by exact MPN/manufacturer. Its external terminal map uses manufacturer terminal numbers in `footprint_pad`; these are solder lugs, not PCB pads.

Terminals 1a and 1b connect ON and open OFF; WR11 has no terminal 1. The 15 A / 30 V DC rating is for resistive load, not capacitor inrush qualification. Use circuit-spec-integration for F1, both converters, rail decay, ATT/PDOK, or debug back-power. Never infer contact wetting, harness assembly, PCB routing or bench state from the drawing.

## Supplied CAD model

The exact NKK/CADENAS STL and reproducible WRL conversion are documented in
`footprints/external/WR11AS/README.md` at the repository root. Public publication
is separately selected by `CIRCUIT_EXTERNAL_MODELS`. This is a standalone panel
component preview, not a PCB footprint, J5 model, or approved enclosure placement.

## Human component reference

Generated [WR11AS record](/docs/components/records/wr11as/), [catalog](/docs/components/catalog/) and [integration](/docs/components/integration/). The JSON evidence remains authoritative.
