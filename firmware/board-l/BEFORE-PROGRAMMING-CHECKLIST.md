# Board L: checklist before any programming or energizing

**Status:** PROCEDURE ONLY. Nothing here has been executed, and nothing here gives
permission. Programming a Board L, including its option bytes, needs the owner's explicit
permission. Energizing a Board L needs the same.

Record every reading with the board serial, date, instrument and firmware commit.

A reading outside its expectation is a **stop** condition: power down, record it, and do
not continue.

Pin and net names are from `scripts/schgen/board_l_spec.py`. Firmware values are from
`target/board_l_proposal.h`. The current analysis is in
`candidates/board-l-led-margin-52/ANALYSIS.md`.

## 0. Programming energizes the LED driver

- The ST-LINK/V2 adapter only senses target voltage on J3.4. Board L must supply its own
  3.3 V ([SWD adapter](../../doc/src/content/docs/architecture/swd-adapter.mdx)).
- V3P3 comes from U4 (AP63203), which runs from V15. So programming needs V15 present.
  V15 also powers U2 (AL8860) and the LED array.
- What keeps the LEDs off during programming:
  - a blank or halted MCU leaves PA6 undriven;
  - R21 (33 kΩ) then holds CTRL low.
- Back-feeding V3P3 from a bench supply with V15 absent has **not been evaluated**. Do not
  use it as a "safe" programming mode without a separate review.

## 1. Unpowered checks (no source connected, SW2 OFF)

| # | Check | Expect | Why |
| --- | --- | --- | --- |
| 1.1 | Read the RS1 value **by 4-wire (Kelvin) resistance** across the RS1 pads. The marking code is not in the retained evidence, so do not rely on it | 200 mΩ ±1 % as built (RLP25FEER200), or 250 mΩ if reworked (RLP25FEER250) | Selects the duty ceiling, below |
| 1.2 | Confirm the firmware ceiling matches 1.1 | 200 mΩ requires `CTRL_FULL_CCR` 2452, the default. 3200 is allowed **only** if 1.1 measured 250 mΩ and the owner approved it | #52: the default keeps the hot branch ≤ 81 mA at h = 30 % (typical CTRL transfer only) |
| 1.3 | Resistance TP1 (CTRL) to GND | About 33 kΩ (R21), possibly lower through R20 into the unpowered PA6 | The pull-down that holds CTRL OFF is present |
| 1.4 | R20 10 kΩ, R21 33 kΩ, C21 present (visual, plus 1.3) | Fitted | The CTRL filter and OFF path |
| 1.5 | V15 to GND, V3P3 to GND | No short | First power |
| 1.6 | J3 order: 1 SWDIO, 2 SWCLK, 3 NRST, 4 V3P3 (sense), 5 GND. Align the pin-1 marks at both ends | As listed | Unkeyed headers |
| 1.7 | SW2 position | OFF | No input path before the source is connected |

## 2. First energizing, MCU blank or not yet programmed (only with permission)

Use a current-limited source if one is available. Measure each point within seconds of SW2
ON.

| # | Point | Expect | Stop if |
| --- | --- | --- | --- |
| 2.1 | V15 (C10) | Within the rail's input range | Out of range |
| 2.2 | V3P3 (C16/C17) | About 3.3 V | Outside 3.27–3.33 V. That is the analysis range, so outside it the CTRL numbers no longer hold |
| 2.3 | TP1 (CTRL) | About 0 V | **> 0.2 V**, the typical AL8860 off threshold, which is not guaranteed |
| 2.4 | RS1 drop (V15 − SET) | About 0 mV, no LED current | Any visible light, or a measurable drop |
| 2.5 | NTC_SENSE (C24) | About 0.30 V at 25 °C (board-l.mdx) | Near 0 V (short) or near 3.3 V (open) |
| 2.6 | BRIGHT_ADC (C22) across the knob range | Follows the knob, 0 to about 3.2 V (R22 loads the wiper) | Stuck |

## 3. Option-byte readback plan (read before any write)

1. With the probe attached (connect under reset, NRST on J3.3), **read only**
   FLASH_OPTR at 0x40022020. Save the raw 32-bit value and the probe log.
