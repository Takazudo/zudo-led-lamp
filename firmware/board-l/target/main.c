/* Board L target skeleton: the V72 lamp_app drives CTRL through lamp_target.c.
 * There is still no sample source (ADC, NTC and knob calibration are not
 * implemented), so the adapter reports UNCONFIGURED reads and the lamp stays OFF. */
#include <stdint.h>
#include "board_ctrl.h"
#include "board_l_proposal.h"
#include "clock.h"
#include "lamp_target.h"
#include "stm32g031_regs.h"

#define TICK_HZ 1000u

static volatile uint32_t g_ticks;
volatile enum clock_result g_clock_result;
static struct lamp_target g_target;
static struct lamp_app g_app;
volatile struct lamp_app_report g_last_report;

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

static void halt_off(void)
{
    for (;;)
        board_ctrl_force_off();
}

int main(void)
{
    static const struct ctrl_port port = {board_ctrl_force_off, board_ctrl_pwm_init_zero,
                                          board_ctrl_write_ccr};
    /* As-built Board L has RS1 = 200 mOhm, so the typical-transfer duty ceiling applies. */
    static const struct board_l_config cfg_storage = {{true, CTRL_TIMER_EDGE_UP_PWM1_ACTIVE_HIGH,
        CTRL_PERIOD_TICKS, true, CTRL_MIN_CCR, CTRL_FULL_CCR_RS200}};
    const struct lamp_config policy = {LAMP_RAMP_INCREMENT, LAMP_RECOVERY_LATCH};
    struct lamp_app_io io;

    board_ctrl_force_off();                       /* 1. CTRL defined low (GPIO)      */
    g_clock_result = clock_init_64mhz();          /* 2. 64 MHz or stay on HSI        */
    if (g_clock_result != CLOCK_PLL_64MHZ)        /*    20 kHz carrier needs 64 MHz  */
        halt_off();
    if (!lamp_target_bind(&g_target, &port, NULL))
        halt_off();
    io = lamp_target_io(&g_target);
    g_last_report = lamp_app_initialize(&g_app, &io, &cfg_storage); /* 3. TIM3 at 0 % */
    if (!systick_start(clock_hclk_hz(g_clock_result)))
        halt_off();

    uint32_t seen = g_ticks;
    for (;;) {
        __asm volatile("wfi");
        if (g_ticks != seen) {
            seen = g_ticks;
            g_last_report = lamp_app_tick(&g_app, &policy); /* 4. every tick re-applies */
        }
    }
}
