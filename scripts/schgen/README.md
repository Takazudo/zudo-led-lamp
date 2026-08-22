# schgen — schematic generation from board spec modules

The `board-p`, `board-l`, and `swd-adapter` schematics are not hand-drawn. Each
is generated from a Python spec module (`board_p_spec.py`, `board_l_spec.py`,
or `swd_adapter_spec.py`) that lists components, positions, nets, and
no-connects. The spec is the source of truth; the `.kicad_sch` file is a build
artifact of it.

## Files

- `board_p_spec.py`, `board_l_spec.py`, `swd_adapter_spec.py` — per-project
  `COMPONENTS` / `NETS` / `NO_CONNECT` tables. Edit these, not the
  `.kicad_sch` directly.
- `schgen_core.py` — shared generator: reads symbols from
  `symbols/zudo-led-lamp.kicad_sym`, places components, and emits global
  labels for every net (no drawn wires) plus no-connect markers.
- `sexp.py` — tiny, dependency-free KiCad s-expression tokenizer/parser used
  by both the generator and the verifier. No KiCad install required.
- `gen_schematic.py` — CLI entry point: `generate()` a board from its spec.
- `verify_netlist.py` — diffs a kicad-cli netlist export against a spec's
  `NETS`/`NO_CONNECT` tables and prints `PASS`/`FAIL`.
- `verify.sh` — wraps the kicad-cli export + `verify_netlist.py` call for one
  board. Local-only (see below); not run in CI.

## Regen + verify workflow

1. Edit the relevant spec module — add/move a component, change a net, etc.
2. Regenerate the schematic:
   ```
   python3 scripts/schgen/gen_schematic.py swd_adapter_spec
   ```
   This rewrites `boards/<board>/<board>.kicad_sch` in place. No KiCad
   install needed — `gen_schematic.py` only depends on `sexp.py`.
3. Verify connectivity against a real netlist export (requires a local KiCad
   install with `kicad-cli` on `PATH`):
   ```
   scripts/schgen/verify.sh swd-adapter
   ```
   This runs `kicad-cli sch export netlist --format kicadsexpr` on the
   regenerated `.kicad_sch`, then diffs the result against the spec's `NETS`
   and `NO_CONNECT` tables via `verify_netlist.py`, printing `PASS`/`FAIL`.
4. Open the regenerated schematic in KiCad's Eeschema at least once (ERC,
   visual sanity) before committing.
5. Commit the spec module and the regenerated `.kicad_sch` together — never
   one without the other.

## kicad-cli availability

`verify.sh` degrades gracefully when `kicad-cli` is not on `PATH`: it prints
a `SKIPPED` marker and exits `0` rather than failing. This is intentional —
netlist verification is a local-only check that needs a real KiCad install
(the CI runner has no KiCad). Install KiCad (kicad-cli ships with the
desktop app; on macOS it resolves from `/Applications/KiCad/KiCad.app`) to
exercise the real path.

## What CI checks instead

CI cannot run kicad-cli, so it enforces a weaker but still useful invariant:
**regen-idempotency**. It runs `gen_schematic.py` for all three projects against the
checked-out tree and fails the build if that changes anything under
`boards/` (`git diff --exit-code boards/`). This catches "spec and committed
schematic have drifted apart" — e.g. someone edited a spec module and forgot
to regenerate, or hand-edited a `.kicad_sch` directly. It does **not** catch
wiring mistakes; only a local `verify.sh` run (or opening the file in KiCad)
does that.
