#ifndef BOARD_POLICY_H
#define BOARD_POLICY_H
/* Portable boot policy (host-tested): reset-cause latch and option-byte gate.
 * PROPOSAL (PROPOSAL-CTRL-RESET-OPTIONS.md section 2-3); no bench evidence. */
#include <stdbool.h>
#include <stdint.h>

#define RESET_RECORD_MAGIC UINT32_C(0x4C52A5C3)

/* Lives in .noinit RAM: survives a non-power reset, garbage after power-on. */
struct reset_record {
    uint32_t magic, count, check;
};

enum reset_kind { RESET_POWER, RESET_ABNORMAL, RESET_NEUTRAL };

enum boot_refusal {
    BOOT_REFUSE_NONE = 0,
    BOOT_REFUSE_RESET_LATCH = 1u << 0,
    BOOT_REFUSE_BOR_DISABLED = 1u << 1,
    BOOT_REFUSE_BOR_LEVEL = 1u << 2,
    BOOT_REFUSE_CLOCK = 1u << 3
};

struct boot_decision {
    bool allow_light;
    uint32_t refusals;          /* enum boot_refusal bits */
    enum reset_kind reset;
    uint32_t reset_count;       /* consecutive abnormal resets after this boot */
    uint32_t option_notes;      /* diagnostic only: enum option_note bits */
};

enum option_note {
    OPTION_NOTE_BOOT_PIN = 1u << 0,      /* nBOOT_SEL = 0: BOOT0 taken from the pin */
    OPTION_NOTE_BOOT_SYSTEM = 1u << 1,   /* nBOOT0 = 0 with nBOOT_SEL = 1 */
    OPTION_NOTE_IWDG_SOFTWARE = 1u << 2, /* IWDG_SW = 1 (development setting) */
    OPTION_NOTE_NRST_NOT_IO = 1u << 3,   /* NRST_MODE != 3 */
    OPTION_NOTE_RDP_NOT_LEVEL0 = 1u << 4
};

/* Classifies RCC_CSR reset flags. Power/BOR wins; then IWDG/WWDG/software/
 * low-power resets count; pin-only or option-load resets are neutral. */
enum reset_kind reset_classify(uint32_t csr);
/* Updates the record for this boot and returns the consecutive abnormal count.
 * An invalid record after a non-power reset is rebuilt conservatively. */
uint32_t reset_record_update(struct reset_record *, uint32_t csr);
/* Option-byte gate: required BOR settings -> refusal bits; others -> notes. */
uint32_t option_refusals(uint32_t optr, uint32_t *notes);
/* Full decision. clock_ok false or any refusal keeps the lamp OFF. */
struct boot_decision boot_decide(struct reset_record *, uint32_t csr, uint32_t optr, bool clock_ok);
#endif
