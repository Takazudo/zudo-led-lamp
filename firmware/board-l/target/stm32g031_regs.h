#ifndef STM32G031_REGS_H
#define STM32G031_REGS_H
/* Minimal STM32G031 register map used by the target skeleton only.
 * Every value is taken from ST's official CMSIS device header
 * (github.com/STMicroelectronics/cmsis_device_g0 @7c77b7cbcee497dfbb5cc08f9562a80515e78013,
 * Include/stm32g031xx.h, SHA256 336a1cdbbb54593c0d78c4c9440914deac58a523021883b7c96a76e7613f0a90),
 * the ST LL driver (stm32g0xx_hal_driver @289ef6c8ff0922878e99d253f29be76851f8f28e), or the
 * ARM CMSIS core header (CMSIS_5 @55b19837f5703e418ca37894d5745b1dc05e4c91, core_cm0plus.h).
 * `make verify-regs` checks each value against those headers with _Static_assert
 * (verify/verify_regs.c). RM0444 itself is not retained here. */
#include <stdint.h>

#define REG32(addr) (*(volatile uint32_t *)(uintptr_t)(addr))

#define RCC_BASE_ADDR    UINT32_C(0x40021000)
#define FLASH_BASE_ADDR  UINT32_C(0x40022000)
#define PWR_BASE_ADDR    UINT32_C(0x40007000)
#define GPIOA_BASE_ADDR  UINT32_C(0x50000000)
#define TIM3_BASE_ADDR   UINT32_C(0x40000400)
#define SYSTICK_BASE_ADDR UINT32_C(0xE000E010)

#define RCC_CR       REG32(RCC_BASE_ADDR + 0x00u)
#define RCC_CFGR     REG32(RCC_BASE_ADDR + 0x08u)
#define RCC_PLLCFGR  REG32(RCC_BASE_ADDR + 0x0Cu)
#define RCC_IOPENR   REG32(RCC_BASE_ADDR + 0x34u)
#define RCC_APBENR1  REG32(RCC_BASE_ADDR + 0x3Cu)
#define FLASH_ACR    REG32(FLASH_BASE_ADDR + 0x00u)
#define PWR_CR1      REG32(PWR_BASE_ADDR + 0x00u)
#define PWR_SR2      REG32(PWR_BASE_ADDR + 0x14u)
#define GPIOA_MODER  REG32(GPIOA_BASE_ADDR + 0x00u)
#define GPIOA_OTYPER REG32(GPIOA_BASE_ADDR + 0x04u)
#define GPIOA_OSPEEDR REG32(GPIOA_BASE_ADDR + 0x08u)
#define GPIOA_PUPDR  REG32(GPIOA_BASE_ADDR + 0x0Cu)
#define GPIOA_ODR    REG32(GPIOA_BASE_ADDR + 0x14u)
#define GPIOA_BSRR   REG32(GPIOA_BASE_ADDR + 0x18u)
#define GPIOA_AFRL   REG32(GPIOA_BASE_ADDR + 0x20u)
#define TIM3_CR1     REG32(TIM3_BASE_ADDR + 0x00u)
#define TIM3_EGR     REG32(TIM3_BASE_ADDR + 0x14u)
#define TIM3_CCMR1   REG32(TIM3_BASE_ADDR + 0x18u)
#define TIM3_CCER    REG32(TIM3_BASE_ADDR + 0x20u)
#define TIM3_PSC     REG32(TIM3_BASE_ADDR + 0x28u)
#define TIM3_ARR     REG32(TIM3_BASE_ADDR + 0x2Cu)
#define TIM3_CCR1    REG32(TIM3_BASE_ADDR + 0x34u)
#define SYST_CSR     REG32(SYSTICK_BASE_ADDR + 0x00u)
#define SYST_RVR     REG32(SYSTICK_BASE_ADDR + 0x04u)
#define SYST_CVR     REG32(SYSTICK_BASE_ADDR + 0x08u)

