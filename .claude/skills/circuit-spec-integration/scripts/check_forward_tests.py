#!/usr/bin/env python3
"""Execute cross-component routing and refusal-policy forward tests."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
VALIDATOR = ROOT / ".claude/skills/component-spec-audit/scripts/validate.py"
RULES = ROOT / ".claude/skills/circuit-spec-integration/references/rules.json"
CASES = ROOT / ".claude/skills/circuit-spec-integration/references/forward-tests.json"


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def main():
    spec = importlib.util.spec_from_file_location("component_spec_validate", VALIDATOR)
    validator = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(validator)
    schema = validator.load(validator.REFS / "schema.json")
    inventory = validator.validate_inventory(validator.load(validator.REFS / "inventory.json"))
    aggregate = validator.validate_local_skills(schema, inventory)
    facts = {fact["fact_id"]: fact for fact in aggregate["facts"]}
    sources = {source["source_id"] for source in aggregate["sources"]}
    records = {record["record_id"]: record for record in aggregate["records"]}
    rules = {rule["rule_id"]: rule for rule in load(RULES)["rules"]}
    tests = load(CASES)

    for case in tests["cases"]:
        selected = [rules[rule_id] for rule_id in case["rule_ids"]]
        selected_record_ids = set().union(*(set(rule["record_ids"]) for rule in selected))
        selected_fact_ids = set().union(*(set(rule["fact_ids"]) for rule in selected))
        assert len(case["prompt"].split()) >= 18, case["case_id"]
        assert case["expected_trigger_skill"] == "circuit-spec-integration", case["case_id"]
        assert [rule["verdict"] for rule in selected] == case["expected_verdicts"], case["case_id"]
        assert set(case["direct_record_ids"]) == selected_record_ids, case["case_id"]
        assert set(case["subordinate_record_ids"]) <= set(case["direct_record_ids"]), case["case_id"]
        assert all(records[record_id]["kind"] == "subordinate" for record_id in case["subordinate_record_ids"]), case["case_id"]
        assert set(case["required_source_ids"]) <= sources, case["case_id"]
        assert set(case["required_fact_ids"]) <= selected_fact_ids <= set(facts), case["case_id"]
        assert all(facts[fact_id]["source_id"] in case["required_source_ids"] for fact_id in case["required_fact_ids"]), case["case_id"]
        assert all(facts[fact_id]["conditions"].strip() and facts[fact_id]["locator"].strip() for fact_id in case["required_fact_ids"]), case["case_id"]
        assert all(bool(rule["refusal"].strip()) == case["must_refuse"] for rule in selected), case["case_id"]
        for query in case["routing_queries"]:
            assert validator.resolve(query["query"], inventory) == query["expected_line_ids"], case["case_id"]
    for case in tests["negative_routes"]:
        assert validator.resolve(case["query"], inventory) == case["expected_line_ids"], case["query"]
    print(f"PASS: {len(tests['cases'])} integration cases; {len(tests['negative_routes'])} negative routes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
