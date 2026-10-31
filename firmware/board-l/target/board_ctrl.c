#include "board_ctrl.h"
#include "stm32g031_regs.h"

#define CTRL_PIN 6u
/* PA6 TIM3_CH1 is GPIO_AF1_TIM3 in ST STM32_open_pin_data
 * mcu/IP/GPIO-STM32G03x_gpio_v1_0_Modes.xml. */
#define CTRL_AF GPIO_AF1
/* PLACEHOLDER, not a chosen product value: the CTRL PWM period is an open
 * parameter (AL8860 CTRL input behind an RC filter). 64 MHz / 1000 = 64 kHz. */
#define CTRL_PWM_ARR_PLACEHOLDER 999u

static void field2(volatile uint32_t *reg, unsigned pin, uint32_t value)
{
    *reg = (*reg & ~(UINT32_C(3) << (2u * pin))) | (value << (2u * pin));
}

/* Safe from any state, including before .data/.bss init and from fault
 * handlers: uses no RAM state. Leaves PA6 as a push-pull GPIO output driving low. */
void board_ctrl_force_off(void)
{
    RCC_IOPENR |= RCC_IOPENR_GPIOAEN_BIT;
    (void)RCC_IOPENR;
    GPIOA_BSRR = UINT32_C(1) << (CTRL_PIN + 16u);
    GPIOA_OTYPER &= ~(UINT32_C(1) << CTRL_PIN);
    field2(&GPIOA_PUPDR, CTRL_PIN, GPIO_PULL_DOWN);
    field2(&GPIOA_OSPEEDR, CTRL_PIN, GPIO_SPEED_LOW);
    field2(&GPIOA_MODER, CTRL_PIN, GPIO_MODE_OUTPUT);
    if (RCC_APBENR1 & RCC_APBENR1_TIM3EN_BIT) {
        TIM3_CCER &= ~TIM_CCER_CC1E_BIT;
        TIM3_CCR1 = 0u;
    }
}

/* Order: pin already GPIO-low -> TIM3 configured with CCR1 = 0 in PWM mode 1
 * (LL_TIM_OCMODE_PWM1: active only while CNT < CCR1, so never active at 0) ->
 * update event loads the preloaded registers -> output and counter enabled ->
 * only then is PA6 handed from GPIO-low to TIM3_CH1. */
void board_ctrl_pwm_init_zero(void)
{
    board_ctrl_force_off();
    RCC_APBENR1 |= RCC_APBENR1_TIM3EN_BIT;
    (void)RCC_APBENR1;
    TIM3_CR1 = 0u;
    TIM3_CCER = 0u;
    TIM3_PSC = 0u;
    TIM3_ARR = CTRL_PWM_ARR_PLACEHOLDER;
    TIM3_CCR1 = 0u;
    TIM3_CCMR1 = (TIM3_CCMR1 & ~(TIM_CCMR1_CC1S_MSK | TIM_CCMR1_OC1M_MSK))
                 | TIM_CCMR1_OC1M_PWM1 | TIM_CCMR1_OC1PE_BIT;
    TIM3_CR1 = TIM_CR1_ARPE_BIT;
    TIM3_EGR = TIM_EGR_UG_BIT;
    TIM3_CCER = TIM_CCER_CC1E_BIT;
    TIM3_CR1 = TIM_CR1_ARPE_BIT | TIM_CR1_CEN_BIT;
    GPIOA_AFRL = (GPIOA_AFRL & ~(UINT32_C(0xF) << (4u * CTRL_PIN))) | (CTRL_AF << (4u * CTRL_PIN));
    field2(&GPIOA_MODER, CTRL_PIN, GPIO_MODE_ALTERNATE);
}

/* The V72 contract requires the output to be re-applied on every control tick.
 * The skeleton has no light command source, so the only value it ever applies is 0. */
void board_ctrl_apply_zero(void)
{
    TIM3_CCR1 = 0u;
}
