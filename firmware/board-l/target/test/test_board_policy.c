/* Host tests: boot policy OFF paths (reset-cause latch, option bytes, clock). */
#include <stdio.h>
#include <string.h>
#include "board_l_proposal.h"
#include "board_policy.h"
#include "stm32g031_regs.h"

static int failures, checks;
#define CHECK(c) do { checks++; if (!(c)) { failures++; printf("FAIL %s:%d %s\n", __FILE__, __LINE__, #c); } } while (0)

#define POR (RCC_CSR_PWRRSTF_BIT | RCC_CSR_PINRSTF_BIT)
#define IWDG (RCC_CSR_IWDGRSTF_BIT | RCC_CSR_PINRSTF_BIT)
#define PIN RCC_CSR_PINRSTF_BIT
static const uint32_t GOOD_OPTR = 0xAAu | FLASH_OPTR_BOR_EN_BIT |
    (OPTION_BOR_LEVEL_FIELD << FLASH_OPTR_BORR_LEV_POS) | (OPTION_BOR_LEVEL_FIELD << FLASH_OPTR_BORF_LEV_POS) |
    FLASH_OPTR_IWDG_SW_BIT | FLASH_OPTR_WWDG_SW_BIT | FLASH_OPTR_nBOOT_SEL_BIT | FLASH_OPTR_nBOOT1_BIT |
    FLASH_OPTR_nBOOT0_BIT | (UINT32_C(3) << FLASH_OPTR_NRST_MODE_POS);

static void test_classify(void)
{
    CHECK(reset_classify(POR) == RESET_POWER);
    CHECK(reset_classify(POR | RCC_CSR_IWDGRSTF_BIT) == RESET_POWER);
    CHECK(reset_classify(IWDG) == RESET_ABNORMAL);
    CHECK(reset_classify(RCC_CSR_WWDGRSTF_BIT) == RESET_ABNORMAL);
    CHECK(reset_classify(RCC_CSR_SFTRSTF_BIT) == RESET_ABNORMAL);
    CHECK(reset_classify(RCC_CSR_LPWRRSTF_BIT) == RESET_ABNORMAL);
    CHECK(reset_classify(PIN) == RESET_NEUTRAL);
    CHECK(reset_classify(RCC_CSR_OBLRSTF_BIT) == RESET_NEUTRAL);
    CHECK(reset_classify(0u) == RESET_NEUTRAL);
}

static void test_latch(void)
{
    struct reset_record r;
    memset(&r, 0xA5, sizeof r);                  /* power-on garbage */
    struct boot_decision d = boot_decide(&r, POR, GOOD_OPTR, true);
    CHECK(d.allow_light && d.reset_count == 0 && d.refusals == 0);
    for (unsigned i = 1; i < RESET_LATCH_COUNT; i++) {
        d = boot_decide(&r, IWDG, GOOD_OPTR, true);
        CHECK(d.allow_light && d.reset_count == i);
    }
    d = boot_decide(&r, RCC_CSR_SFTRSTF_BIT, GOOD_OPTR, true);
    CHECK(!d.allow_light && (d.refusals & BOOT_REFUSE_RESET_LATCH) && d.reset_count == RESET_LATCH_COUNT);
    d = boot_decide(&r, PIN, GOOD_OPTR, true);   /* debugger/NRST reset: still latched */
    CHECK(!d.allow_light && (d.refusals & BOOT_REFUSE_RESET_LATCH));
    d = boot_decide(&r, IWDG, GOOD_OPTR, true);  /* saturates, stays latched */
    CHECK(!d.allow_light && d.reset_count == RESET_LATCH_COUNT);
    d = boot_decide(&r, POR, GOOD_OPTR, true);   /* only power cycle clears */
    CHECK(d.allow_light && d.reset_count == 0);
    /* Neutral resets do not count. */
    for (int i = 0; i < 10; i++)
        d = boot_decide(&r, PIN, GOOD_OPTR, true);
    CHECK(d.allow_light && d.reset_count == 0);
    /* Corrupt record after an abnormal reset: rebuilt as at least one abnormal reset. */
    r.check ^= 1u;
    d = boot_decide(&r, IWDG, GOOD_OPTR, true);
    CHECK(d.reset_count == 2 && d.allow_light);
    r.count = 99; r.check = ~r.count;             /* out-of-range count is invalid */
    d = boot_decide(&r, PIN, GOOD_OPTR, true);
    CHECK(d.reset_count == 0);
    /* No record at all: refuse. */
    d = boot_decide(NULL, POR, GOOD_OPTR, true);
    CHECK(!d.allow_light && (d.refusals & BOOT_REFUSE_RESET_LATCH));
    /* WWDG and low-power resets count too. */
    d = boot_decide(&r, POR, GOOD_OPTR, true);
    (void)boot_decide(&r, RCC_CSR_WWDGRSTF_BIT, GOOD_OPTR, true);
    (void)boot_decide(&r, RCC_CSR_LPWRRSTF_BIT, GOOD_OPTR, true);
    d = boot_decide(&r, IWDG, GOOD_OPTR, true);
    CHECK(!d.allow_light);
}