#define RCC_CR_HSION_BIT        (UINT32_C(1) << 8)
#define RCC_CR_HSIRDY_BIT       (UINT32_C(1) << 10)
#define RCC_CR_PLLON_BIT        (UINT32_C(1) << 24)
#define RCC_CR_PLLRDY_BIT       (UINT32_C(1) << 25)
#define RCC_CR_HSIDIV_MSK   UINT32_C(0x3800)
#define RCC_CR_HSIDIV_POS   11u
#define RCC_CFGR_HPRE_MSK   UINT32_C(0xF00)
#define RCC_CFGR_SW_MSK     UINT32_C(0x7)
#define RCC_CFGR_SW_PLL     UINT32_C(0x2)
#define RCC_CFGR_SWS_MSK    UINT32_C(0x38)
#define RCC_CFGR_SWS_PLL    UINT32_C(0x10)
#define RCC_PLLCFGR_SRC_MSK UINT32_C(0x3)
#define RCC_PLLCFGR_SRC_HSI UINT32_C(0x2)
#define RCC_PLLCFGR_M_MSK   UINT32_C(0x70)
#define RCC_PLLCFGR_M_POS   4u
#define RCC_PLLCFGR_N_MSK   UINT32_C(0x7F00)
#define RCC_PLLCFGR_N_POS   8u
#define RCC_PLLCFGR_REN     (UINT32_C(1) << 28)
#define RCC_PLLCFGR_R_MSK   UINT32_C(0xE0000000)
#define RCC_PLLCFGR_R_POS   29u
#define RCC_IOPENR_GPIOAEN_BIT  (UINT32_C(1) << 0)
#define RCC_APBENR1_TIM3EN_BIT  (UINT32_C(1) << 1)
#define RCC_APBENR1_PWREN_BIT   (UINT32_C(1) << 28)
#define FLASH_ACR_LAT_MSK   UINT32_C(0x7)
#define PWR_CR1_VOS_MSK     UINT32_C(0x600)
#define PWR_CR1_VOS_RANGE1  UINT32_C(0x200)
#define PWR_SR2_VOSF_BIT        (UINT32_C(1) << 10)
#define TIM_CR1_CEN_BIT         (UINT32_C(1) << 0)
#define TIM_CR1_ARPE_BIT        (UINT32_C(1) << 7)
#define TIM_EGR_UG_BIT          (UINT32_C(1) << 0)
#define TIM_CCMR1_CC1S_MSK  UINT32_C(0x3)
#define TIM_CCMR1_OC1PE_BIT     (UINT32_C(1) << 3)
#define TIM_CCMR1_OC1M_MSK  UINT32_C(0x10070)
#define TIM_CCMR1_OC1M_PWM1 UINT32_C(0x60)
#define TIM_CCER_CC1E_BIT       (UINT32_C(1) << 0)
#define TIM_CCER_CC1P_BIT       (UINT32_C(1) << 1)
/* Per-pin 2-bit / 4-bit field values (pin 0 encodings, shift by 2*pin or 4*pin). */
#define GPIO_MODE_OUTPUT    UINT32_C(0x1)
#define GPIO_MODE_ALTERNATE UINT32_C(0x2)
#define GPIO_MODE_ANALOG    UINT32_C(0x3)
#define GPIO_PULL_DOWN      UINT32_C(0x2)
#define GPIO_OTYPE_PUSHPULL UINT32_C(0x0)
#define GPIO_SPEED_LOW      UINT32_C(0x0)
#define GPIO_AF1            UINT32_C(0x1)
#define FLASH_LATENCY_2WS   UINT32_C(0x2)
#define SYST_CSR_ENABLE     (UINT32_C(1) << 0)
#define SYST_CSR_TICKINT    (UINT32_C(1) << 1)
#define SYST_CSR_CLKSOURCE  (UINT32_C(1) << 2)
#define SYST_RVR_MAX        UINT32_C(0xFFFFFF)

#endif
