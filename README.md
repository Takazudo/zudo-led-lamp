# zudo-led-lamp

USB-PD powered LED lamp with fire/wave-like brightness modulation.

Docs: https://zudo-led-lamp.takazudomodular.com/

## Repo layout

- `doc/` — zudo-doc documentation site (source of truth for specs, notes, and build logs)
- `boards/board-p/` — KiCad project: USB-PD front end board
- `boards/board-l/` — KiCad project: driver + control + LED array board
- `boards/swd-adapter/` — KiCad project: ST-LINK/V2 20-pin to Board L 1x5 SWD adapter
- `symbols/`, `footprints/` — shared KiCad symbol/footprint/3D libraries for all projects (see `footprints/CLAUDE.md`)
