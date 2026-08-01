#!/usr/bin/env python3
"""Offline-first component skill contract validator (Python standard library only)."""

from __future__ import annotations

import argparse
import ast
import copy
import hashlib
import json
import re
import runpy
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
AUDIT = ROOT / ".claude/skills/component-spec-audit"
REFS = AUDIT / "references"
FIXTURES = AUDIT / "fixtures"
TEMPLATE = AUDIT / "assets/component-skill-template"
HEX64 = re.compile(r"^[0-9a-f]{64}$")
ID = re.compile(r"^[a-z][a-z0-9-]*$")
LOCATOR_DETAIL = re.compile(r"(section|table|figure|row|pin|title block|calculated)", re.I)


class ContractError(ValueError):
    pass


def load(path: Path):
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def require(condition, message):
    if not condition:
        raise ContractError(message)


def required_keys(obj, keys, context):
    missing = [key for key in keys if key not in obj]
    require(not missing, f"{context}: missing keys {missing}")


def frontmatter(path: Path, expected_name: str):
    require(path.name == "SKILL.md", f"{path}: skill filename must be uppercase SKILL.md")
    text = path.read_text(encoding="utf-8")
    require(text.startswith("---\n"), f"{path}: missing YAML frontmatter")
    try:
        raw = text.split("---\n", 2)[1]
    except IndexError as exc:
        raise ContractError(f"{path}: unterminated frontmatter") from exc
    fields = {}
    for line in raw.splitlines():
        if ":" in line:
            key, value = line.split(":", 1)
            fields[key.strip()] = value.strip()
    require(fields.get("name") == expected_name, f"{path}: name must equal directory {expected_name}")
    description = fields.get("description", "")
    require(len(description) >= 80 and "use" in description.lower(), f"{path}: description lacks trigger quality")
    require("triggers" not in fields, f"{path}: undocumented triggers key")
    require(fields.get("disable-model-invocation") != "true", f"{path}: model invocation disabled")


def generator_inventory():
    grouped, excluded = {}, []
    for board, relpath in (("board-p", "scripts/schgen/board_p_spec.py"), ("board-l", "scripts/schgen/board_l_spec.py")):
        components = runpy.run_path(str(ROOT / relpath))["COMPONENTS"]
        for refdes, item in components.items():
            symbol, value, lcsc, footprint, dnp, _position = item
            if not lcsc:
                excluded.append((board, refdes))
                continue
            mpn = expected_mpn(symbol, value, lcsc)
            package = footprint.split(":", 1)[-1]
            entry = grouped.setdefault(lcsc, {"mpn": mpn, "package": package, "placements": []})
            require(entry["mpn"] == mpn and entry["package"] == package, f"generator LCSC {lcsc}: conflicting identity")
            entry["placements"].append({"board": board, "refdes": refdes, "dnp": bool(dnp)})
    return grouped, excluded


def expected_mpn(symbol, value, lcsc):
    if lcsc == "C144397":
        return value
    if re.search(r"_C\d+$", symbol):
        return re.sub(r"_C\d+$", "", symbol)
    return symbol


