---
name: component-al8860mp-13
description: Audit the exact AL8860MP-13 LED-driver stage and its RLP25FEER200 sense resistor, FXL0630-330-M inductor, and R+O SS26 catch diode. Use for Board L LED current, CTRL/PWM behavior, pins, thermal/layout limits, faults, substitutions, bring-up, or power-stage calculations involving C500782, C459674, C177245, or C7420363.
---

# AL8860MP-13 power-stage audit

Run the central offline validator, then read every local JSON file. Resolve the standalone AL8860 and each subordinate by exact MPN or LCSC ID; never substitute another SS26 vendor or generic magnetic data.

Use facts as conditioned records, not headline ratings. Keep 40 V recommended VIN separate from 42 V absolute maximum, and treat the R+O/cjiang mirror facts as `UNSOURCED` or `NEEDS BENCH`. Recompute current and power margins only from the listed raw fact IDs. Do not turn typical curves or unverified project LED voltage/temperature into a guaranteed PASS.

For design or bring-up questions, report source IDs, fact IDs, locators, conditions, and one frozen verdict. Verify generated pin/net assertions, EP thermal handling, the SET resistor path, the hysteretic current loop, diode polarity, inductor peak/thermal current, CTRL state, and open/short behavior. Load the integration skill for cross-rail, LED-string, thermal, or firmware interactions; do not silently alter design state.
