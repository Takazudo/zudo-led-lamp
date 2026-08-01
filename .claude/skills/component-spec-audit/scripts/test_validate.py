import copy
import importlib.util
import tempfile
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).with_name("validate.py")
SPEC = importlib.util.spec_from_file_location("component_spec_validate", MODULE_PATH)
validator = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(validator)


class ComponentSpecValidatorTests(unittest.TestCase):
    def setUp(self):
        self.schema = validator.load(validator.REFS / "schema.json")
        self.inventory_data = validator.load(validator.REFS / "inventory.json")
        self.lines = validator.validate_inventory(self.inventory_data)

    def test_full_offline_contract(self):
        self.assertEqual(validator.validate_all(), 32)

    def test_inventory_counts_and_exclusions(self):
        self.assertEqual(sum(not line["dnp"] for line in self.lines), 29)
        self.assertEqual(sum(line["dnp"] for line in self.lines), 3)
        self.assertEqual(len(self.inventory_data["exclusions"]), 4)

    def test_all_routing_cases_are_direct(self):
        validator.validate_routing(self.lines)
        fixture = validator.load(validator.FIXTURES / "direct-routing.json")
        self.assertEqual({case["line_id"] for case in fixture["cases"]}, {line["line_id"] for line in self.lines})

    def test_every_seeded_mutation_fails_for_expected_reason(self):
        golden = validator.load(validator.FIXTURES / "golden/critical-facts.json")
        seen = set()
        for path in sorted((validator.FIXTURES / "mutations").glob("*.json")):
            mutation = validator.load(path)
            seen.add(mutation["mutation"])
            changed = copy.deepcopy(golden)
            validator.set_target(changed, mutation["target"], mutation["to"])
            with self.assertRaisesRegex(validator.ContractError, mutation["expected_error"]):
                validator.validate_golden(changed, self.schema)
        self.assertTrue({"pin", "value", "unit", "condition", "default state", "locator"} <= seen)

    def test_derived_margin_recomputes_and_cycles_fail(self):
        golden = validator.load(validator.FIXTURES / "golden/critical-facts.json")
        changed = copy.deepcopy(golden)
        next(f for f in changed["facts"] if f["fact_id"] == "fact-golden-margin")["value"] = 4
        with self.assertRaisesRegex(validator.ContractError, "derived value is stale"):
            validator.validate_golden(changed, self.schema, False)
        changed = copy.deepcopy(golden)
        next(f for f in changed["facts"] if f["fact_id"] == "fact-golden-limit")["depends_on"] = ["fact-golden-margin"]
        with self.assertRaisesRegex(validator.ContractError, "cycle"):
            validator.validate_golden(changed, self.schema, False)

    def test_source_unavailable_requires_explicit_state(self):
        bundle = validator.template_bundle()
        bundle["sources"][0]["availability"] = ""
        with self.assertRaisesRegex(validator.ContractError, "availability"):
            validator.validate_bundle(bundle, self.schema, True)

    def test_stale_online_hash_fails_and_removes_download(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "source.pdf"
            with self.assertRaisesRegex(validator.ContractError, "stale online hash"):
                validator.store_and_verify(b"fixture", target, "0" * 64, "src-test")
            self.assertFalse(target.exists())

    def test_subordinate_uses_full_contract(self):
        child = validator.load(validator.FIXTURES / "valid/subordinate-record.json")
        bundle = {"records":[child["record"]], "sources":[child["source"]], "facts":child["facts"], "coverage":[child["coverage"]], "routes":[child["route"]], "interactions":[child["interaction"]], "pin_maps":[child["pin_map"]]}
        validator.validate_bundle(bundle, self.schema, True)
        bundle["facts"][1]["locator"] = ""
        with self.assertRaisesRegex(validator.ContractError, "locator"):
            validator.validate_bundle(bundle, self.schema, True)


if __name__ == "__main__":
    unittest.main()