def validate_inventory(data):
    required_keys(data, ("schema_version", "generator_specs", "assertions", "exclusions", "lines"), "inventory")
    lines = data["lines"]
    require(len(lines) == 32, "inventory: expected exactly 32 orderable lines")
    require(len({line["line_id"] for line in lines}) == len(lines), "inventory: duplicate line_id ownership")
    require(len({line["lcsc"] for line in lines}) == len(lines), "inventory: duplicate LCSC ownership")
    generated, blank = generator_inventory()
    require(set(generated) == {line["lcsc"] for line in lines}, "inventory: LCSC identity differs from generator specs")
    for line in lines:
        required_keys(line, ("line_id", "mpn", "manufacturer", "lcsc", "package", "dnp", "owner_skill", "identity_state", "source_state", "function", "placements"), line.get("line_id", "line"))
        require(all(isinstance(line[key], str) and line[key].strip() for key in ("line_id", "mpn", "manufacturer", "lcsc", "package", "owner_skill", "function")), f"{line['line_id']}: blank identity field")
        require(ID.fullmatch(line["line_id"]), f"{line['line_id']}: invalid line ID")
        require(line["source_state"] in ("AVAILABLE", "SOURCE UNAVAILABLE"), f"{line['line_id']}: source availability state")
        require(line["identity_state"] in ("VERIFIED", "UNRESOLVED"), f"{line['line_id']}: identity state")
        expected = generated[line["lcsc"]]
        require(line["mpn"] == expected["mpn"], f"{line['line_id']}: wrong MPN against generator")
        require(line["package"] == expected["package"], f"{line['line_id']}: wrong package against generator")
        want_places = {(x["board"], x["refdes"], x["dnp"]) for x in expected["placements"]}
        got_places = {(x["board"], x["refdes"], line["dnp"]) for x in line["placements"]}
        require(got_places == want_places, f"{line['line_id']}: board/refdes or DNP mismatch")
    require(sum(not line["dnp"] for line in lines) == 29, "inventory: expected 29 fitted lines")
    require(sum(line["dnp"] for line in lines) == 3, "inventory: expected 3 DNP/hand-fit lines")
    exclusions = {(x["board"], x["refdes"]) for x in data["exclusions"]}
    require(exclusions == set(blank), "inventory: bare-copper exclusions differ from blank-LCSC generator entries")
    return lines


def resolve(query, lines):
    q = query.casefold()
    lcsc_tokens = {token.upper() for token in re.findall(r"\bC\d+\b", query, re.I)}
    if lcsc_tokens:
        return [line["line_id"] for line in lines if line["lcsc"] in lcsc_tokens]
    found = []
    for line in lines:
        aliases = (line["mpn"], line["lcsc"], f"{line['manufacturer']} {line['mpn']}", f"{line['function']} {line['mpn']}")
        if any(alias.casefold() in q for alias in aliases):
            found.append(line["line_id"])
    return found


def validate_routing(lines, fixtures=None):
    fixtures = fixtures or load(FIXTURES / "direct-routing.json")
    cases = fixtures["cases"]
    require(len(cases) == 32 and {x["line_id"] for x in cases} == {x["line_id"] for x in lines}, "routing: all 32 lines need one fixture")
    by_id = {line["line_id"]: line for line in lines}
    for case in cases:
        line = by_id[case["line_id"]]
        queries = (line["mpn"], line["lcsc"], f"{line['manufacturer']} {line['mpn']}", f"{line['function']} {line['mpn']}")
        for query in queries:
            require(resolve(query, lines) == [line["line_id"]], f"routing {line['line_id']}: positive query is not direct and unique: {query}")
        require(resolve(case["negative"], lines) == [], f"routing {line['line_id']}: negative query unexpectedly resolves")


def validate_source(source, schema):
    required_keys(source, schema["source_required"], source.get("source_id", "source"))
    require(ID.fullmatch(source["source_id"]), f"{source['source_id']}: invalid source ID")
    require(source["availability"] in schema["source_availability"], f"{source['source_id']}: invalid availability")
    require(source["authority_class"] in schema["authority_classes"], f"{source['source_id']}: authority class")
    require(HEX64.fullmatch(source["sha256"]), f"{source['source_id']}: SHA-256 must be 64 lowercase hex digits")
    require(isinstance(source["physical_pdf_page_index"], int) and source["physical_pdf_page_index"] >= 0, f"{source['source_id']}: PDF page index")
    for key in ("document_title", "document_number", "revision", "document_date", "authoritative_url", "retrieval_date", "printed_page_label", "locator", "evidence_extract"):
        require(isinstance(source[key], str) and source[key].strip(), f"{source['source_id']}: blank {key}")
    require(LOCATOR_DETAIL.search(source["locator"]), f"{source['source_id']}: locator lacks section/table/figure/row detail")


