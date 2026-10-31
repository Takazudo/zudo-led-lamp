"""Rebuild the V199 scratch candidate from the committed V198 files.

Each recommended option is one named change. Any of them can be dropped with
--skip NAME, and the rest still apply, because no change depends on another.
The PCB keeps every footprint on one long line, so `git revert` of a single
commit would conflict. Rebuilding with --skip is how you drop one change.

Usage (from the repository root):
  python3 -I candidates/board-p-v199-pending-user-decision/tools/build_v199.py \
      [--skip NAME ...] [--out DIR]
"""
import argparse
import shutil
import uuid
from pathlib import Path

HERE = Path(__file__).resolve().parent
V199 = HERE.parent
V198 = V199.parent / "board-p-v198-unadopted"
BASE = "board-p-COUT1206-TRIAL"
NS = uuid.UUID("6b9d6c0e-1f70-4d0b-9b8e-199000000000")
ROOT_SHEET = "504a03fe-2ef9-52ee-8b8d-97d09bd9c311"


def uid(tag):
    return str(uuid.uuid5(NS, tag))


def sub1(text, old, new, what):
    n = text.count(old)
    if n != 1:
        raise SystemExit(f"{what}: expected 1 match, found {n}: {old[:80]!r}")
    return text.replace(old, new)


# --- change 1: RMH2 180k -> 187k (FAILOFF-WINDOW.md option O3) -------------
# Value-only change on the same land. The RT0603BRD07187KL LCSC code is not
# verified, so the LCSC fields are left empty rather than guessed.
RMH2_OLD_VAL = "180k 0.1% / RT0603BRD07180KL"
RMH2_NEW_VAL = "187k 0.1% / RT0603BRD07187KL"
RMH2_MPN = "RT0603BRD07187KL"


def rmh2_187k(f):
    sch = f["sch"]
    sch = sub1(sch, f'(property "Value" "{RMH2_OLD_VAL}" (at 279.4 353.06 0)',
               f'(property "Value" "{RMH2_NEW_VAL}" (at 279.4 353.06 0)', "RMH2 sch value")
    sch = sub1(sch, '(property "LCSC" "C326731" (at 279.4 363.22 0) (effects (font (size 1.27 1.27)) (hide yes)))',
               '(property "LCSC" "" (at 279.4 363.22 0) (effects (font (size 1.27 1.27)) (hide yes)))'
               f' (property "MPN" "{RMH2_MPN}" (at 279.4 363.22 0) (effects (font (size 1.27 1.27)) (hide yes)))',
               "RMH2 sch LCSC")
    f["sch"] = sch

    pcb = f["pcb"]
    start = pcb.index('(footprint "rmh2-candidate:')
    end = pcb.index('(footprint "', start + 10)
    blk = pcb[start:end]
    blk = sub1(blk, '(property "LCSC" "C326731"', '(property "LCSC" ""', "RMH2 pcb LCSC")
    blk = sub1(blk, '(property "LCSC Part" "C326731"', '(property "LCSC Part" ""', "RMH2 pcb LCSC Part")
    blk = sub1(blk, f'(fp_text value "{RMH2_OLD_VAL}"', f'(fp_text value "{RMH2_NEW_VAL}"', "RMH2 pcb value")
    blk = sub1(blk, '(fp_text reference "RMH2"',
               f'(property "MPN" "{RMH2_MPN}" (at 0 0) (layer "F.Fab") (hide yes) '
               f'(effects (font (size 1 1) (thickness 0.15))) (uuid "{uid("RMH2/MPN")}")) '
               '(fp_text reference "RMH2"', "RMH2 pcb MPN")
    f["pcb"] = pcb[:start] + blk + pcb[end:]

    f["bom"] = sub1(f["bom"],
                    "RMH2,180k 0.1% / RT0603BRD07180KL,,C326731,",
                    f"RMH2,{RMH2_NEW_VAL},{RMH2_MPN},,", "RMH2 bom")
    f["bom"] = f["bom"].replace(
        "rmh2-candidate:RMH2_RT0603BRD07180KL_YAGEO_REFLOW_CANDIDATE,UNADOPTED engineering source",
        "rmh2-candidate:RMH2_RT0603BRD07180KL_YAGEO_REFLOW_CANDIDATE,PENDING USER DECISION (O3); LCSC UNBOUND")


CHANGES = [
    ("rmh2-187k", rmh2_187k),
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--skip", action="append", default=[], choices=[n for n, _ in CHANGES])
    ap.add_argument("--out", default=str(V199))
    a = ap.parse_args()
    out = Path(a.out)
    if out.resolve() != V199.resolve():
        out.mkdir(parents=True, exist_ok=True)
        for name in (f"{BASE}.kicad_pro", "fp-lib-table", "sym-lib-table"):
            shutil.copyfile(V198 / name, out / name)
        shutil.copytree(V198 / "libraries", out / "libraries", dirs_exist_ok=True)
    f = {
        "pcb": (V198 / f"{BASE}.kicad_pcb").read_bytes().decode("utf-8"),
        "sch": (V198 / f"{BASE}.kicad_sch").read_bytes().decode("utf-8"),
        "bom": (V198 / "BOM-TRIAL.csv").read_bytes().decode("utf-8"),
        "libs": {},
    }
    for name, fn in CHANGES:
        if name in a.skip:
            print(f"skip  {name}")
            continue
        fn(f)
        print(f"apply {name}")
    (out / f"{BASE}.kicad_pcb").write_bytes(f["pcb"].encode("utf-8"))
    (out / f"{BASE}.kicad_sch").write_bytes(f["sch"].encode("utf-8"))
    (out / "BOM-TRIAL.csv").write_bytes(f["bom"].encode("utf-8"))
    for rel, text in f["libs"].items():
        p = out / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(text.encode("utf-8"))


if __name__ == "__main__":
    main()
