"""Evidence-backed partial ERC semantics; no electrical qualification implied.
Unresolved interface/analog pins remain passive explicitly, not guessed.
"""
PIN_TYPES={
 'HUSB238_006DD':{1:'power_in',10:'open_collector',11:'power_in'},
 'TPS259474LRPWR':{1:'input',2:'input',3:'open_collector',4:'input',5:'power_in',6:'power_out',8:'power_in'},
}
EVIDENCE={
 'HUSB238_006DD':'Retained Hynetek Rev2.5 p4 VIN/GND and GATE open-drain function; p5 sink/Ron. No new fetch.',
 'TPS259474LRPWR':'Retained TI SLVSFC9C RevC pin functions pp4-5: EN/UVLO, OVLO, PGTH inputs; PG open-drain; IN/OUT/GND power path.',
}
# KiCad open_collector also represents an open-drain output. Not a push-pull driver.
# BJT/resistor/capacitor pins intentionally passive: not digital input/output.
# HUSB data/CC/I2C/straps and U2 analog programming pins await typed-model review.
def pin_type(symbol,number):return PIN_TYPES.get(symbol,{}).get(number,'passive')
