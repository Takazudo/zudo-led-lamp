# Proposal: CTRL PWM, reset/watchdog policy and option bytes (#46)

**Status:** PROPOSAL, not user-approved and not bench-verified.

The values below are derived from:

- the Board L circuit (`scripts/schgen/board_l_spec.py`);
- AL8860 DS39014 Rev 8-2 (hash-matched to the retained copy);
- ST's official public code and data, pinned in `SOURCES.md`.

RM0444, the STM32G031 datasheet and the errata sheet are **not retained**: st.com was
unreachable, and this was not bypassed. Every item that depends on them is marked
**[DS/RM]**. The PWM values are already in `board_l_proposal.h`. The watchdog, BOR and
option-byte items are **not implemented** yet.

## 1. CTRL PWM: 20 kHz, active-high, zero = hard OFF

| Item | Proposal | Derivation |
| --- | --- | --- |
| Mode | TIM3_CH1 on PA6 (AF1), PWM mode 1, upcounting, CC1P = 0 | PA6 AF1 from ST open pin data. In PWM mode 1 the output is active while CNT < CCR1 (ST LL), so duty = CCR1 / (ARR + 1) |
| Polarity | **Active-high** | CTRL = duty × V3P3 × 33 / 43, so more duty means more current. Duty 0 gives 0 V, below the AL8860 disable level |
| Carrier | **20 kHz**: PSC 0, ARR 3199 (`CTRL_PERIOD_TICKS` 3200 at 64 MHz) | See the trade-off below |
| OFF | Command 0 gives CCR 0. `lamp_app` then calls `force_off`, which puts PA6 in GPIO output-low | Does not rely on the typical 0.2 V VEN(OFF) threshold |
| Floor | CCR 518 (16.2 %): 0.41 V nominal, about 5 % of I_NOM (typical) | DS recommended analog range is 5–100 % |
| Ceiling | CCR 2656 (83 %) while RS1 = 200 mΩ; CCR 3200 (100 %) once RS1 = 250 mΩ is fitted | `candidates/board-l-led-margin-52/ANALYSIS.md`. The ceiling uses the typical transfer only |
| Clock dependency | The lamp is **not started** unless the 64 MHz PLL locked | On the HSI fallback, ARR 3199 would give 5 kHz and about 4× the ripple |

**Carrier trade-off.** CTRL is filtered-analog: 7.67 kΩ with 100 nF gives a 207 Hz
cut-off. Worst-case CTRL ripple at 50 % duty scales as 1/f:

| Carrier | Ripple (p-p) | TIM3 resolution at 64 MHz |
| --- | --- | --- |
| 5 kHz | 187 mV | — |
| 20 kHz | 47 mV, about 2 % of the 2.2 V span | 3200 steps, 0.8 mV per step on CTRL |
| 64 kHz | 15 mV | 1000 steps |

20 kHz is the lowest carrier above the audio band. It keeps fine resolution for slow fades,
and it matches the documented Board L architecture.

The DS's "PWM < 500 Hz" guidance is for direct CTRL PWM dimming, which this circuit does
not do.

## 2. Reset and watchdog policy: reset is the safe state

**The hardware basis.** In reset, PA6 is not driven **[DS/RM: reset GPIO state]**. CTRL
then decays through R21 (33 kΩ × 100 nF, τ = 3.3 ms): from the worst-high 2.567 V to 0.2 V
in about **8.4 ms** (τ · ln(2.567 / 0.2)). This ignores the AL8860's internal CTRL source
current, which is unpublished. Any reset therefore turns the light off without firmware.

**The policy follows from that basis.**