static void test_options_and_clock(void)
{
    struct reset_record r = {0};
    uint32_t notes = 0;
    CHECK(option_refusals(GOOD_OPTR, &notes) == 0 && notes == OPTION_NOTE_IWDG_SOFTWARE);
    struct boot_decision d = boot_decide(&r, POR, GOOD_OPTR & ~FLASH_OPTR_BOR_EN_BIT, true);
    CHECK(!d.allow_light && (d.refusals & BOOT_REFUSE_BOR_DISABLED));
    for (uint32_t lev = 0; lev < 3; lev++) {
        uint32_t o = (GOOD_OPTR & ~(FLASH_OPTR_BOR_LEV_FIELD << FLASH_OPTR_BORR_LEV_POS)) | (lev << FLASH_OPTR_BORR_LEV_POS);
        CHECK(!boot_decide(&r, POR, o, true).allow_light);
        o = (GOOD_OPTR & ~(FLASH_OPTR_BOR_LEV_FIELD << FLASH_OPTR_BORF_LEV_POS)) | (lev << FLASH_OPTR_BORF_LEV_POS);
        CHECK(boot_decide(&r, POR, o, true).refusals & BOOT_REFUSE_BOR_LEVEL);
    }
    CHECK(!boot_decide(&r, POR, 0u, true).allow_light);
    CHECK(!boot_decide(&r, POR, UINT32_MAX & ~FLASH_OPTR_BOR_EN_BIT, true).allow_light);
    d = boot_decide(&r, POR, GOOD_OPTR, false);
    CHECK(!d.allow_light && d.refusals == BOOT_REFUSE_CLOCK);
    /* Notes are diagnostic only. */
    CHECK(option_refusals(GOOD_OPTR & ~FLASH_OPTR_nBOOT_SEL_BIT, &notes) == 0 && (notes & OPTION_NOTE_BOOT_PIN));
    CHECK(option_refusals(GOOD_OPTR & ~FLASH_OPTR_nBOOT0_BIT, &notes) == 0 && (notes & OPTION_NOTE_BOOT_SYSTEM));
    CHECK(option_refusals((GOOD_OPTR & ~0xFFu) | 0xBBu, &notes) == 0 && (notes & OPTION_NOTE_RDP_NOT_LEVEL0));
    CHECK(option_refusals(GOOD_OPTR & ~(UINT32_C(1) << FLASH_OPTR_NRST_MODE_POS), &notes) == 0 &&
          (notes & OPTION_NOTE_NRST_NOT_IO));
}

int main(void)
{
    test_classify();
    test_latch();
    test_options_and_clock();
    printf("%s %d checks, %d failures (boot policy: reset latch, option bytes, clock)\n",
           failures ? "FAIL" : "PASS", checks, failures);
    return failures ? 1 : 0;
}
