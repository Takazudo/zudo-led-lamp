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
        project = next(f for f in changed["facts"] if f["fact_id"] == "fact-golden-project")
        project.update({"provenance":"CALCULATED", "depends_on":["fact-golden-margin"], "expression":"fact_golden_margin"})
        with self.assertRaisesRegex(validator.ContractError, "cycle"):
            validator.validate_golden(changed, self.schema, False)

    def test_calculated_expression_dependency_identity_is_exact(self):
        golden = validator.load(validator.FIXTURES / "golden/critical-facts.json")
        margin = next(f for f in golden["facts"] if f["fact_id"] == "fact-golden-margin")
        margin["expression"] = "fact_golden_limit"
        with self.assertRaisesRegex(validator.ContractError, "exactly match depends_on"):
            validator.validate_golden(golden, self.schema, False)
        golden = validator.load(validator.FIXTURES / "golden/critical-facts.json")
        margin = next(f for f in golden["facts"] if f["fact_id"] == "fact-golden-margin")
        margin["depends_on"] = ["fact-golden-margin"]
        margin["expression"] = "fact_golden_margin"
        with self.assertRaisesRegex(validator.ContractError, "depends on itself"):
            validator.validate_golden(golden, self.schema, False)

    def test_source_unavailable_requires_explicit_state(self):
        bundle = validator.template_bundle()
        bundle["sources"][0]["availability"] = ""
        with self.assertRaisesRegex(validator.ContractError, "availability"):
            validator.validate_bundle(bundle, self.schema, True)

    def test_primary_and_calculated_pass_require_available_primary_leaves(self):
        bundle = validator.template_bundle()
        primary = bundle["facts"][1]
        primary.update({"provenance":"PRIMARY-SPEC", "verdict":"PASS - primary-source confirmed"})
        with self.assertRaisesRegex(validator.ContractError, "AVAILABLE MANUFACTURER_PRIMARY"):
            validator.validate_bundle(bundle, self.schema, True)
        golden = validator.load(validator.FIXTURES / "golden/critical-facts.json")
        next(f for f in golden["facts"] if f["fact_id"] == "fact-golden-margin")["verdict"] = "PASS - primary-source confirmed"
        with self.assertRaisesRegex(validator.ContractError, "dependency closure"):
            validator.validate_pass_trust(golden["facts"], golden["sources"])
        trusted = validator.load(validator.FIXTURES / "golden/critical-facts.json")
        trusted["sources"][0].update({"availability":"AVAILABLE", "authority_class":"MANUFACTURER_PRIMARY"})
        for fact_id in ("fact-golden-limit", "fact-golden-project"):
            next(f for f in trusted["facts"] if f["fact_id"] == fact_id).update({"provenance":"PRIMARY-SPEC", "verdict":"PASS - primary-source confirmed"})
        next(f for f in trusted["facts"] if f["fact_id"] == "fact-golden-margin")["verdict"] = "PASS - primary-source confirmed"
        validator.validate_pass_trust(trusted["facts"], trusted["sources"])

    def test_stale_online_hash_fails_and_removes_download(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "source.pdf"
            with self.assertRaisesRegex(validator.ContractError, "stale online hash"):
                validator.store_and_verify(b"fixture", target, "0" * 64, "src-test")
            self.assertFalse(target.exists())

    def test_subordinate_uses_full_contract(self):
        bundle = validator.load(validator.FIXTURES / "valid/subordinate-record.json")
        validator.validate_bundle(bundle, self.schema, True)
        next(f for f in bundle["facts"] if f["fact_id"] == "fact-child-pin")["locator"] = ""
        with self.assertRaisesRegex(validator.ContractError, "locator"):
            validator.validate_bundle(bundle, self.schema, True)

    def test_subordinate_parent_must_be_local_standalone(self):
        bundle = validator.load(validator.FIXTURES / "valid/subordinate-record.json")
        next(r for r in bundle["records"] if r["record_id"] == "rec-child")["parent_record_id"] = "rec-missing"
        with self.assertRaisesRegex(validator.ContractError, "parent must resolve"):
            validator.validate_bundle(bundle, self.schema, True)
        bundle = validator.load(validator.FIXTURES / "valid/subordinate-record.json")
        next(r for r in bundle["records"] if r["record_id"] == "rec-parent")["kind"] = "subordinate"
        next(r for r in bundle["records"] if r["record_id"] == "rec-parent")["parent_record_id"] = "rec-child"
        with self.assertRaisesRegex(validator.ContractError, "parent must resolve"):
            validator.validate_bundle(bundle, self.schema, True)

    def test_bundle_exact_parity_and_record_artifacts(self):
        for manifest_key, message in (("source_ids", "source ID parity"), ("fact_ids", "fact ID parity"), ("interaction_ids", "interaction ID parity")):
            bundle = validator.template_bundle()
            bundle["records"][0][manifest_key].pop()
            with self.assertRaisesRegex(validator.ContractError, message):
                validator.validate_bundle(bundle, self.schema, True)
        bundle = validator.template_bundle()
        bundle["records"][0]["fact_ids"].append(bundle["records"][0]["fact_ids"][0])
        with self.assertRaisesRegex(validator.ContractError, "duplicate fact_ids"):
            validator.validate_bundle(bundle, self.schema, True)
        for key, message in (("routes", "requires routing"), ("coverage", "requires coverage"), ("pin_maps", "requires pin map")):
            bundle = validator.template_bundle()
            bundle[key] = []
            with self.assertRaisesRegex(validator.ContractError, message):
                validator.validate_bundle(bundle, self.schema, True)

    def test_local_routing_fixtures_are_executed(self):
        bundle = validator.template_bundle()
        bundle["routes"][0]["positive"] = ["NOT-A-ROUTE"]
        with self.assertRaisesRegex(validator.ContractError, "positive query"):
            validator.validate_bundle(bundle, self.schema, True)
        bundle = validator.template_bundle()
        bundle["routes"][0]["negative"] = ["EXAMPLE-MPN"]
        with self.assertRaisesRegex(validator.ContractError, "negative query"):
            validator.validate_bundle(bundle, self.schema, True)

    def test_open_domains_and_open_coverage_match(self):
        bundle = validator.template_bundle()
        bundle["records"][0]["open_domains"] = ["harness"]
        with self.assertRaisesRegex(validator.ContractError, "open domains"):
            validator.validate_bundle(bundle, self.schema, True)
        bundle = validator.template_bundle()
        bundle["coverage"][0]["status"] = "OPEN"
        with self.assertRaisesRegex(validator.ContractError, "open domains"):
            validator.validate_bundle(bundle, self.schema, True)

    def test_malicious_generator_is_rejected_without_execution(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            marker = root / "executed"
            malicious = root / "spec.py"
            malicious.write_text(
                "COMPONENTS = {'U1': ('SAFE', 'SAFE', 'C1', 'lib:PKG', False, (0, 0))}\n"
                f"open({str(marker)!r}, 'w').write('owned')\n"
                "NETS = {}\n",
                encoding="utf-8",
            )
            with self.assertRaisesRegex(validator.ContractError, "unsafe generator syntax"):
                validator.parse_components(malicious)
            self.assertFalse(marker.exists())

    def test_generator_dsl_rejects_unsupported_component_syntax(self):
        unsafe = {
            "import": "import os",
            "attribute": "BAD = (1).real",
            "call": "BAD = len([])",
            "comprehension": "BAD = [x for x in []]",
            "lambda": "BAD = lambda: 1",
        }
        with tempfile.TemporaryDirectory() as directory:
            for name, statement in unsafe.items():
                with self.subTest(name=name):
                    path = Path(directory) / f"{name}.py"
                    path.write_text(f"COMPONENTS = {{}}\n{statement}\nNETS = {{}}\n", encoding="utf-8")
                    with self.assertRaisesRegex(validator.ContractError, "unsafe generator syntax"):
                        validator.parse_components(path)

    def test_generator_dsl_rejects_late_component_mutation(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "late.py"
            path.write_text("COMPONENTS = {}\nNETS = {}\nCOMPONENTS['U1'] = ('X', 'X', 'C1', 'lib:P', False, (0, 0))\n", encoding="utf-8")
            with self.assertRaisesRegex(validator.ContractError, "after NETS"):
                validator.parse_components(path)


if __name__ == "__main__":
    unittest.main()