1. **IWDG on.** Development: start it from software early in `main` (option IWDG_SW = 1).
   Production: hardware-started (IWDG_SW = 0), so a corrupted image cannot skip it.
   - Timeout: prescaler /32 and reload 100 give about 100 ms at the 32 kHz *typical* LSI
     (ST LL `LSI_VALUE`). That is two orders of magnitude above the 1 ms control tick.
   - The LSI limits are **[DS]**; the margin covers any plausible spread.
   - Refresh only in the main loop, after a `lamp_app_tick` returned. Never refresh from an
     ISR.
   - During debug, freeze the IWDG (DBG_APB_FZ1.DBG_IWDG_STOP), in development builds only.
2. **WWDG:** not used (WWDG_SW = 1).
3. **Reset cause.** At boot:
   - read RCC_CSR, then clear the flags with RMVF;
   - keep a `.noinit` RAM counter with a magic word;
   - after **3 consecutive** IWDG/WWDG/software/lockup resets without a power-on reset
     (PWRRSTF), stay OFF and never initialize the output until power is cycled.
   This adds a reset-level latch on top of `lamp_app`'s existing LATCH policy for sensors.
4. **BOR:** BOR_EN = 1 at the highest level, 4 (BORF "around 2.8 V", BORR "around 2.9 V",
   per the ST HAL comments).
   - This is the highest level below the 3.27 V rail minimum, so a sagging rail gives a
     safe reset before the ADC/NTC readings become meaningless.
   - The exact thresholds and hysteresis are **[DS]**.
5. **Faults:** HardFault and unhandled IRQs force CTRL low and spin. With the IWDG, they
   become counted resets (already implemented in `startup_stm32g031.c`).
6. **Clock failure:** stay OFF (implemented).

## 3. Option bytes for #46

Field names and encodings are from ST `stm32g031xx.h` and `stm32g0xx_hal_flash.h`.

| Field | Proposed | Why |
| --- | --- | --- |
| nBOOT_SEL | **1** (`OB_BOOT0_FROM_OB`) | BOOT0 comes from the option bit, not the PA14/SWCLK pin level at NRST rise. The PA14 boot-capture errata items are **[errata]** |
| nBOOT0 | **1** (`OB_nBOOT0_SET`) | BOOT0 = 0, so boot from main flash |
| nBOOT1 | 1 (`OB_BOOT1_SYSTEM`) | Only matters if BOOT0 = 1, which never happens with the two rows above |
| RDP | Level 0 (0xAA) in development | Level 1 (0xBB) for production is a user decision. Never Level 2 |
| NRST_MODE | 3 (`OB_RESET_MODE_INPUT_OUTPUT`) | Keeps NRST as a reset pin for SWD connect-under-reset (J3) |
| IWDG_SW | 1 in development, **0 in production** | Section 2 |
| IWDG_STOP / IWDG_STDBY | Unchanged | Stop and Standby are never used |
| WWDG_SW | 1 | Not used |
| BOR_EN / BORR_LEV / BORF_LEV | 1 / 3 / 3 | Section 2 |
| nRST_STOP / nRST_STDBY / nRST_SHDW | Unchanged | Low-power modes are not used |
| RAM_PARITY_CHECK, IRHEN | Unchanged | Not needed by this design. Factory defaults are **[RM]** |

**Acceptance evidence #46 still needs** (owner skill `cov-c529334-options`, NEEDS BENCH):

- FLASH_OPTR readback after programming;
- the same readback after OBL_LAUNCH, and again after a full power cycle;
- proof that the board boots from main flash with PA14 floating and with the SWD probe
  attached.

A blank device's empty-check boot behaviour, and when the option load takes effect, are
**[RM]**.

## 4. What truly needs the user

- **RS1 for #52:** 250 mΩ, 20 % less light, guaranteed margin; or keep 200 mΩ with the
  typical-only 83 % firmware ceiling.
- **Production RDP level:** 0 or 1.
- **Product feel:** ramp time (proposed 1 s), the brightness floor, and animation depth.
- **Explicit permission** to program any Board L, including writing option bytes.

Everything else above is derived. It still needs DS/RM confirmation where marked, and the
bench readbacks.
