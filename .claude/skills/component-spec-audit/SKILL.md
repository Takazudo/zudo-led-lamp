---
name: component-spec-audit
description: Audit exact electronic-component identities and datasheet-grounded constraints. Use whenever circuit, schematic, PCB, BOM, firmware, bring-up, substitution, or related documentation work could depend on a component rating, pin, package, state, source, or interaction—even when the request does not explicitly ask for a datasheet review.
---

# Component spec audit

Protect the design from plausible-looking but wrong component claims. Treat the generator specs as the placement identity lock and manufacturer documents as the authority for component behavior.

## Workflow

1. Run `python3 .claude/skills/component-spec-audit/scripts/validate.py` before relying on the registry.
2. Resolve every relevant line through `references/inventory.json` by exact MPN, LCSC ID, manufacturer alias, function alias, board, or refdes. Load its `owner_skill` directly. Do not answer a subordinate-record query only from the parent component.
3. Read the owner skill's local `manifest.json`, `sources.json`, `facts.json`, `coverage.json`, `routing.json`, `interactions.json`, and `pin-map.json`. Apply the same standard to standalone and subordinate records.
4. Preserve the distinctions in [contract.md](references/contract.md): source authority and availability, fact class, provenance, conditions, derived dependencies, and verdict vocabulary.
5. Cross-check claims against generated connectivity and symbol-to-footprint pin maps. For multi-component effects, also load the integration skill.
6. If an authoritative source cannot be retrieved or its retained extract does not support the claim, report `SOURCE UNAVAILABLE` and `UNSOURCED`; never reconstruct a fact from memory or a generic/same-name part.
7. Report exact fact IDs, source IDs, locators, conditions, calculations, and one allowed verdict. Keep design changes separate from the audit result.

## Creating or updating records

Copy `assets/component-skill-template/`, retain every required file, and follow [schema.json](references/schema.json). Give subordinate records independent IDs, sources, facts, locators, routing cases, and pin maps. Store normalized short evidence extracts, not vendor PDFs. Put temporary downloads only in ignored `tmp/pdfs/` and remove them after extraction.

Run the validator and unit tests after edits:

```sh
python3 .claude/skills/component-spec-audit/scripts/validate.py
python3 -m unittest discover -s .claude/skills/component-spec-audit/scripts -p 'test_*.py'
```

Use `--online` only for an explicit source refresh; it downloads into `tmp/pdfs/`, rejects stale hashes, and does not alter retained evidence.
