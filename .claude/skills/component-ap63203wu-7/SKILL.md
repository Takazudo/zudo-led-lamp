---
name: component-ap63203wu-7
description: Audit the exact AP63203WU-7 3.3 V synchronous buck and its FNR4030S4R7MT inductor and CL21A226MAQNNNE output capacitors. Use for Board L V3P3 startup, EN-open behavior, pins, switching/fault timing, L/C stability, thermal/layout work, substitutions, or calculations involving C780769, C167874, or C45783.
---

# AP63203WU-7 logic-buck audit

Run the central offline validator and read every local JSON file. Resolve AP63203WU-7, FNR4030S4R7MT, and CL21A226MAQNNNE independently by exact MPN/LCSC; do not use a nearby AP6320x variant or generic 4.7 uH/22 uF part as evidence.

Keep 32 V recommended VIN, 35 V DC stress, and 40 V/400 ms transient distinct. Treat EN open as an intentional automatic-start state. Preserve uncertainty around minimum off-time, full-load magnetic heating, effective MLCC capacitance, switch-node behavior, and board thermal performance. The locked Samsung PDF confirms that Class II capacitance changes under DC voltage but gives no exact 3.3 V effective-capacitance value; never infer a guaranteed PASS from nominal capacitance.

Report conditioned facts with IDs, source locks, locators, and frozen verdicts. Check fixed-output FB sensing, BST-SW decoupling, L/C envelope, current-limit/hiccup behavior, hot-loop layout, and generated nets before reasoning. Load the integration skill for rail startup, input protection, MCU load, or thermal interactions; do not modify design state from an audit result.