def graph_cycles(facts):
    graph = {fact["fact_id"]: fact.get("depends_on", []) for fact in facts}
    visiting, done = set(), set()
    def visit(node):
        if node in visiting:
            raise ContractError(f"facts: derived dependency cycle at {node}")
        if node in done:
            return
        visiting.add(node)
        for dep in graph.get(node, []):
            require(dep in graph, f"{node}: missing dependency {dep}")
            visit(dep)
        visiting.remove(node)
        done.add(node)
    for node in graph:
        visit(node)


def arithmetic(expression, values):
    tree = ast.parse(expression, mode="eval")
    def ev(node):
        if isinstance(node, ast.Expression): return ev(node.body)
        if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)): return node.value
        if isinstance(node, ast.Name) and node.id in values: return values[node.id]
        if isinstance(node, ast.BinOp) and isinstance(node.op, (ast.Add, ast.Sub, ast.Mult, ast.Div)):
            left, right = ev(node.left), ev(node.right)
            return {ast.Add: left + right, ast.Sub: left - right, ast.Mult: left * right, ast.Div: left / right}[type(node.op)]
        raise ContractError(f"unsafe or unknown expression: {expression}")
    return ev(tree)


def validate_facts(facts, sources, schema):
    source_ids = {source["source_id"] for source in sources}
    require(len({fact["fact_id"] for fact in facts}) == len(facts), "facts: duplicate fact ID")
    for fact in facts:
        required_keys(fact, schema["fact_required"], fact.get("fact_id", "fact"))
        require(ID.fullmatch(fact["fact_id"]), f"{fact['fact_id']}: invalid fact ID")
        require(fact["source_id"] in source_ids, f"{fact['fact_id']}: unknown source ID")
        require(fact["class"] in schema["fact_classes"], f"{fact['fact_id']}: fact class")
        require(fact["provenance"] in schema["provenance"], f"{fact['fact_id']}: provenance")
        require(fact["verdict"] in schema["verdicts"], f"{fact['fact_id']}: verdict")
        for key in ("unit", "conditions", "locator"):
            require(isinstance(fact[key], str) and fact[key].strip(), f"{fact['fact_id']}: missing {key}")
        require(LOCATOR_DETAIL.search(fact["locator"]), f"{fact['fact_id']}: locator lacks exact detail")
        if fact["provenance"] == "CALCULATED":
            require(fact["depends_on"] and fact["expression"], f"{fact['fact_id']}: calculated fact lacks dependencies/expression")
    graph_cycles(facts)
    values = {fact["fact_id"]: fact["value"] for fact in facts}
    for fact in facts:
        if fact["provenance"] == "CALCULATED":
            require(arithmetic(fact["expression"], {key.replace("-", "_"): value for key, value in values.items()}) == fact["value"], f"{fact['fact_id']}: derived value is stale")


def validate_pin_maps(pin_maps):
    for mapping in pin_maps:
        required_keys(mapping, ("pin_map_id", "record_id", "symbol", "footprint", "pins", "reviewed_by"), "pin map")
        require(mapping["pins"], f"{mapping['pin_map_id']}: empty pin map")
        symbol_pins = [pin["symbol_pin"] for pin in mapping["pins"]]
        pads = [pin["footprint_pad"] for pin in mapping["pins"]]
        require(len(set(symbol_pins)) == len(symbol_pins), f"{mapping['pin_map_id']}: duplicate symbol pin")
        require(len(set(pads)) == len(pads), f"{mapping['pin_map_id']}: duplicate footprint pad")
        for pin in mapping["pins"]:
            required_keys(pin, ("symbol_pin", "name", "footprint_pad", "function"), mapping["pin_map_id"])


