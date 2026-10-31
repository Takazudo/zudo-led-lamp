# Board L target skeleton (STM32G031F8P6): builds, NEVER flashed

This is a minimal target bring-up layer on top of the unchanged V72 import in `../src/`.
It only brings the MCU up with the lamp **OFF** and keeps it OFF.

- It has no light-command source.
- The V72 lamp core, ADC and NTC are not wired in.
- No product parameters are chosen.

It has never run on hardware. Programming a Board L is a separate explicit permission.
There is no flash target.

## Files

| File | Role |
| --- | --- |
| `startup_stm32g031.c` | Vector table (47 entries, in ST order) and `Reset_Handler`. CTRL is driven low before RAM init. Fault and default handlers force CTRL low and stop |
| `stm32g031f8_flash.ld` | 64 KB flash at 0x08000000 and 8 KB RAM at 0x20000000, plus a 1 KB minimum stack check |
| `clock.c` | HSI16 → PLL (M 2, N 16, R 2) = 64 MHz with flash latency 2 WS. It stays on HSI if voltage range 1 is not confirmed or any ready-wait times out |
| `board_ctrl.c` | Safe CTRL (PA6) order and force-off path; see below |
| `main.c` | Force off → clock → TIM3 at 0 % → 1 kHz SysTick → re-apply 0 on every tick (`wfi` loop) |
| `stm32g031_regs.h` | Minimal register map; every value comes from ST/ARM headers (see `SOURCES.md`) |
| `verify/` | `make verify-regs` (static asserts against the ST/ARM headers) and `check_vectors.py` (vector order against ST's startup file) |

## Safe output order (PA6 → R20 10k → CTRL, R21 33k + C21 100 nF to GND)

1. GPIOA clock on → `BSRR` reset PA6 → push-pull, pull-down, low speed → **output low**.
2. TIM3 clock on, counter and output disabled. PSC 0, ARR placeholder, CCR1 = 0, PWM
   mode 1 with preload, then `UG`. In PWM mode 1, the output is active only while
   CNT < CCR1, so it is never active at 0.
3. CC1E and CEN are enabled. Only then does PA6 switch from GPIO-low to AF1 (TIM3_CH1).
4. On every 1 kHz tick, CCR1 is written as 0 again. Faults return PA6 to GPIO-low.

PA5/PA7 are never touched, so they keep their reset state. PA13/PA14 (SWD) and PA15 are
never touched either.

## Checks run on 2026-10-31

All of these are build-only; nothing ran on a target.

| Check | Result |
| --- | --- |
| `make` with arm-none-eabi-gcc 13.2.1 (Ubuntu 24.04 package `gcc-arm-none-eabi` 15:13.2.rel1-2) | PASS, `-Werror -pedantic`: text 1280 B, bss 8 B |
| `make v72-objects`: all 33 V72 `.c` files except `test_input_app.c`, cross-compiled for Cortex-M0+ | PASS, 33/33 (not linked) |
| `make host-test`: V72 host test with gcc 13.3.0 | **PASS 44**, exit 0 |
| `make verify-regs` against ST `cmsis_device_g0` + `stm32g0xx_hal_driver` + ARM CMSIS_5 | PASS; a negative test (PLLON bit altered) fails as expected |
| `verify/check_vectors.py` against ST `startup_stm32g031xx.s` | PASS, 47 entries |
| Flashing or running on a target | **NOT RUN** (not permitted) |

## Still open before any target run

- **Option bytes (#46):** `nBOOT_SEL`/`nBOOT0` and BOOT0 on PA14 decide whether this
  image boots at all.
- **Fault policy:** BOR level, watchdog and reset-cause handling.
- **Sensing:** ADC bring-up, the NTC table, calibration storage and knob parameters.
- **CTRL PWM:** period and polarity. `CTRL_PWM_ARR_PLACEHOLDER` gives 64 kHz and is not
  chosen.
- **V72 integration:** wiring `lamp_app` to this layer.
- **Bench check:** confirming no CTRL glitch at reset and handover with a scope.
- **CI:** a host-test job.
