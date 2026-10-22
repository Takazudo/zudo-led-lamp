"""Adversarial analytical checks. No transistor simulation or measured behavior.
Primary conditions retained in BOM-CLOSURE.md and POWER-PATH.md.
"""
import itertools, json, pathlib, unittest, sys
HERE=pathlib.Path(__file__).parent
sys.path.insert(0,str(HERE.parents[1]/'scripts/schgen'))
import board_l_spec as led
import spec

def corners(top,bottom,limits,err,extra_sink=0):
    # Independent KCL formulation: I_bottom=Vpin/Rbottom; I_top=I_bottom+I_pin.
    result=[]
    for v,rt,rb,leak in itertools.product(limits,(1-err,1+err),(1-err,1+err),(-1e-7,1e-7)):
        result.append(v+(v/(bottom*rb)+leak+extra_sink)*top*rt)
    return [min(result),max(result)]

def latches(uv_ok,ov_fault,raw,gate,uv_rise,uv_fall,ov_rise,ov_fall):
    # Ideal QINH clamps EN/UVLO below reset while inhibited. OV is RAW-driven.
    # This is NOT a proof that the real clamp settles before a startup pulse.
    if not gate: uv_ok=False
    elif raw>=uv_rise: uv_ok=True
    elif raw<uv_fall: uv_ok=False
    if raw>=ov_rise: ov_fault=True
    elif raw<ov_fall: ov_fault=False
    return uv_ok,ov_fault, bool(gate and uv_ok and not ov_fault)

def report():
    profiles={}
    for name,err in [('initial_plus_100K',.0035),('plus_0_5pct_assembly_sensitivity',.0085)]:
        profiles[name]={'resistor_fraction':err,
            'uv_rise':corners(97600,10000,(1.183,1.223),err),
            'uv_rise_with_assumed_1ua_sink':corners(97600,10000,(1.183,1.223),err,1e-6),
            'uv_fall':corners(97600,10000,(1.076,1.116),err),
            'ov_rise':corners(133000,10000,(1.183,1.223),err),
            'ov_fall':corners(133000,10000,(1.076,1.116),err)}
    # Nominal latch counterexample, not device guarantee.
    state=(False,False,False);trace=[]
    for raw,gate in [(5,False),(15,True),(12.6,True),(12.6,False)]:
        state=latches(*state[:2],raw,gate,1.2*10.76,1.09*10.76,1.2*14.3,1.09*14.3)
        trace.append({'raw':raw,'gate_sinks':gate,'uv_ok':state[0],'ov_fault':state[1],'enabled':state[2]})
    return {'classification':'analytic counterexamples; no timing or hardware validation',
        'profiles':profiles,'nominal_stale_gate_fallback_trace':trace,
        'assembly_sensitivity_warning':'0.5% added as sensitivity, not complete lifecycle guarantee; YAGEO test also has additive ohms and aging not combined here',
        'assumed_qinh_sink_budget_a':1e-6,
        'startup':'QINH initially nonconducting leaves EN divider able to rise; no propagation/capacitance bounds prove no pulse',
        'reserved_pins':'Board P NC; Board L 10k pullups to V3P3 still drive cable pins; not a contract signal',
        'contract_current':'hypothetical forced-GATE lower-current state is not detected by voltage/ILM; HUSB reachability is NOT established and retained selection checks current>=request',
        'timing':'all device/event ordering and residual-energy pass limits unresolved'}

class Adversarial(unittest.TestCase):
    def test_independent_kcl_matches_current_screen(self):
        import analyze_power_path as a
        c=a.calculate();p=report()['profiles']['initial_plus_100K']
        for k in ('uv_rise','uv_fall','ov_rise','ov_fall'):
            for x,y in zip(p[k],c[k+'_v']):self.assertAlmostEqual(x,y,places=11)
    def test_assembly_sensitivity_breaks_cold_12_6_rejection(self):
        p=report()['profiles']['plus_0_5pct_assembly_sensitivity']
        self.assertLess(p['uv_rise'][0],12.6)
        self.assertGreater(p['uv_rise_with_assumed_1ua_sink'][1],13.4)
    def test_nominal_hysteresis_stale_gate_counterexample(self):
        t=report()['nominal_stale_gate_fallback_trace']
        self.assertEqual([r['enabled'] for r in t],[False,True,True,False])
    def test_ov_recovery_depends_on_prior_state(self):
        p=report()['profiles']['initial_plus_100K']
        # One possible corner: same15.75V allowed cold, inhibited after20V OV.
        args=(p['uv_rise'][1],p['uv_fall'][1],p['ov_rise'][0],p['ov_fall'][0])
        self.assertTrue(latches(False,False,15.75,True,*args)[2])
        state=latches(False,False,20,True,*args)
        self.assertFalse(latches(*state[:2],15.75,True,*args)[2])
    def test_inhibit_resets_uv_hysteresis_before_reenable(self):
        args=(1.2*10.76,1.09*10.76,1.2*14.3,1.09*14.3)
        state=latches(False,False,15,True,*args)
        self.assertTrue(state[2])
        state=latches(*state[:2],12.6,False,*args)
        self.assertFalse(state[0])
        self.assertFalse(latches(*state[:2],12.6,True,*args)[2])
    def test_reserved_pin_pullups_are_not_isolated_load_signals(self):
        power=next(nodes for nodes in led.NETS.values() if 'R24.1' in nodes)
        self.assertIn('R25.1',power);self.assertIn('J3.4',power)
        self.assertEqual(set(led.NETS['PDOK']),{'J2.4','R24.2','U3.12'})
        self.assertEqual(set(led.NETS['ATT']),{'J2.3','R25.2','U3.14'})
        for pin in (3,4):self.assertIn(f'JOUT1.{pin}',spec.NO_CONNECT)
        self.assertIn('J4.2',led.NETS['UART_RX']);self.assertIn('J4.3',led.NETS['GND'])
    def test_external_window_cannot_discriminate_forced_gate_states(self):
        import analyze_power_path as a
        self.assertTrue(a.conditional_permission(15,True))
        # Injected state only: NOT evidence HUSB admits a 1.5A PDO with a 3A request.
        # Retained HUSB selection requires source current >= effective request.
        self.assertGreater(a.calculate()['overcurrent_screen_a'][0],1.5)

if __name__=='__main__':
    (HERE/'adversarial-results.json').write_text(json.dumps(report(),indent=2)+'\n',encoding='utf-8')
    unittest.main()

