"""Unqualified electrical candidate; no placement/manufacturing acceptance.

TI TPS25947 Rev C pin table / typical application plus a discrete inhibit.
HUSB contract-output interpretation remains conditional, not a safety guarantee.
"""
EFUSE_PINS = {1:'EN_UVLO',2:'OVLO',3:'PG',4:'PGTH',5:'IN',6:'OUT',
              7:'DVDT',8:'GND',9:'ILM',10:'ITIMER'}
NPN_PINS = {1:'B',2:'E',3:'C'}
VALUES = {'RG':100000,'RB':100000,'RBE':1000000,'RUVH':97600,
          'RUVL':10000,'ROVH':133000,'ROVL':10000,'RILM':1270,
          'RSLEW':100,'RBLEED':2200}

def apply(spec):
    spec.PAPER = 'A2'
    spec.COMPONENTS['JOUT1'] = ('PZ254V-11-06P','SHARED OUTPUT - UNQUALIFIED',
        'C492405','zudo-led-lamp:HDR-TH_6P-P2.54-V-M',False,(482.6,76.2))
    spec.COMPONENTS['U2'] = ('TPS259474LRPWR','TPS259474L - FOOTPRINT OPEN',
        'C2864845','',False,(304.8,76.2))
    spec.COMPONENTS['QINH'] = ('MMBT3904LT1G','onsemi MMBT3904LT1G - JLC OPEN',
        '','',False,(203.2,76.2))
    for i,(ref,value) in enumerate(VALUES.items()):
        precision = '0.1%' if ref in ('RUVH','RUVL','ROVH','ROVL') else '1%'
        rating = ' >=0.5W' if ref == 'RBLEED' else ' >=0.1W'
        spec.COMPONENTS[ref] = ('R_CANDIDATE',f'{value}ohm {precision}{rating} - MPN OPEN',
            '','',False,(50.8+101.6*(i%5),215.9+76.2*(i//5)))
    spec.COMPONENTS['CSLEW'] = ('C_CANDIDATE','22nF 50V 5% C0G - MPN OPEN',
        '','',False,(381,139.7))
    spec.COMPONENTS['COUT'] = ('CL10A105KB8NNNC','1uF/50V - EFFECTIVE C OPEN',
        'C15849','zudo-led-lamp:C0603',False,(482.6,139.7))
    spec.NETS.pop('GATE_TO_UNIMPLEMENTED_POWER_PATH')
    spec.NETS.pop('SWITCHED_OUTPUT_UNIMPLEMENTED')
    spec.NETS['RAW_USB_VBUS'] += ['U2.5','RG.1','RUVH.1','ROVH.1']
    spec.NETS.update({
        'CONTRACT_GATE_N': ['U1.10','RG.2','RB.1'],
        'INHIBIT_BASE': ['RB.2','RBE.1','QINH.1'],
        'EN_UVLO': ['U2.1','QINH.3','RUVH.2','RUVL.1'],
        'OVLO': ['U2.2','ROVH.2','ROVL.1'],
        'ILM': ['U2.9','RILM.1'],
        'DVDT': ['U2.7','RSLEW.1'],
        'DVDT_CAP': ['RSLEW.2','CSLEW.1'],
        'SWITCHED_OUTPUT': ['U2.6','COUT.1','RBLEED.1','JOUT1.1','JOUT1.2'],
    })
    spec.NETS['GND'] += ['U2.4','U2.8','QINH.2','RBE.2','RUVL.2','ROVL.2',
        'RILM.2','CSLEW.2','COUT.2','RBLEED.2']
    spec.NO_CONNECT += ['U2.3','U2.10']
    spec.BLOCKERS[4] = ('Power path populated but UNQUALIFIED: GATE leakage/startup, '
        'contract-current eligibility, UV/OV hysteresis, transient/thermal/RCB and load envelope')
    spec.BLOCKERS += ['U2/QINH/1210 footprint review; C95204 current eligibility and CSLEW exact sourcing',
        'OVLO recommended pin range not met at initial 5V with divider; low-pin functional qualification open',
        '12V fallback after ON may remain enabled: GATE behavior and downstream brownout remain unqualified',
        'No downstream discharge deadline or event-to-isolation maximum is established']
    import sourcing
    sourcing.apply(spec)
