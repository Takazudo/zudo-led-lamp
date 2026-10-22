"""Desk/fixture observation classifier, NOT firmware or implemented protection.

Contract state must come from protocol observation, never inferred from voltage,
GATE or reserved connector contacts. Uses existing cold UV/OV corner screen,
which excludes complete lifecycle/leakage/timing bounds and downstream limits.
"""
import math
from analyze_power_path import calculate


def classify(raw_v, contract_state):
    if contract_state not in ('startup', 'explicit', 'lost', 'unknown'):
        raise ValueError('explicit protocol observation state required')
    # This classification does not predict that the hardware has turned OFF.
    if contract_state in ('startup', 'lost'):
        return 'NOT_QUALIFIED_NO_CONTRACT'
    if contract_state == 'unknown':
        return 'INDETERMINATE_CONTRACT'
    if (isinstance(raw_v, bool) or not isinstance(raw_v, (int, float))
            or not math.isfinite(raw_v) or raw_v < 0):
        return 'INDETERMINATE_VOLTAGE'
    c = calculate()
    uv_min, uv_max = c['uv_rise_v']
    ov_min, ov_max = c['ov_rise_v']
    if raw_v < uv_min or raw_v >= ov_max:
        return 'OUTSIDE_COLD_WINDOW'
    if raw_v < uv_max or raw_v >= ov_min:
        return 'INDETERMINATE_THRESHOLD_CORNER'
    return 'WITHIN_COLD_SCREEN_ONLY'


def next_pdo(pdos, request_v, request_a):
    """p10 selection example for known eligible PDOs; no all-failed fallback model.

    Input tuples are (source_voltage_V, source_current_A). None means no matching
    input tuple, NOT proof of no contract or specification of 5V fallback current.
    """
    for voltage, current in sorted(pdos, reverse=True):
        if voltage <= request_v and current >= request_a:
            return voltage, request_a
    return None