def validate_bundle(bundle, schema, allow_synthetic_line=False):
    records, sources, facts = bundle["records"], bundle["sources"], bundle["facts"]
    for source in sources: validate_source(source, schema)
    validate_facts(facts, sources, schema)
    validate_pin_maps(bundle["pin_maps"])
    record_ids = {record["record_id"] for record in records}
    require(len(record_ids) == len(records), "duplicate record ID")
    id_groups = {
        "source": [item["source_id"] for item in sources],
        "fact": [item["fact_id"] for item in facts],
        "interaction": [item["interaction_id"] for item in bundle["interactions"]],
        "coverage": [item["coverage_id"] for item in bundle["coverage"]],
        "route": [item["route_id"] for item in bundle["routes"]],
        "pin map": [item["pin_map_id"] for item in bundle["pin_maps"]],
    }
    for label, values in id_groups.items():
        require(len(set(values)) == len(values), f"duplicate {label} ID")
    for record in records:
        required_keys(record, schema["record_required"], record.get("record_id", "record"))
        require(record["kind"] in ("standalone", "subordinate"), f"{record['record_id']}: record kind")
        require((record["kind"] == "subordinate") == bool(record["parent_record_id"]), f"{record['record_id']}: subordinate parent contract")
        manufacturer_facts = [fact for fact in facts if fact["record_id"] == record["record_id"] and fact["fact_id"].endswith("-manufacturer")]
        require(manufacturer_facts, f"{record['record_id']}: unsourced manufacturer fact")
        for fact in manufacturer_facts:
            require(fact["value"] == record["manufacturer"] and fact["provenance"] in ("PRIMARY-SPEC", "UNVERIFIED"), f"{record['record_id']}: manufacturer evidence invalid")
        require(set(record["source_ids"]) <= {x["source_id"] for x in sources}, f"{record['record_id']}: source IDs")
        require(set(record["fact_ids"]) <= {x["fact_id"] for x in facts}, f"{record['record_id']}: fact IDs")
        require(set(record["interaction_ids"]) <= {x["interaction_id"] for x in bundle["interactions"]}, f"{record['record_id']}: interaction IDs")
    for source in sources:
        require(source.get("record_id") in record_ids, f"{source['source_id']}: unknown record ID")
    for fact in facts:
        require(fact["record_id"] in record_ids, f"{fact['fact_id']}: unknown record ID")
        source = next(item for item in sources if item["source_id"] == fact["source_id"])
        if fact["provenance"] == "PRIMARY-SPEC":
            require(source["authority_class"] == "MANUFACTURER_PRIMARY", f"{fact['fact_id']}: primary provenance needs manufacturer primary source")
        if fact["verdict"] == "PASS - primary-source confirmed":
            require(fact["provenance"] in ("PRIMARY-SPEC", "CALCULATED"), f"{fact['fact_id']}: PASS lacks primary/calculated provenance")
    for coverage in bundle["coverage"]:
        required_keys(coverage, schema["coverage_required"], "coverage")
        require(coverage["status"] in ("COVERED", "OPEN"), f"{coverage['coverage_id']}: unexplained coverage gap")
        require(coverage["reason"].strip(), f"{coverage['coverage_id']}: coverage reason")
        require(coverage["record_id"] in record_ids, f"{coverage['coverage_id']}: unknown record ID")
    for interaction in bundle["interactions"]:
        required_keys(interaction, schema["interaction_required"], "interaction")
        require(interaction["verdict"] in schema["verdicts"], f"{interaction['interaction_id']}: verdict")
        require(set(interaction["record_ids"]) <= record_ids, f"{interaction['interaction_id']}: unknown record ID")
        require(set(interaction["fact_ids"]) <= {fact["fact_id"] for fact in facts}, f"{interaction['interaction_id']}: unknown fact ID")
    for route in bundle["routes"]:
        required_keys(route, ("route_id", "record_id", "aliases", "positive", "negative"), "route")
        require(set(route["aliases"]) == {"mpn", "lcsc", "manufacturer", "function"}, f"{route['route_id']}: routing alias classes")
        require(all(route["aliases"][key] for key in route["aliases"]), f"{route['route_id']}: blank routing aliases")
        require(route["positive"] and route["negative"], f"{route['route_id']}: positive/negative routing fixtures")
        require(route["record_id"] in record_ids, f"{route['route_id']}: unknown record ID")
        record = next(item for item in records if item["record_id"] == route["record_id"])
        require(record["mpn"] in route["aliases"]["mpn"] and record["lcsc"] in route["aliases"]["lcsc"] and record["manufacturer"] in route["aliases"]["manufacturer"], f"{route['route_id']}: exact identity aliases missing")
    for mapping in bundle["pin_maps"]:
        require(mapping["record_id"] in record_ids, f"{mapping['pin_map_id']}: unknown record ID")


