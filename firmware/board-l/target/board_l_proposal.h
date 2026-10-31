#ifndef BOARD_L_PROPOSAL_H
#define BOARD_L_PROPOSAL_H
/* PROPOSED values only (firmware/board-l/target/PROPOSAL-CTRL-RESET-OPTIONS.md).
 * None is a user-approved product parameter. */
#include "lamp_target.h"

/* 20 kHz CTRL carrier at 64 MHz: ARR+1 = 3200. Requires the 64 MHz clock; main.c
 * refuses to start the lamp on the HSI fallback. */
#define CTRL_PERIOD_TICKS 3200u
/* 16.2 % duty -> 0.41 V CTRL nominal -> ~5 % of I_NOM (typical transfer). */
#define CTRL_MIN_CCR 518u
/* Duty ceiling for the as-built RS1 = 200 mOhm: 83 % (issue #52 calculation,
 * TYPICAL CTRL transfer, not a guarantee). With RS1 = 250 mOhm fitted, use 3200. */
#define CTRL_FULL_CCR_RS200 2656u
#define CTRL_FULL_CCR_RS250 3200u
/* 1 kHz tick: zero to full in about 2.5 s (65536 / 26 = 2521 ticks), the ramp time of
 * the owner's 2026-10-06 bring-up firmware (../../board-l-bringup-mac-20261006). */
#define LAMP_RAMP_INCREMENT 26u

static inline struct board_l_config board_l_proposed_config(uint32_t full_ccr)
{
    return (struct board_l_config){{true, CTRL_TIMER_EDGE_UP_PWM1_ACTIVE_HIGH, CTRL_PERIOD_TICKS,
                                    true, CTRL_MIN_CCR, full_ccr}};
}
#endif
