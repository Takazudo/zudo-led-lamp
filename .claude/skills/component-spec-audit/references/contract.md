# Frozen component-spec contract (version 1)

The central inventory is generated-spec identity truth; an owner record is evidence truth. One inventory line represents one nonblank LCSC/orderable identity and may have many placements. Bare-copper pogo and test pads remain explicit exclusions.

Every standalone or subordinate record uses the same files and schema. Subordinates receive their own record, source, fact, interaction, routing, coverage, and pin-map IDs; parentage changes organization, never rigor.

A subordinate's `parent_record_id` resolves to a standalone record in the same bundle. Each record lists exactly all and only its assigned source, fact, and interaction IDs, has direct positive/negative routing plus coverage and pin-map data, and owns no unexplained orphan data. Each open domain is a named entry matched one-for-one by `OPEN` coverage with an explicit reason.

## Evidence retention

A source lock records document title/number, revision/date, primary and optional alternate authoritative URLs, retrieval date, authority class, SHA-256, physical PDF page index, printed label, and exact section/table/figure/row locator. Retain a normalized, minimal evidence extract beside the locator so a reviewer can audit a critical claim without redistributing a PDF. An inaccessible source is `SOURCE UNAVAILABLE`; its old hash/extract may remain for audit history but cannot promote a new claim or invite a memory-based fallback.

Fact classes are `ABSOLUTE_MAXIMUM`, `RECOMMENDED_OPERATION`, `GUARANTEED_ELECTRICAL`, `TYPICAL_CURVE`, `TRANSIENT`, `PROTECTION_STANDOFF`, `PROTECTION_BREAKDOWN`, `PROTECTION_CLAMP`, `THERMAL_SOA`, and `PROJECT_STATE`. Provenance is `PRIMARY-SPEC`, `REFERENCE-DESIGN`, `CALCULATED`, `PROJECT-CHOICE`, `BENCH-OBSERVED`, or `UNVERIFIED`. Every quantitative fact carries an explicit unit and conditions; textual facts use unit `NONE`. Calculated facts list raw fact IDs and an evaluable arithmetic expression. Cycles are invalid.

Only these verdicts are valid: `PASS - primary-source confirmed`, `BLOCKER - deterministic spec violation`, `NEEDS BENCH`, `UNSOURCED`, and `NOT APPLICABLE`.

`PRIMARY-SPEC` may receive a PASS only from an `AVAILABLE` `MANUFACTURER_PRIMARY` source. A calculated PASS is trusted only when every raw leaf in its dependency closure is such a primary-source PASS. Its expression names exactly the transformed fact IDs in `depends_on`; undeclared, unused, self, missing, or cyclic dependencies fail.

Unknown identity, source, open harness/mechanical domains, unavailable URLs, and unexplained coverage gaps stay explicit. Generic-family, distributor, or same-name cross-vendor data never silently stands in for the exact orderable.
