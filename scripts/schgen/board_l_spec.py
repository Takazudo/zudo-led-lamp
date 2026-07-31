"""Board L (driver, control, LED array) spec — from doc/src/content/docs/architecture/board-l.mdx.

LED polarity per the library symbol drawing: pin 1 = cathode (K), pin 2 = anode (A).
SS26: pin 1 = A, pin 2 = K. SMAJ20A: pin 1 = C, pin 2 = A. AL8860 EP = pin 9.
EC11 symbol pins: A/B/C terminals, D/E push-button terminals (unused), 6/7 mounting lugs
(the doc's MP1/MP2).
"""

PROJECT_NAME = 'board-l'
OUT = 'boards/board-l/board-l.kicad_sch'
PAPER = 'A2'  # 68 parts + title block did not fit A3 without collisions

_C100N = ('CC0603KRX7R9BB104', '100nF/50V', 'C14663', 'zudo-led-lamp:C0603')
_C10U = ('CL31A106KBHNNNE', '10uF/50V', 'C13585', 'zudo-led-lamp:C1206')
_C22U = ('CL21A226MAQNNNE', '22uF/25V', 'C45783', 'zudo-led-lamp:C0805')
_R10K = ('0805W8F1002T5E', '10k', 'C17414', 'zudo-led-lamp:R0805')

COMPONENTS = {
    # power input and LED driver (top row)
    'J2':   ('B6B-XH-A', 'B6B-XH-A(LF)(SN)', 'C144397', 'zudo-led-lamp:CONN-TH_6P-P2.50_B6B-XH-A-LF-SN', False, (38.1, 50.8)),
    'F1':   ('BSMD1206-075-30V', 'PPTC 750mA/30V', 'C976305', 'zudo-led-lamp:F1206', False, (88.9, 50.8)),
    'D10':  ('SMAJ20A_C571370', 'SMAJ20A', 'C571370', 'zudo-led-lamp:SMA_L4.2-W2.6-LS5.3-RD', False, (127, 50.8)),
    'U2':   ('AL8860MP-13', 'AL8860MP-13', 'C500782', 'zudo-led-lamp:MSOP-8_L3.0-W3.0-P0.65-LS4.9-BL-EP1.8', False, (177.8, 50.8)),
    'RS1':  ('RLP25FEER200', '200mR 1% 2W', 'C459674', 'zudo-led-lamp:R2512', False, (228.6, 50.8)),
    'L1':   ('FXL0630-330-M', '33uH', 'C177245', 'zudo-led-lamp:IND-SMD_L7.0-W6.6_FXL0630', False, (266.7, 50.8)),
    'D11':  ('SS26_C7420363', 'SS26', 'C7420363', 'zudo-led-lamp:SMA_L4.3-W2.6-LS5.0-FD', False, (304.8, 50.8)),
    'U4':   ('AP63203WU-7', 'AP63203WU-7', 'C780769', 'zudo-led-lamp:TSOT-26_L2.9-W1.6-P0.95-LS2.8-BL', False, (342.9, 50.8)),
    'L2':   ('FNR4030S4R7MT', '4.7uH', 'C167874', 'zudo-led-lamp:IND-SMD_L4.0-W4.0_FNR40XXS', False, (381, 50.8)),
    # MCU, knob, interfaces (second row)
    'U3':   ('STM32G031F8P6', 'STM32G031F8P6', 'C529334', 'zudo-led-lamp:TSSOP-20_L6.5-W4.4-P0.65-LS6.4-BL', False, (76.2, 101.6)),
    'SW1':  ('EC11L1525G01', 'EC11 15-detent', 'C2991196', 'zudo-led-lamp:SW-TH_ALPS_EC11L1525G01', False, (165.1, 101.6)),
    'J3':   ('PZ254V-11-05P', 'SWD 1x5 (hand-fit)', 'C492404', 'zudo-led-lamp:HDR-TH_5P-P2.54-V-M', True, (203.2, 101.6)),
    'J4':   ('Conn_1x03', 'UART pads', '', 'zudo-led-lamp:PogoPad_1x03_P2.54mm', True, (241.3, 101.6)),
    'RT1':  ('NCP18XH103F03RB', 'NTC 10k B3380', 'C13564', 'zudo-led-lamp:R0603', False, (279.4, 101.6)),
    'C20':  (*_C100N, False, (317.5, 101.6)),
    'C24':  (*_C100N, False, (355.6, 101.6)),
    # capacitors (third row)
    'C10':  (*_C10U, False, (38.1, 152.4)),
    'C11':  (*_C10U, False, (73.66, 152.4)),
    'C12':  (*_C10U, False, (109.22, 152.4)),
    'C13':  (*_C100N, False, (144.78, 152.4)),
    'C14':  (*_C10U, False, (180.34, 152.4)),
    'C15':  (*_C100N, False, (215.9, 152.4)),
    'C16':  (*_C22U, False, (251.46, 152.4)),
    'C17':  (*_C22U, False, (287.02, 152.4)),
    'C18':  (*_C100N, False, (322.58, 152.4)),
    'C19':  ('CL10A105KB8NNNC', '1uF/50V', 'C15849', 'zudo-led-lamp:C0603', False, (358.14, 152.4)),
    # control-path passives (fourth row)
    'R20':  (*_R10K, False, (38.1, 177.8)),
    'R21':  ('0603WAF3302T5E', '33k', 'C4216', 'zudo-led-lamp:R0603', False, (73.66, 177.8)),
    'C21':  (*_C100N, False, (109.22, 177.8)),
    'C22':  (*_C100N, False, (144.78, 177.8)),
    'C23':  (*_C100N, False, (180.34, 177.8)),
    'R22':  (*_R10K, False, (215.9, 177.8)),
    'R23':  (*_R10K, False, (251.46, 177.8)),
    'R24':  (*_R10K, False, (287.02, 177.8)),
    'R25':  (*_R10K, False, (322.58, 177.8)),
    'R26':  (*_R10K, False, (358.14, 177.8)),
}

