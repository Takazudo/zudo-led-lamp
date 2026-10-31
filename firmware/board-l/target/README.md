# Board L target skeleton (STM32G031F8P6): builds, NEVER flashed

This is a minimal target layer on top of the unchanged V72 import in `../src/`.

- The V72 `lamp_app` drives CTRL through `lamp_target.c`, an off-by-default adapter.
- Since phase 5 the ADC (PA0 knob, PA4 NTC) feeds the unchanged V72 `sample_adapter` through
  `board_samples.c`, with the graded thermal gain.
- Since phase 5 there is also a boot policy: IWDG, the reset-cause latch, and a BOR
  option-byte gate.
- PWM, ceiling, ramp, knob, NTC and policy values are **proposals** (`board_l_proposal.h`,
  `board_samples.h`, `PROPOSAL-CTRL-RESET-OPTIONS.md`), not approved product parameters.
- The procedure for a first bench session is
  [`../BEFORE-PROGRAMMING-CHECKLIST.md`](../BEFORE-PROGRAMMING-CHECKLIST.md). It has not
  been executed.

It has never run on hardware. Programming a Board L is a separate explicit permission.
There is no flash target.

## Files

| File | Role |
| --- | --- |
| `startup_stm32g031.c` | Vector table (47 entries, in ST order) and `Reset_Handler`. CTRL is driven low before RAM init. Fault and default handlers force CTRL low and stop |
| `stm32g031f8_flash.ld` | 64 KB flash at 0x08000000 and 8 KB RAM at 0x20000000, plus a 1 KB minimum stack check |
| `clock.c` | HSI16 → PLL (M 2, N 16, R 2) = 64 MHz with flash latency 2 WS. It stays on HSI if voltage range 1 is not confirmed or any ready-wait times out |
| `board_ctrl.c` | Safe CTRL (PA6) order and force-off path; see below |
| `main.c` | Force off → read and clear RCC_CSR, read FLASH_OPTR → start IWDG → clock → `boot_decide`. A clock failure halts without a watchdog refresh, so the IWDG resets and the reset is counted; a latch or option refusal parks OFF. Then SysTick → ADC → `board_samples` → `lamp_app_initialize_with_thermal_gain` (TIM3 at 0 %) → `lamp_app_tick` on each 1 kHz tick, with the IWDG refreshed in the main loop only |
| `board_policy.c/.h` | Portable. Reset-cause classification and the `.noinit` latch record (3 abnormal resets without a power-on reset → OFF). The option-byte gate refuses light unless BOR_EN = 1 and both BOR levels = 3. Boot decision |
| `board_samples.c/.h` | Portable. One ADC pair per tick → V72 `sample_adapter` (graded): age ≤ 2 ticks, knob window 8, endpoints 91..4000 (placeholders). NTC: open (≥ 3500) is unknown, ≤ 69 denies light, 104 → 69 linear gain |
| `board_iwdg.c/.h` | IWDG /32, reload 99 (about 100 ms at the typical LSI). The debugger freeze applies unless `BOARD_L_PRODUCTION` is defined |
| `board_adc.c/.h` | ADC1: PCLK/2, calibration, 160.5-cycle sampling, one software scan IN0 → IN4 with bounded waits. Any timeout or overrun fails the frame, which latches OFF |
| `lamp_target.c/.h` | `lamp_app_io` adapter. No output before a valid config; any refused config or mapping forces OFF. Zero → CCR 0 + GPIO-low. Positive → V72 `ctrl_timer_map` into [floor, ceiling], re-running the 0 % handover after an OFF |
| `board_l_proposal.h` | PROPOSED 20 kHz period, floor CCR, the **single** ceiling `CTRL_FULL_CCR` (default 2452 = 76.6 %, which protects an unchanged RS1 = 200 mΩ board; override `-DCTRL_FULL_CCR=3200` only after a measured 250 mΩ), ramp, latch count, IWDG and BOR fields |
| `test/test_lamp_target.c` | Host tests: startup OFF, knob zero → OFF, thermal invalid → OFF (latched), faults → OFF, ceiling enforced, default ceiling value, graded path without a reader → OFF |
| `test/test_board_policy.c` | Host tests: reset classification, latch after 3, pin resets do not clear it, power-on clears it, corrupt record, BOR disabled or wrong level → OFF, clock failure → OFF |
| `test/test_board_samples.c` | Host tests through the whole chain to a fake CTRL port. Covers: ramp to the ceiling; knob off band → OFF (not latched); NTC open, out of range, critical or shorted → OFF (latched); ADC failure, not-ok, knob out of range, stale or clock rollback → OFF (latched); bad sensor from the first sample; monotonic derate; init refusals |
| `stm32g031_regs.h` | Minimal register map; every value comes from ST/ARM headers (see `SOURCES.md`) |
| `verify/` | `make verify-regs` (static asserts against the ST/ARM headers) and `check_vectors.py` (vector order against ST's startup file) |

## Safe output order (PA6 → R20 10k → CTRL, R21 33k + C21 100 nF to GND)

1. GPIOA clock on → `BSRR` reset PA6 → push-pull, pull-down, low speed → **output low**.
2. TIM3 clock on, counter and output disabled. PSC 0, ARR = period − 1 (proposed 3199), CCR1 = 0, PWM
   mode 1 with preload, then `UG`. In PWM mode 1, the output is active only while
   CNT < CCR1, so it is never active at 0.
3. CC1E and CEN are enabled. Only then does PA6 switch from GPIO-low to AF1 (TIM3_CH1).
4. On every 1 kHz tick, `lamp_app_tick` re-applies the command; a zero command returns PA6 to GPIO-low. Faults also return PA6 to GPIO-low.

PA5/PA7 are never touched, so they keep their reset state. PA13/PA14 (SWD) and PA15 are
never touched either.

## Checks run on 2026-10-31 (updated in phase 5)

All of these are build-only; nothing ran on a target.

| Check | Result |
| --- | --- |
| `make` with arm-none-eabi-gcc 13.2.1 (Ubuntu 24.04 package `gcc-arm-none-eabi` 15:13.2.rel1-2) | PASS, `-Werror -pedantic`: text 10624 B, bss + .noinit 980 B (V72 `lamp_app`, `sample_adapter` and `input_conversion` linked; newlib-nano for `memcpy`/`memset` only) |
| `make target-host-test` | **PASS**: 5428 (lamp_target) + 36 (boot policy) + 70985 (sample chain) checks. Mutation runs fail as expected: no force-off, apply before init, thermal gate always open, open NTC known, ignore ADC not-ok, unity gain, no latch, no BOR refusal, power-on not clearing, pin reset counting, no clock refusal, graded unity, ceiling 3200 |
| `make v72-objects`: all 33 V72 `.c` files except `test_input_app.c`, cross-compiled for Cortex-M0+ | PASS, 33/33 (not linked) |
| `make host-test`: V72 host test with gcc 13.3.0 | **PASS 44**, exit 0 |
| `make verify-regs` against ST `cmsis_device_g0` + `stm32g0xx_hal_driver` + ARM CMSIS_5 | PASS. Now also covers IWDG, RCC_CSR, FLASH_OPTR (including the HAL `OB_BOR_LEVEL_*_3` and `OB_RESET_MODE_INPUT_OUTPUT` encodings), ADC1 and DBG. A negative test (PLLON bit altered) fails as expected |
| `verify/check_vectors.py` against ST `startup_stm32g031xx.s` | PASS, 47 entries |
| Flashing or running on a target | **NOT RUN** (not permitted) |

## Still open before any target run

- **Permission:** programming or energizing any Board L. Follow
  `../BEFORE-PROGRAMMING-CHECKLIST.md`.
- **Option bytes (#46):** they are not written by this firmware. Until BOR_EN = 1 with
  levels 3 is programmed, the image refuses all light by design.
- **Evidence gaps [DS/RM]:** LSI tolerance and the exact IWDG period, BOR thresholds,
  tADCVREG_STUP (2 ms is used), the ADC clock limit, the reset-state GPIO mode, and whether
  enabling the IWDG starts the LSI.
- **Calibration:** knob endpoints (91..4000 are bring-up placeholders) and the NTC-to-LED-TS
  correlation. Calibration storage is not defined.
- **Product choices:** gamma/transfer (none is applied; V72 has no default), noise and
  animation, ceiling 3200 after an RS1 change, and production RDP.
- **Latches:** any sensor fault latches OFF until a reset (V72 rule). Three abnormal resets
  latch until a power cycle. The policy is proposed and needs the owner's approval.
- **Bench:** no CTRL glitch at reset and handover (scope), and the measured h for #52.
- **CI:** a host-test job.
