import hashlib, importlib.util, pathlib, subprocess, sys, unittest
HERE=pathlib.Path(__file__).resolve().parent
ROOT=HERE.parents[1]
sys.path.insert(0,str(HERE));sys.path.insert(0,str(ROOT/'scripts/schgen'))
import spec, generate, sexp
import board_l_spec

def module(path):
    s=importlib.util.spec_from_file_location('pd_reference',path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m

class CandidateChecks(unittest.TestCase):
    def test_existing_load_connector_allocations(self):
        synth=module(HERE/'references/board_b_spec.py')
        for source,ref,power in [(board_l_spec,'J2','VBUS_L'),(synth,'J5','+15V INPUT')]:
            for pin in (1,2): self.assertIn(f'{ref}.{pin}',source.NETS[power])
            for pin in (5,6): self.assertIn(f'{ref}.{pin}',source.NETS['GND'])
            self.assertIn(f'{ref}.3',source.NETS['ATT']);self.assertIn(f'{ref}.4',source.NETS['PDOK'])
            self.assertEqual(source.COMPONENTS[ref][2],'C2832269')
        self.assertEqual(synth.NETS['ATT'],['J5.3','P1.1'])
        self.assertEqual(synth.NETS['PDOK'],['J5.4','P1.2'])

    def test_no_fake_legacy_status(self):
        self.assertIn('JOUT1.3',spec.NO_CONNECT);self.assertIn('JOUT1.4',spec.NO_CONNECT)
        self.assertFalse(any('ATT'==n or 'PDOK'==n for n in spec.NETS))
        self.assertNotIn('U1.10',spec.NETS['SWITCHED_OUTPUT'])

    def test_isolated_control_supply_and_no_bypass(self):
        raw=set(spec.NETS['RAW_USB_VBUS']);out=set(spec.NETS['SWITCHED_OUTPUT'])
        self.assertTrue(raw.isdisjoint(out))
        # Only U2 may have pins on both supply domains. This catches a resistor,
        # capacitor or control-transistor bypass added across the isolation.
        raw_refs={p.split('.')[0] for p in raw};out_refs={p.split('.')[0] for p in out}
        self.assertEqual(raw_refs & out_refs,{'U2'})
        self.assertEqual(set(spec.NETS['CONTRACT_GATE_N']),{'U1.10','RG.2','RB.1'})
        self.assertEqual(set(spec.NETS['INHIBIT_BASE']),{'RB.2','RBE.1','QINH.1'})
        self.assertEqual(spec.COMPONENTS['U1'][3],'')
        self.assertIsNone(spec.CONTROLLER['footprint'])
        self.assertEqual(spec.COMPONENTS['U2'][0],'TPS259474LRPWR')
        self.assertNotIn('Q1',spec.COMPONENTS)

    def test_pin_coverage_no_duplicate_or_floating_controls(self):
        nodes=[n for ns in spec.NETS.values() for n in ns]+spec.NO_CONNECT
        self.assertEqual(len(nodes),len(set(nodes)))
        for ref,count in [('U1',11),('U2',10),('QINH',3)]:
            self.assertEqual({n for n in nodes if n.startswith(ref+'.')},
                {f'{ref}.{p}' for p in range(1,count+1)})
        self.assertIn('U2.10',spec.NO_CONNECT)
        self.assertIn('U2.4',spec.NETS['GND'])

    def test_population_tradeoffs_are_exposed(self):
        import analyze_power_path as a
        c=a.calculate()
        self.assertLess(c['uv_fall_v'][1],12.6) # already-on 12.6V may persist
        self.assertLess(c['uv_rise_v'][1]+97600*1.0035*1e-6,13.5)
        self.assertGreater(c['uv_rise_v'][0],12.6) # cold12.6 rejected only in this screen
        self.assertLess(c['ov_rise_v'][1],20)
        self.assertGreater(c['ov_rise_v'][0],16.25) # transient upper example
        self.assertGreater(c['ov_fall_v'][0],15)
        self.assertLess(c['ov_fall_v'][0],15.75) # recovery at high15V still ambiguous
        self.assertLess(c['overcurrent_screen_a'][1],3)
        self.assertLess(c['bleed_power_21v_w'],0.25)
        self.assertFalse(a.conditional_permission(15,gate_sinking=False))
        self.assertTrue(a.conditional_permission(15,gate_sinking=True))
        # A stuck-low GATE is indistinguishable from contract indication here.
        self.assertFalse(a.conditional_permission(5,gate_sinking=True))
        self.assertFalse(a.conditional_permission(20,gate_sinking=True))

    def test_load_budget_distinguishes_rails_from_input(self):
        import load_budget
        b=load_budget.calculate()
        self.assertGreater(b['reference_converter_input_w_at_eta85'],42)
        self.assertEqual(b['reference_rail_output_w'],26.5)
        for row in b['rows']:
            self.assertGreater(row['current_margin_to_low_trip_a'],0)
            self.assertLess(row['load_w_screen'],row['raw_v']*row['load_a'])
            self.assertGreater(row['efuse_heat_w_screen'],0)
        # QINH exact variant has manufacturer pin evidence and verified JLC identity.
        self.assertEqual(spec.COMPONENTS['QINH'][0],'SMMBT3904LT1G')
        self.assertEqual(spec.COMPONENTS['QINH'][2],'C84555')

    def test_generated_pins_and_repeatability(self):
        generate.generate()
        files=['candidate.kicad_sym','board-p-husb006-candidate.kicad_sch','draft-connections.csv','release-status.json','candidate-sourcing.csv']
        before={p:(HERE/p).read_bytes() for p in files}
        lib=generate.core.Library(str(HERE/'candidate.kicad_sym'))
        self.assertEqual({int(n):name for n,name,*rest in lib.pins_of('HUSB238_006DD')},spec.PIN_NAMES)
        parsed=sexp.parse(sexp.tokenize(before['board-p-husb006-candidate.kicad_sch'].decode()))
        self.assertEqual(sexp.atom(parsed[0]),'kicad_sch')
        generate.generate()
        self.assertEqual(before,{p:(HERE/p).read_bytes() for p in files})

    def test_manufacturing_release_refused(self):
        r=subprocess.run([sys.executable,str(HERE/'generate.py'),'--check-release'],capture_output=True,text=True)
        self.assertEqual(r.returncode,2)
        self.assertIn('"ready": false',r.stdout)
        self.assertIn('REJECTED_PENDING_ADMISSION_SAFETY',r.stdout)

if __name__=='__main__': unittest.main()