# ballast row + LED array: string n (1..8) = R(29+n) + LED(3n-2), LED(3n-1), LED(3n)
_BALLAST = ('FRC1206F33R0TS', '33R 1%', 'C2907384', 'zudo-led-lamp:R1206')
_LED = ('HL-AM-2835H421W-S1-08-HR3', '2835 3000K CRI80', 'C210315', 'zudo-led-lamp:LED-SMD_L3.3-W2.8-RD')
for _n in range(1, 9):
    _x = 38.1 + 35.56 * (_n - 1)
    COMPONENTS[f'R{29 + _n}'] = (*_BALLAST, False, (_x, 203.2))
    COMPONENTS[f'LED{3 * _n - 2}'] = (*_LED, False, (_x, 228.6))
    COMPONENTS[f'LED{3 * _n - 1}'] = (*_LED, False, (_x, 254))
    COMPONENTS[f'LED{3 * _n}'] = (*_LED, False, (_x, 279.4))

# EC11: keep the value text clear of the vertical A/C/B labels below the body
LABEL_OVERRIDES = {
    'SW1': {'Value': (165.1 + 17.78, 101.6 + 2.54)},
}

NETS = {
    'VBUS_L':    ['J2.1', 'J2.2', 'F1.1'],
    'V15':       ['F1.2', 'D10.1', 'C10.1', 'C11.1', 'U2.8', 'RS1.1', 'D11.2',
                  'C12.1', 'C13.1', 'U4.3', 'C14.1'],
    'SET':       ['U2.1', 'RS1.2', 'L1.1'],
    'LED_P':     ['L1.2'] + [f'R{29 + n}.1' for n in range(1, 9)],
    'LED_N':     ['U2.5', 'U2.6', 'D11.1'] + [f'LED{3 * n}.1' for n in range(1, 9)],
    'CTRL':      ['U2.4', 'R20.2', 'R21.1', 'C21.1'],
    'PWM_DIM':   ['U3.13', 'R20.1'],
    'SW_LOGIC':  ['U4.5', 'C15.1', 'L2.1'],
    'BST':       ['U4.6', 'C15.2'],
    'V3P3':      ['U4.1', 'L2.2', 'C16.1', 'C17.1', 'U3.4', 'C18.1', 'C19.1',
                  'R22.1', 'R23.1', 'R24.1', 'R25.1', 'R26.1', 'J3.4'],
    'ENC_A':     ['SW1.A', 'R22.2', 'C22.1', 'U3.7'],
    'ENC_B':     ['SW1.B', 'R23.2', 'C23.1', 'U3.8'],
    'PDOK':      ['J2.4', 'R24.2', 'U3.12'],
    'ATT':       ['J2.3', 'R25.2', 'U3.14'],
    'NTC_SENSE': ['RT1.1', 'R26.2', 'C24.1', 'U3.11'],
    'NRST':      ['U3.6', 'C20.1', 'J3.3'],
    'SWDIO':     ['U3.18', 'J3.1'],
    'SWCLK':     ['U3.19', 'J3.2'],
    'UART_TX':   ['U3.9', 'J4.1'],
    'UART_RX':   ['U3.10', 'J4.2'],
    'GND':       ['J2.5', 'J2.6', 'D10.2', 'C10.2', 'C11.2', 'C12.2', 'C13.2',
                  'U2.2', 'U2.3', 'U2.9', 'C14.2', 'U4.4', 'C16.2', 'C17.2',
                  'U3.5', 'C18.2', 'C19.2', 'C20.2', 'R21.2', 'C21.2', 'C22.2',
                  'C23.2', 'C24.2', 'RT1.2', 'SW1.C', 'SW1.6', 'SW1.7',
                  'J3.5', 'J4.3'],
}
# LED strings: ballast -> top anode; internal nodes; bottom cathodes join LED_N above
for _n in range(1, 9):
    _t, _m, _b = 3 * _n - 2, 3 * _n - 1, 3 * _n
    NETS[f'LED_S{_n}_A'] = [f'R{29 + _n}.2', f'LED{_t}.2']
    NETS[f'LED_S{_n}_M1'] = [f'LED{_t}.1', f'LED{_m}.2']
    NETS[f'LED_S{_n}_M2'] = [f'LED{_m}.1', f'LED{_b}.2']

NO_CONNECT = [
    'U2.7',                                  # AL8860 NC
    'U4.2',                                  # AP63203 EN — open for auto startup
    'U3.1', 'U3.2', 'U3.3', 'U3.15', 'U3.16', 'U3.17', 'U3.20',  # unused MCU pins
    'SW1.D', 'SW1.E',                        # EC11 push-button terminals, unused
]
