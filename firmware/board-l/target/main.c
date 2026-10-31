/* Board L target skeleton. Brings the MCU up with the lamp OFF and keeps it OFF.
 * There is no light command source yet: the V72 lamp core, ADC and NTC paths
 * are not wired in, and no product parameters are chosen. */
#include <stdint.h>
#include "board_ctrl.h"
#include "clock.h"
#include "stm32g031_regs.h"

#define TICK_HZ 1000u

static volatile uint32_t g_ticks;
volatile enum clock_result g_clock_result;

void SysTick_Handler(void)
{
    g_ticks++;
}

static int systick_start(uint32_t hclk_hz)
{
    uint32_t reload = hclk_hz / TICK_HZ;
    if (reload == 0u || reload - 1u > SYST_RVR_MAX)
        return 0;
    SYST_RVR = reload - 1u;
    SYST_CVR = 0u;
    SYST_CSR = SYST_CSR_CLKSOURCE | SYST_CSR_TICKINT | SYST_CSR_ENABLE;
    return 1;
}

int main(void)
{
    board_ctrl_force_off();                 /* 1. CTRL defined low as a GPIO output  */
    g_clock_result = clock_init_64mhz();    /* 2. 64 MHz, or stay on HSI16 on failure */
    board_ctrl_pwm_init_zero();             /* 3. TIM3 at 0 %, then PA6 -> TIM3_CH1  */
    if (!systick_start(clock_hclk_hz(g_clock_result))) {
        for (;;)
            board_ctrl_force_off();
    }

    uint32_t seen = g_ticks;
    for (;;) {
        __asm volatile("wfi");
        if (g_ticks != seen) {
            seen = g_ticks;
            board_ctrl_apply_zero();        /* 4. re-apply OFF on every control tick */
        }
    }
}
