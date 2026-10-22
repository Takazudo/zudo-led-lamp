"""New protocol-observation cases; reuse existing threshold/latch models.
No generation, physical execution, or changes to preserved candidate evidence.
"""
import unittest
import contract_observation as o
from analyze_power_path import calculate
from adversarial_checks import latches


class ContractObservations(unittest.TestCase):
    def test_lower_next_pdo_contract_is_not_target_voltage(self):
        self.assertEqual(o.next_pdo([(5,3),(9,3),(12,3),(15,2)],15,3),(12,3))
        self.assertEqual(o.classify(12,'explicit'),'OUTSIDE_COLD_WINDOW')

    def test_target_selected_only_if_current_sufficient(self):
        self.assertEqual(o.next_pdo([(5,3),(15,3),(20,5)],15,3),(15,3))
        self.assertEqual(o.classify(15,'explicit'),'WITHIN_COLD_SCREEN_ONLY')
        self.assertIsNone(o.next_pdo([(5,1.5),(15,2)],15,3))

    def test_startup_and_loss_with_retained_voltage(self):
        self.assertEqual(o.classify(15,'startup'),'NOT_QUALIFIED_NO_CONTRACT')
        self.assertEqual(o.classify(15,'lost'),'NOT_QUALIFIED_NO_CONTRACT')
        # Hardware stale-GATE model can still be enabled: classifier is not a fix.
        self.assertTrue(latches(True,False,15,True,12.912,11.7284,17.16,15.587)[2])

    def test_voltage_cannot_establish_contract(self):
        self.assertEqual(o.classify(15,'unknown'),'INDETERMINATE_CONTRACT')

    def test_unknown_voltage_never_qualifies(self):
        for v in (None,float('nan'),float('inf'),float('-inf'),-1,'15',True):
            with self.subTest(v=v):
                self.assertEqual(o.classify(v,'explicit'),'INDETERMINATE_VOLTAGE')

    def test_corner_boundaries_are_not_nominal_shortcuts(self):
        c=calculate()
        for key in ('uv_rise_v','ov_rise_v'):
            midpoint=sum(c[key])/2
            self.assertEqual(o.classify(midpoint,'explicit'),'INDETERMINATE_THRESHOLD_CORNER')
        self.assertEqual(o.classify(c['uv_rise_v'][1],'explicit'),'WITHIN_COLD_SCREEN_ONLY')
        self.assertEqual(o.classify(c['ov_rise_v'][0],'explicit'),'INDETERMINATE_THRESHOLD_CORNER')
        self.assertEqual(o.classify(c['ov_rise_v'][1],'explicit'),'OUTSIDE_COLD_WINDOW')

    def test_lower_contract_after_on_is_distinct_from_cold_screen(self):
        # Existing nominal hysteresis finding reused: no new timing guarantee.
        self.assertTrue(latches(True,False,12.6,True,12.912,11.7284,17.16,15.587)[2])
        self.assertEqual(o.classify(12.6,'explicit'),'OUTSIDE_COLD_WINDOW')


if __name__=='__main__': unittest.main()