def load_skill_bundle(skill_dir):
    return {
        "records": load(skill_dir / "manifest.json")["records"],
        "sources": load(skill_dir / "sources.json")["sources"],
        "facts": load(skill_dir / "facts.json")["facts"],
        "coverage": load(skill_dir / "coverage.json")["coverage"],
        "routes": load(skill_dir / "routing.json")["routes"],
        "interactions": load(skill_dir / "interactions.json")["interactions"],
        "pin_maps": load(skill_dir / "pin-map.json")["pin_maps"],
    }


def validate_local_skills(schema, inventory):
    required = schema["required_skill_files"]
    owners = {line["owner_skill"] for line in inventory}
    global_ids = {label: set() for label in ("record", "source", "fact", "interaction")}
    for skill_dir in sorted((ROOT / ".claude/skills").glob("component-*")):
        if skill_dir.name == "component-spec-audit" or not skill_dir.is_dir():
            continue
        missing = [name for name in required if not (skill_dir / name).is_file()]
        require(not missing, f"{skill_dir.name}: missing local manifest files {missing}")
        frontmatter(skill_dir / "SKILL.md", skill_dir.name)
        require(skill_dir.name in owners, f"{skill_dir.name}: no central owner assignment")
        bundle = load_skill_bundle(skill_dir)
        validate_bundle(bundle, schema)
        expected = {line["line_id"]: line for line in inventory if line["owner_skill"] == skill_dir.name}
        actual = {record["line_id"]: record for record in bundle["records"]}
        require(set(actual) == set(expected), f"{skill_dir.name}: local manifest does not own exactly its assigned inventory lines")
        for line_id, record in actual.items():
            line = expected[line_id]
            for key in ("mpn", "manufacturer", "lcsc", "package"):
                require(record[key] == line[key], f"{skill_dir.name}/{line_id}: {key} differs from inventory")
        current = {
            "record": {item["record_id"] for item in bundle["records"]},
            "source": {item["source_id"] for item in bundle["sources"]},
            "fact": {item["fact_id"] for item in bundle["facts"]},
            "interaction": {item["interaction_id"] for item in bundle["interactions"]},
        }
        for label, values in current.items():
            require(not (values & global_ids[label]), f"{skill_dir.name}: duplicate global {label} IDs")
            global_ids[label].update(values)


def validate_golden(data, schema, enforce_lock=True):
    for source in data["sources"]: validate_source(source, schema)
    validate_facts(data["facts"], data["sources"], schema)
    validate_pin_maps([data["pin_map"]])
    if enforce_lock:
        facts = {fact["fact_id"]: fact for fact in data["facts"]}
        expected = {
            "fact-golden-pin": ("1", "pin", "symbol-to-footprint mapping", "src-golden: Section 2, Figure 1, pin 1"),
            "fact-golden-limit": (20, "V", "DC, TA=25 degC", "src-golden: Section 2, Table 3, row VIN_MAX"),
            "fact-golden-project": (15, "V", "nominal contracted input", "src-golden: Section 2, Table 3, row VIN_PROJECT"),
            "fact-golden-default": ("LOW", "NONE", "after power-on reset before configuration", "src-golden: Section 2, Table 3, row RESET_DEFAULT"),
        }
        for fact_id, values in expected.items():
            fact = facts[fact_id]
            require((fact["value"], fact["unit"], fact["conditions"], fact["locator"]) == values, f"golden fact changed: {fact_id}")
        require(data["pin_map"]["pins"][0]["footprint_pad"] == "1", "golden pin map changed")