2. Decode the fields (ST `stm32g031xx.h`):

   | Field | Bits | Proposed target |
   | --- | --- | --- |
   | RDP | 7:0 | 0xAA, Level 0. Never Level 2 |
   | BOR_EN | 8 | 1 |
   | BORR_LEV | 10:9 | 3 |
   | BORF_LEV | 12:11 | 3 |
   | IWDG_SW | 16 | 1 in development, 0 in production |
   | WWDG_SW | 19 | 1 |
   | nBOOT_SEL / nBOOT1 / nBOOT0 | 24 / 25 / 26 | 1 / 1 / 1 |
   | NRST_MODE | 28:27 | 3 |
   | Others | — | Unchanged from step 1 |

3. Only with explicit permission, write the target values. Then read FLASH_OPTR back:
   - after programming;
   - after OBL_LAUNCH;
   - after a full power cycle.

   All three readbacks must match the target value.
4. Check that the board boots from main flash with PA14 floating, and again with the probe
   attached. This is the #46 acceptance (owner skill `cov-c529334-options`).
5. The firmware refuses all light unless BOR_EN = 1 and both BOR levels are 3. With
   unprogrammed option bytes, a programmed image must therefore keep TP1 at about 0 V.
   `g_boot_decision.refusals` should then contain 0x2 (BOR disabled) and/or 0x4 (BOR level).
   Use this as a check of the gate itself.

## 4. Image identity (before writing flash)

Record:

- the git commit;
- the `make` size output;
- the SHA256 of `build/board-l-skeleton.elf`;
- the `CTRL_FULL_CCR` value used, which must agree with check 1.2;
- whether `BOARD_L_PRODUCTION` was defined.

Production builds do not freeze the IWDG under the debugger.

## 5. First run with the image (only with permission). Measure, do not tune

| # | Point | Expect (nominal, typical AL8860 transfer) | Stop if |
| --- | --- | --- | --- |
| 5.1 | TP1 at power-on, before the ramp | About 0 V | > 0.2 V |
| 5.2 | TP1, knob at minimum | 0 V (hard OFF) | — |
| 5.3 | TP1, knob just above the off band | About 0.41 V (CCR 518, the 5 % floor) | — |
| 5.4 | TP1, knob at maximum | About 1.94 V (2452/3200 × 3.3 V × 33/43). The ramp to it takes about 2.5 s | > 2.0 V with the default ceiling |
| 5.5 | RS1 drop at maximum → total mean current | About 78 mV / 200 mΩ ≈ 388 mA (typical) | > 81 mV (0.776 × the 104 mV VSENSE maximum) |
| 5.6 | Each ballast R30–R37 (33 Ω) drop → branch mean | About 1.6 V (≈ 48 mA) | Any branch > 81 mA **mean**. Peak needs 5.7 |
| 5.7 | Coil/LED_N current ripple at minimum and maximum V15 (scope) | Gives the real h, the unpublished VSENSE_HYS | Peak = mean × (1 + h) > 81 mA on the hottest branch |
| 5.8 | Pulse-skip sweep near the floor (LED_N on a scope) | The burst rate | Bursts < ~300 Hz: raise `CTRL_MIN_CCR` (board-l.mdx Gate 4) |
| 5.9 | NTC_SENSE against a thermocouple at the hottest LED solder point | The NTC-to-TS correlation | Derate (code 104) must begin before TS ≈ 76 °C at 250 mΩ, and earlier at 200 mΩ |

## 6. OFF-path checks on the bench

All of these are debugger-observable. Each must end with TP1 at about 0 V.

| # | Action | Expect |
| --- | --- | --- |
| 6.1 | Knob to minimum | OFF; light returns when the knob is raised |
| 6.2 | Open the NTC, e.g. lift RT1 or disconnect it only if a fixture allows | OFF, latched until a reset. **Do not rework the board just for this test without approval** |
| 6.3 | Halt in the debugger, development build | Record TP1. TIM3 is not frozen by this firmware, so CTRL keeps its last duty while halted. The IWDG is frozen in development builds only |
| 6.4 | Three software resets (SYSRESETREQ) in a row without a power cycle | OFF after the third (`g_reset_record.count` = 3); a pin reset keeps it OFF |
| 6.5 | Power cycle after 6.4 | Light allowed again (count 0) |
| 6.6 | Stop refreshing the IWDG, e.g. hold a breakpoint in a production build | A reset in about 100 ms. The LSI tolerance is [DS] |

Close by recording which rows ran, which did not, and why.
