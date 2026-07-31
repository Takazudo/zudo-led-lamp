# zudo-led-lamp

USB-PD powered LED lamp with fire/wave-like brightness modulation.

Docs: https://zudo-led-lamp.takazudomodular.com/

## Repo layout

- `doc/` — zudo-doc documentation site (source of truth for specs, notes, and build logs)
- `boards/board-p/` — KiCad project: USB-PD front end board
- `boards/board-l/` — KiCad project: driver + control + LED array board
- `symbols/`, `footprints/` — shared KiCad symbol/footprint/3D libraries for both boards (see `footprints/CLAUDE.md`)