def set_target(data, target, value):
    parts = target.split(".")
    current = data
    for part in parts[:-1]:
        if isinstance(current, list):
            if part.isdigit():
                current = current[int(part)]
            else:
                current = next(item for item in current if item.get("line_id") == part or item.get("fact_id") == part or item.get("source_id") == part or item.get("coverage_id") == part)
        else:
            current = current[part]
    current[parts[-1]] = value


def template_bundle():
    return load_skill_bundle(TEMPLATE)


def run_seeded_fixtures(schema, inventory):
    golden = load(FIXTURES / "golden/critical-facts.json")
    validate_golden(golden, schema)
    mutations = sorted((FIXTURES / "mutations").glob("*.json"))
    require(len(mutations) >= 6, "mutations: expected pin/value/unit/condition/default/locator fixtures")
    for path in mutations:
        mutation = load(path)
        changed = copy.deepcopy(golden)
        set_target(changed, mutation["target"], mutation["to"])
        try:
            validate_golden(changed, schema)
        except ContractError as exc:
            require(mutation["expected_error"] in str(exc), f"{path.name}: failed for unintended reason: {exc}")
        else:
            raise ContractError(f"{path.name}: seeded mutation passed")
    subordinate = load(FIXTURES / "valid/subordinate-record.json")
    validate_bundle({"records":[subordinate["record"]], "sources":[subordinate["source"]], "facts":subordinate["facts"], "coverage":[subordinate["coverage"]], "routes":[subordinate["route"]], "interactions":[subordinate["interaction"]], "pin_maps":[subordinate["pin_map"]]}, schema, True)
    for case in load(FIXTURES / "invalid/contract-cases.json")["cases"]:
        try:
            if case["base"] == "inventory":
                changed = copy.deepcopy({"lines": inventory})
                set_target(changed, case["target"], case["value"])
                validate_inventory({**load(REFS / "inventory.json"), "lines": changed["lines"]})
            elif case["base"] == "golden":
                changed = copy.deepcopy(golden); set_target(changed, case["target"], case["value"]); validate_golden(changed, schema, False)
            else:
                bundle = template_bundle(); set_target(bundle, case["target"], case["value"]); validate_bundle(bundle, schema, True)
        except (ContractError, StopIteration) as exc:
            require(case["expected_error"].casefold() in str(exc).casefold(), f"{case['name']}: failed for unintended reason: {exc}")
        else:
            raise ContractError(f"{case['name']}: invalid fixture passed")


def store_and_verify(payload, target, expected_sha256, source_id):
    target.write_bytes(payload)
    try:
        require(hashlib.sha256(payload).hexdigest() == expected_sha256, f"{source_id}: stale online hash")
    finally:
        target.unlink(missing_ok=True)


def online_sources(schema):
    temp = ROOT / "tmp/pdfs"
    temp.mkdir(parents=True, exist_ok=True)
    try:
        for skill_dir in sorted((ROOT / ".claude/skills").glob("component-*")):
            source_file = skill_dir / "sources.json"
            if not source_file.exists(): continue
            for source in load(source_file)["sources"]:
                validate_source(source, schema)
                if source["availability"] != "AVAILABLE": continue
                target = temp / f"{source['source_id']}.pdf"
                with urllib.request.urlopen(source["authoritative_url"], timeout=30) as response:
                    payload = response.read()
                store_and_verify(payload, target, source["sha256"], source["source_id"])
    finally:
        if temp.exists() and not any(temp.iterdir()): temp.rmdir()


def validate_all(online=False):
    schema = load(REFS / "schema.json")
    frontmatter(AUDIT / "SKILL.md", "component-spec-audit")
    inventory = validate_inventory(load(REFS / "inventory.json"))
    validate_routing(inventory)
    validate_local_skills(schema, inventory)
    validate_bundle(template_bundle(), schema, True)
    run_seeded_fixtures(schema, inventory)
    if online: online_sources(schema)
    return len(inventory)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--online", action="store_true", help="opt in to authoritative URL/hash checks")
    args = parser.parse_args()
    try:
        count = validate_all(args.online)
    except (ContractError, json.JSONDecodeError, OSError) as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1
    print(f"PASS: component-spec contract; {count} lines; offline={not args.online}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
