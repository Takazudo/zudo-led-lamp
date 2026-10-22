"""Bounded arithmetic only. No SPICE, semiconductor simulation or hardware test."""
import itertools,json,math,pathlib
from power_path import VALUES as R

def threshold(top,bottom,bounds):
    # 0.1% initial +25ppm/K*100K =0.35%; excludes aging/reflow shifts.
    return _corners(top,bottom,bounds)

def _corners(top,bottom,bounds):
    values=[v*(1+top*rt/(bottom*rb))+leak*top*rt
        for v,rt,rb,leak in itertools.product(bounds,(.9965,1.0035),(.9965,1.0035),(-1e-7,1e-7))]
    return [min(values),max(values)]

def calculate():
    return {
      'status':'arithmetic screening only; source conditions and unmodeled leakage apply',
      'uv_rise_v':threshold(R['RUVH'],R['RUVL'],(1.183,1.223)),
      'uv_fall_v':threshold(R['RUVH'],R['RUVL'],(1.076,1.116)),
      'ov_rise_v':threshold(R['ROVH'],R['ROVL'],(1.183,1.223)),
      'ov_fall_v':threshold(R['ROVH'],R['ROVL'],(1.076,1.116)),
      'overcurrent_screen_a':[3334/(R['RILM']*1.02)*.9,3334/(R['RILM']*.98)*1.1],
      'bleed_power_21v_w':21**2/(R['RBLEED']*.98),
      'bleed_example_1000uf_16v_to_1v_s':R['RBLEED']*1.02*.001*math.log(16),
      'energy_example_1000uf_16v_j':.5*.001*16**2,
      'slew_nominal_v_per_ms':2000/22000,
      'inrush_example_1000uf_nominal_a':.001*(2000/22000)*1000,
      'gate_sink_screen_21v_a':21/(100000*.99),
      'gate_low_screen_v':21/(100000*.99)*300,
    }

def conditional_permission(raw,gate_sinking):
    # Idealized steady state at nominal thresholds, initially off. Not contract
    # validation: caller supplies GATE state, which can also be a stuck-low fault.
    return bool(gate_sinking and raw >= 1.2*(1+R['RUVH']/R['RUVL'])
                and raw < 1.2*(1+R['ROVH']/R['ROVL']))

if __name__=='__main__':
    pathlib.Path(__file__).with_name('power-path-calculations.json').write_text(
        json.dumps(calculate(),indent=2)+'\n',encoding='utf-8')
