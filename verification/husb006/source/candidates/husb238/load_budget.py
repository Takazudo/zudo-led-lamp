"""Conditional engineering budget, never a guaranteed board rating."""
import json,pathlib
import analyze_power_path as a

def calculate():
    c=a.calculate(); low,high=c['overcurrent_screen_a']
    rows=[]
    for raw in (13.5,14.25,15,15.75):
        for load in (.41,2.0,2.30):
            # Assumed extra series allowance, not a measured PCB/header resistance.
            bleed=raw/(2200*.98)
            switch_i=load+bleed
            drop=switch_i*(.045+.100)
            delivered=(raw-drop)*load
            heat=switch_i**2*.045+raw*.000610
            rows.append({'raw_v':raw,'load_a':load,'header_v_screen':raw-drop,
                'load_w_screen':delivered,'efuse_heat_w_screen':heat,
                'delta_t_at_74_5_c_per_w':heat*74.5,
                'theta_max_for_tj125_ta85_c_per_w':40/heat,
                'current_margin_to_low_trip_a':low-switch_i,
                'rail_w_at_assumed_conversion_80pct':delivered*.8*26.5/35.742417376172,
                'rail_w_at_assumed_conversion_85pct':delivered*.85*26.5/35.742417376172})
    return {'classification':'CONDITIONAL screening, not full-load or thermal qualification',
        'assumptions':{'raw_floor_v':13.5,'source_static_min_v':14.25,
        'cable_connector_drop_allowance_v':.75,'extra_trace_header_resistance_ohm':.100,
        'efuse_ron_max_screen_ohm':.045,'efuse_iq_max_screen_a':.000610,
        'theta_ja_example_c_per_w':74.5,'ambient_example_c':85,
        'missing':['actual PCB thermal impedance','HUSB maximum input current','converter efficiency minima',
            'startup/inrush trajectories','connector contact sharing/resistance','actual source and cable qualification']},
        'current_low_high_a':[low,high],
        'upstream_budget_to_3a_after_high_trip_a':3-high,
        'reference_rail_output_w':26.5,
        'reference_preregulator_output_screen_w':35.742417376172,
        'reference_converter_input_w_at_eta80':35.742417376172/.8,
        'reference_converter_input_w_at_eta85':35.742417376172/.85,
        'rows':rows}

if __name__=='__main__':
    pathlib.Path(__file__).with_name('load-budget.json').write_text(
        json.dumps(calculate(),indent=2)+'\n',encoding='utf-8')
