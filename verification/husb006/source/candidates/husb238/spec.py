"""HUSB006 shared-input candidate with unqualified protected power path.
Not a production BOM, complete circuit, or manufacturing release.
"""
PROJECT_NAME = 'board-p-husb006-candidate'
OUT = 'candidates/husb238/board-p-husb006-candidate.kicad_sch'
PAPER = 'A3'
CONTROLLER = {'mpn': 'HUSB238_006DD', 'jlc': 'C55013903',
              'package': 'DFN-10L(3x3) + exposed GND pad',
              'footprint': None, 'assembly': 'Economic and Standard (catalog evidence)'}
# Exact pin names from retained Hynetek Rev2.5 p4, not package geometry.
PIN_NAMES = {1:'VIN',2:'D+',3:'D-',4:'CC1',5:'CC2',6:'SDA',
             7:'SCL',8:'VSET',9:'ISET',10:'GATE',11:'GND_EP'}
# 15V is the common existing-load starting point, not an immutable requirement.
# 3A is a provisional request for a common assembly, not guaranteed usable output.
REQUEST = {'voltage_v':15, 'current_a':3, 'vset_ohm':14000,
           'iset_ohm':22600, 'status':'provisional; fuse/decoder corners unclosed'}
COMPONENTS = {
    'U1': ('HUSB238_006DD', 'HUSB238_006DD - FOOTPRINT BLOCKED', 'C55013903', '', False, (101.6,76.2)),
    'C1': ('CL10A105KB8NNNC', '1uF/50V - EFFECTIVE C OPEN', 'C15849', 'zudo-led-lamp:C0603', False, (38.1,139.7)),
    'RVSET': ('R_CANDIDATE', '14k 1% - MPN OPEN', '', '', False, (101.6,139.7)),
    'RISET': ('R_CANDIDATE', '22.6k 1% - MPN OPEN', '', '', False, (165.1,139.7)),
    'JOUT1': ('PZ254V-11-06P', 'SHARED OUTPUT - POWER PATH NOT IMPLEMENTED', 'C492405', 'zudo-led-lamp:HDR-TH_6P-P2.54-V-M', False, (279.4,76.2)),
}
NETS = {
    'RAW_USB_VBUS': ['U1.1','C1.1'],
    'USB_D_PLUS_PORT_UNMAPPED': ['U1.2'],
    'USB_D_MINUS_PORT_UNMAPPED': ['U1.3'],
    'USB_CC1_PORT_UNMAPPED': ['U1.4'],
    'USB_CC2_PORT_UNMAPPED': ['U1.5'],
    'VSET': ['U1.8','RVSET.1'],
    'ISET': ['U1.9','RISET.1'],
    'GATE_TO_UNIMPLEMENTED_POWER_PATH': ['U1.10'],
    'SWITCHED_OUTPUT_UNIMPLEMENTED': ['JOUT1.1','JOUT1.2'],
    'GND': ['U1.11','C1.2','RVSET.2','RISET.2','JOUT1.5','JOUT1.6'],
}
NO_CONNECT = ['U1.6','U1.7','JOUT1.3','JOUT1.4']
INTERFACE = {1:'SWITCHED_POWER',2:'SWITCHED_POWER',3:'RESERVED_UNDRIVEN',
             4:'RESERVED_UNDRIVEN',5:'GND',6:'GND'}
BLOCKERS = [
    'U1 manufacturer package dimensions, pin1 orientation and validated footprint/model',
    'USB connector exact physical pin map: existing 6-contact receptacle lacks D+/D-; no float/legacy-mode assumption',
    'RAW total/effective capacitance including C1 bias/tolerance and fixture',
    'VSET/ISET exact candidates populated; full fuse/decoder tolerance validation pending',
    'Default-OFF, fallback rejection, inrush, discharge, backfeed and fault-rated power path',
    'Contract-loss maximum delay is not established by retained During Contract fuse table',
    'Board L input window and synth startup/load envelope separately qualified',
    'Native ERC/DRC, geometry, BOM/CPL and manufacturing outputs',
    'Assembly/lifecycle divider errors and QINH leakage budget: initial-only window does not qualify fallback rejection',
    'Fixed ILM does not enforce a lower-current contract; service-equipment backfeed remains unqualified',
]

def release_errors():
    return list(BLOCKERS)

import sys as _sys
import power_path
power_path.apply(_sys.modules[__name__])
