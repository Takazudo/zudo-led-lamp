# Component evidence stays readable in native zudo-doc

Presentation contract for [#136](https://github.com/Takazudo/zudo-led-lamp/issues/136),
under [#135](https://github.com/Takazudo/zudo-led-lamp/issues/135). Baseline:
`de6b355107d8b6adaa1a706358fe5c02315f272a`. This contract changes presentation;
the publication policy and evidence remain authoritative and unchanged.

## One new fact primitive earns its place

Add **`EvidenceFact({ children })`**, an SSR component with no authored attributes.
Its children are ordinary Markdown. It groups one fact's ID, value, unit,
conditions, exact verdict, provenance and full citation in reading order. Use a
plain `div.zld-evidence-fact`; do not add a tab stop, landmark, disclosure,
client island, generated heading or hidden data payload. A subtle token-colored
separator and compact paragraph spacing distinguish adjacent facts. Retain native
body typography, links and code styling. Facts form one vertical sequence at all
widths: no masonry, parallel cards or rearrangement of the evidence order.

Keep coverage and sources as Markdown. Keep `EvidenceAnchor`, `EvidenceTable`
and pin-only `EvidenceDetails`. Keep the existing `ComponentReferences` descriptor
API and preview islands for the accepted Documents and package behavior below.
No source popover, coverage widget, new page shell or framework package change.

The new primitive solves a specific repeated problem: a seven-column fact row
separates a value from its conditions, verdict and locator when the content area
is narrow. The primitive's spacing and boundary keep those claims together while
leaving their complete content readable in raw Markdown and static exports.

## The comparisons select visible evidence over horizontal scanning

These are alternatives for the **actual native record route**, with its header,
sidebar and TOC consuming width, not standalone page designs.

| Area | Treatment A | Treatment B | Decision and cost |
| --- | --- | --- | --- |
| Facts and repeated citations | Current seven-column Markdown table in `EvidenceTable`: Fact, Value, Unit, Conditions, Verdict, Provenance, Evidence. A repeated full locator occupies each row's last column. | One `EvidenceFact` per fact: identifier, value/unit, conditions, verdict/provenance, then full linked locator. Class headings remain outside the primitive. | **B.** All of one fact can be read vertically without moving between horizontal scroll positions. More vertical length is acceptable; keep spacing compact and class navigation intact. |
| Citation deduplication | Print a short source ID at each fact and move the locator into source detail, a footnote, or a popover. | Keep the exact locator inline in its fact; link it to the source. Print a separate source ID only when the locator does not already contain it. | **B.** Locators identify different rows/pages in the same source; source-level grouping cannot replace them. Repeated source IDs inside exact locators are retained. No hover dependency or new citation component. |
| Coverage | A table of domain/status/reason/facts/blockers, or bordered `CoverageDomain` cards with the same fields. | Native `###` domain headings; one compact ID/status paragraph; full reason; ordinary lists of fact and blocking links. | **B.** Long reasons need full width; cards repeat structure already supplied by headings and introduce needless wrappers. A wide coverage table makes the critical reason difficult to read on a phone. |
| Sources | Current heading plus ten separate metadata bullets, or a `SourceReference` card taking a descriptor. | Native `###` document title, ID/authority paragraph, a two-column metadata table, full locator paragraph, then availability and document URL together. | **B.** The table aligns short labels while long locator/URL text gets full width. Markdown preserves all content without another descriptor or component API. |

Do not collapse repeated facts across different records or classes. Fact identity,
conditions and ownership determine whether two claims are distinct. The source
list remains complete even when several facts cite the same source or the selected
document shortcut points to just one of several sources.

## Every section has an explicit rendering decision

The table is exhaustive for `landing.ts`, `catalog.ts`, `record.ts` (including the
records index), and `integration.ts`. Examples use the normal Markdown constructs
shown in the next section; they are not new components unless named here.

| Section and reader question | Existing pain; Markdown treatment | Component alternative; decision |
| --- | --- | --- |
| Landing orientation / How to read: what is published? | Long introductory text; retain a short orientation and the existing four distinct evidence explanations as a list. | Intro card: rejected; ordinary prose needs no wrapper. |
| Landing Corpus: how much is published? | Many counts can look like a grade; retain the labeled Item/Count table and non-approval explanation. | Statistic tiles: rejected; they suggest scoring and take more space. |
| Landing Raw agent resources / Sections: where next? | Navigation is separated from the introduction; keep the existing resource link and package `CategoryNav`. | Custom navigation/search: rejected; package navigation remains authoritative. |
| Records index: where is an exact record? | Long list; keep inventory order and subordinate adjacency, linked MPN, exact record ID and function in each item. | Search/filter island: rejected; native search already owns discovery. |
| Catalog How to read / Parts at a glance: compare which states? | Seven wide columns; preserve the complete comparison table in `EvidenceTable label="parts-index"`, exact separate Fit/Identity/Sources/Open domains and denominator. | Per-part cards: rejected for comparison; they scatter the state columns. |
| Catalog full Part entries: exact identity and every placement? | Fourteen bullets per entry obscure scan groups; keep each `###` MPN, then three small labeled Markdown groups: identity; placements and fit; evidence state and links. | Catalog-entry wrapper: rejected; use two-column identity metadata and ordinary state paragraphs/list links. Preserve every old field and both record/resource links. |
| Record orientation / subordinate relation: whose evidence? | Parentage can disappear among metadata; retain explicit subordinate paragraph and linked parent before Identity. | Relationship badge: rejected; cannot replace the explanation or missing-parent state. |
| Identity: which exact orderable? | A long uniform bullet list mixes identity with evidence state; use a two-column Field/Recorded value table for Record ID, kind, MPN, manufacturer, function, LCSC, package, inventory line, aliases and owner. Follow with labeled Fit, Identity state, Source state and Coverage paragraphs. | Identity card: rejected; Markdown already provides label/value alignment. Preserve the absent-LCSC wording and optional-field rules. |
| Documents and package: which document and shared assets? | Current three-column card layout misaligns previews and emits its major heading internally. | **Existing `ComponentReferences`**: accepted full-width document row followed by paired preview stages; see fixed API below. |
| Placements: where is it fitted? | Multiple boards/refdes must not be summarized away; retain the Board/Reference designator table and explicit empty sentence. | Placement chips/map: rejected; no extra interaction helps this small comparison. |
| Coverage: what remains open? | Long repeated metadata and fact lists precede facts; use the selected native heading/paragraph/list treatment. | Coverage cards/table: rejected as above. Coverage remains before Facts. |
| Facts / class gloss: exact claim under which conditions? | Seven-column rows split related claims; preserve class order, `###` class heading and gloss, then **`EvidenceFact`** per fact. | Selected primitive; no one-heading-per-fact TOC explosion. Empty Facts remains explicit. |
| Calculation dependencies: can I recompute it? | Expressions and long cross-record dependencies form wide cells; keep `## Calculation dependencies`, one labeled Markdown block per calculated fact, linked fact ID, exact expression and dependency list. | Calculator / derived-value card: rejected; no evaluation, rounding or recomputation occurs. Preserve current section-presence rules and explicit missing expression/input wording. |
| Pin maps: which symbol/pad mapping? | Dense lookup rows distract; keep map `###` ID, anchor, symbol/footprint/pin count and `EvidenceDetails label="pin-assignments"` around the existing `EvidenceTable`. | New pin viewer: rejected. Native disclosure is allowed only for the assignment table; empty-map/pin wording stays visible. |
| Interactions: what spans records? | Repeated long metadata lists; keep `###` ID, records involved, conditions, exact verdict, and linked fact list. Compact the metadata paragraphs; do not group unrelated interactions. | Interaction card: rejected; these are prose and graph links, with no new behavior needed. |
| Record Cross-component rules: where is the complete refusal? | Verdict could look like record approval; keep existing rule links with domain and exact **rule** verdict, the explanation and full integration link. | Duplicated abbreviated rule card: rejected; full rule/refusal remains on integration page. |
| Sources: what supports these facts? | Ten similar bullet labels per source; use the selected Markdown source layout. | Source descriptor/card: rejected as above. Source availability is distinct from record source state. |
| Record / integration Legend: what do these terms mean? | Long explanatory text is useful reference; retain native subgroup headings and two-column tables derived from terms actually present, including unknown-term fallback. | Tooltip glossary: rejected; definitions must exist in static output. |
| Record / integration Raw agent resource: what is authoritative? | Repeated boilerplate; retain authority explanation and exact owning-bundle links or explicit absence. | Resource card: rejected; a normal link is sufficient. |
| Integration orientation / Rules at a glance: which cross-part question? | Wide state comparison; retain the normal explanatory list and `EvidenceTable label="rules-index"` with all index fields. | Status dashboard: rejected; no aggregate approval exists. |
| Integration rule body: what may be concluded? | A verdict can dominate the qualification; keep `##` rule ID, domain, **verdict immediately followed by refusal**, then conditions, records and fact links. | Rule wrapper/admonition: rejected; exact labeled prose is already prominent and requires no invented severity. |
| Integration conditioned calculations / results: which inputs give which recorded result? | Long conditions and variable cases; keep calculation headings, expression/result key, full conditions/input links and existing result tables. Wider tables retain keyboard-scrollable `EvidenceTable`. | Interactive arithmetic: rejected; recorded values and union of case input keys remain authoritative. |
| Integration source-to-bench chain: which stage has evidence? | Fact-link cells can become dense; keep ordered Stage/Status/Facts table in `EvidenceTable label="evidence-chain"`, shared exact fact links and explicit no-fact wording. | Timeline/progress bar: rejected; implies completion propagates across stages. |

Ordinary prose shortening may remove presentation boilerplate only when its
meaning is retained. Never shorten a recorded condition, reason, locator, refusal,
glossary term or verdict. Do not rename existing major headings except the fixed
Documents and package heading; preserve their current heading-derived links.

## Authors can read the complete claim without decoding props

The following AO3401A fact is copied from the baseline projection to illustrate
shape, not to re-author evidence. Production values always come from the public
view model through existing safe AST builders.

```mdx
---
title: "AO3401A"
---

## Facts

### ABSOLUTE_MAXIMUM

<EvidenceFact>

<EvidenceAnchor id="fact-umw-ao3401a-vds" />

**Fact:** `fact-umw-ao3401a-vds`

**Value:** -30 · **Unit:** `V`

**Conditions:** drain-source absolute maximum, Ta=25 degC

**Verdict:** PASS - primary-source confirmed · **Provenance:** PRIMARY-SPEC

**Evidence:** [src-umw-ao3401a: page 1 absolute maximum table row VDS](#src-umw-ao3401a)

</EvidenceFact>
```

The example's source target is supplied by the source entry on a complete page.
Keep a scalar unchanged. For a structured value, render every key/value pair using
the existing `factValueEntries` / `entryValue` behavior; never stringify it into a
new summary. Preserve `NONE` units. For a calculated locator that lacks the source
ID, use `**Evidence:** [source ID](#source-id) — exact CALCULATED locator`; the
separate Calculation dependencies block retains expression and every dependency.

These generic snippets illustrate the other selected structures. Words such as
“recorded reason” stand for evidence supplied by the renderer, not replacement
wording. Pair heading-derived links with the original stable evidence anchors.

```mdx
## Coverage

### Domain name

<EvidenceAnchor id="cov-example" />

**Coverage ID:** `cov-example` · **Status:** OPEN

**Reason:** The exact recorded reason.

**Facts in this domain:**

- [fact-example](#fact-example)

**Blocked by:**

- [fact-example](#fact-example)

## Sources

### Exact document title

<EvidenceAnchor id="src-example" />

**Source ID:** `src-example` · **Authority:** MANUFACTURER_PRIMARY

| Field | Recorded value |
| --- | --- |
| Document number | Exact recorded number |
| Revision | Exact recorded revision |
| Document date | Exact recorded date |
| Retrieved | Exact retrieval date |
| Printed page | Exact printed label |

**Locator:** Exact source-level locator.

**Availability:** SOURCE UNAVAILABLE

**Document URL:** [https://example.invalid/document.pdf](https://example.invalid/document.pdf)
```

Use the existing explicit no-facts / no-blocker explanation for an open coverage
domain with no recorded blocker. Do not invent a blocker or omit the reason.
For a source with no publishable URL, retain “no link is published for this
source”. Availability and URL are consecutive paragraphs with no intervening
metadata. A valid URL must never be rendered as proof of availability.

Catalog entries reuse the Identity table pattern, followed by `**Placements:**`
with every board/refdes, `**Fit:**`, separate evidence-state labels and existing
part-named links. Calculation dependencies reuse the linked fact paragraph,
`**Expression:**` and a normal `**Depends on:**` list. Interactions and rules reuse
normal labeled paragraphs and the shared fact-reference builder. Landing, counts,
navigation, pins and legends retain their documented Markdown examples in the
current generated pages; no new authoring syntax is required.

## Documents and package retains the accepted API and behavior

The generator emits `## Documents and package` as a real Markdown heading, then
the legacy `<EvidenceAnchor id="component-references-heading" />`, then the
existing `<ComponentReferences descriptor="…" />`. Preserve the historical
`#component-references` target used by the footprint-null fallback as an alias
where that branch exists. The descriptor remains its validated v1 hex encoding;
do not widen it into a container for facts or other ordinary prose.

`ComponentReferences` stops emitting its internal h2 and duplicate heading ID.
It renders the document label/title on the left and authority/availability aligned
on the right when space permits; narrow content stacks them. A second row pairs
footprint and model preview stages with equal stage heights and aligned tops,
stacking at narrow **content** widths. Keep Datasheet PDF / Specification PDF /
Mechanical drawing PDF labels truthful, all selected metadata, package identity
and caveat, and no-JS/error explanations on the page. The footprint-null branch
retains its explicit explanation and source information; it must not manufacture
preview geometry. Selected source fields remain readable in Markdown/LLM output
through ordinary generated content, not only the encoded descriptor.

Enlargement contains only media and an icon close button. Accessible title,
labels and instructions may be nonvisual. No visible title, filename, caption,
status prose, caveat, instruction or “Close” text inside either dialog. Preserve
icon-close, Escape, backdrop dismissal, focus trapping/return, scroll lock, a
single active modal, repeated-open/navigation cleanup, bounded viewport and
initial portrait model fit. Thumbnail/enlarge interaction must open the dialog
after hydration, rather than navigate to raw SVG. Keep useful static fallback
links on the page when JavaScript or an asset fails.

## SSR, semantics and the existing publication boundary are mandatory

- Register `EvidenceFact` in `src/chrome-bindings.tsx` through `mdxExtras` and add
  exactly `EvidenceFact: []` to `ALLOWED_COMPONENT_ATTRIBUTES`. Implementation
  file: `ui/evidence-fact.tsx`; public props: `children?: ComponentChildren`.
  Use `containerComponent("EvidenceFact", {}, children)` in the renderer. No
  evidence text in JSX attributes, unsafe string interpolation, raw HTML or
  serialization bypass. Do not weaken attribute/delimiter guards.
- Ordinary Markdown h2/h3/h4 nodes own section names and native desktop/mobile
  TOC discovery. No major heading hidden inside an SSR component. Existing
  evidence anchors stay exactly once at their original claim; keep all existing
  anchor destinations and heading links, including class/source/map headings.
- All facts, conditions, verdicts, refusals, coverage gaps, source metadata,
  dependencies and exact IDs must be visible by default in the page, present
  without JavaScript, and readable in Markdown and LLM exports. Pin assignments
  alone may remain in native details; they still exist in all static outputs.
- `EvidenceFact` has no client bundle or hydration dependency. Actual preview
  islands retain static route-import reachability; `mdxExtras` alone does not
  guarantee island hydration. Preserve the package route/chrome bindings.
- Reuse scoped project styles and existing package tokens. Correct intrinsic
  sizing/wrapping at the overflowing component; never mask missing text with
  global `overflow-x: hidden`, clipping, line clamping, tiny fonts or truncation.
  Long IDs/URLs/conditions must wrap. Dense comparison tables may scroll locally
  using the existing keyboard-focusable `EvidenceTable`, with visible focus.
- Keep original data order, field values and units, value keys, class/provenance
  distinctions, availability/authority, conditions, exact verdict/refusal,
  expressions/dependency edges, source locators, relation/placement/fit state,
  coverage reasons/blockers, legends and agent-resource links. Preserve every
  existing empty-state sentence/branch, including calculation/evidence-chain
  section-presence rules. No inferred approval, severity or aggregate score.
- All 35 currently published records, their full catalog entries, indexes,
  landing and integration pages use the selected common renderers. No MPN/route
  special case. Future public records and empty/adversarial fixtures use the same
  behavior. Publication matrices, preflight decisions and denied fields stay
  unchanged. Regenerate production MDX; never hand-edit it.
- Preserve frontmatter title/description identity terms (MPN, LCSC, board/refdes,
  record and integration rule IDs). Verify search against its existing
  300-character body excerpt behavior; adding full-body search is out of scope.

## Concrete routes and generic cases define the verification set

All record paths below start at `/docs/components/records/`. This selection was
checked against the generated baseline and the central inventory; examples do
not authorize changing component evidence.

| Route | Shape to inspect |
| --- | --- |
| `umw-ao3401a/` | Accepted reference, exact locators, repeated source citations, record SOURCE UNAVAILABLE alongside selected source AVAILABLE, open coverage with no blockers. |
| `c14663/` | CC0603KRX7R9BB104; nine placements across Board P/L, long identifiers and conditions. |
| `rlp25feer200/` | Subordinate RLP25FEER200; parent link, calculated fact values, expression and cross-record input links. |
| `stusb4500qtr/` | Dense IC: 23 facts; long coverage/repeated citations, multiple unavailable ST sources and pin lookup. |
| `ap63203wu-7/` | Largest current fact count: 27; several fact classes, calculations and long source text. |
| `c529334/` | STM32G031F8P6; retained locators with unavailable evidence must stay visibly qualified. |
| `c492404/` | Subordinate hand-fit/DNP SWD header, placements in two board contexts and its published pin map. |
| `/docs/components/integration/#rule-usb-pd-nvm-load-switch` | Exact refusal before arithmetic, conditioned expressions and cross-record links. |
| `/docs/components/integration/#rule-evidence-chain` | Ordered stages with gaps; no implication of board approval. |
| `/docs/components/`, `/docs/components/catalog/`, `/docs/components/records/` | Counts, complete comparison index, all full entries and parent/subordinate order. |

Generic public-model fixtures additionally cover structured/empty values,
calculated facts with missing expression or no inputs, empty sections, unavailable
source with present or absent URL, absent parent/owner, zero placement, multiple pin maps, open domain
without blockers, multiple source IDs with identical titles, long hostile text
(`{`, `<`, pipes and quotes), and future records. Use existing fixture builders;
do not manufacture private/electrical evidence in production bundles.

For #137/#138, focused SSR/serialization and renderer tests assert exact retained
content/links and allow-list behavior. Corpus tests compare all public claim
fields and anchor destinations against the baseline, not just page counts or a
single AO3401A snapshot. Run type/generator checks without a worker browser build.

For #140, one guarded production build/browser pass checks the routes above at
1600×1000 and 390×844, both themes, actual package breakpoints and content widths
with sidebar/TOC open. Inspect screenshots, not only DOM geometry. Confirm native
TOC headings/targets (especially Documents and package), mobile On this page,
search identifiers, keyboard/local table scrolling, no page overflow, source and
dependency navigation, static/LLM completeness and all dialog behaviors above.
Any synthetic long/empty/asset-error route belongs only to the verification
fixture surface, never the generated production corpus.

## Ownership keeps implementation lanes independent

- **#137:** add `EvidenceFact`, safe allow-list/binding support, scoped fact styles
  and focused SSR/safety tests. No coverage/source widget. Existing table/details
  behavior remains available for the selected uses.
- **#138:** apply this structure in all renderers and regenerate the entire
  corpus; own the external Documents and package Markdown heading/legacy anchors
  and static claim text. Preserve the references descriptor API.
- **#139:** own `ComponentReferences` layout/internal-heading removal and the
  existing footprint/model dialog behavior. Do not edit generator-owned pages.
- **#140:** verify integrated corpus parity and actual native UX, including the
  new facts and Markdown coverage/source decisions as well as accepted previews.

## Native screenshots support the fact boundary; final spacing still needs verification

On 2026-09-25 the manager captured the actual built native routes at 1600×1000
and 390×844 under the shared heavy guard. Local review artifacts are under
`/home/takazudo/repos/circuits/zudo-led-lamp/.git/x-wt-135-shots/` (not committed):

- `native-ao-{coverage,facts,sources}-{desktop,mobile}.png`: current AO3401A.
- `native-dense-{coverage,facts,sources}-{desktop,mobile}.png`: current STUSB4500.
- `probe-{ao,dense}-facts-{desktop,mobile}.png`: temporary DOM/CSS treatment B in
  those same native routes; no prototype code was committed.

Direct visual review of AO desktop/mobile facts and the AO/dense mobile probe
confirms the design problem: desktop table columns split IDs and citations into
short fragments, and mobile initially exposes only the leading table columns.
The vertical treatment gives conditions and locators the content width while
keeping each claim together. The manager also measured no document horizontal
overflow at 390 for the probe. This supports `EvidenceFact`; its final Markdown
children keep explicit labels that the illustrative probe did not all show.

Direct review of native AO coverage/mobile and sources/desktop confirms repeated
metadata consumes substantial height. The coverage/source alternatives above
were assessed structurally against this real route; their selected Markdown
rearrangements have not yet been rendered as implementation. They require the
focused integrated screenshots in #140. No coverage/source component is justified
by the observed content shapes.

The dense mobile DOM probe shows a class/gloss/first-fact spacing overlap. It is
not a passed final UI: #137 must keep normal block flow around the primitive and
#140 must inspect dense class headings, glosses and adjacent fact boundaries for
overlap at narrow widths. The initial CLI baseline also appeared to overflow;
the manager's later native CDP comparison is the more useful design capture, and
the production pass must measure overflow independently rather than infer success
from either image. Dark-theme and media behavior remain governed by the accepted
issue references and require integrated verification. These observations assess
the presentation decision, not production SSR, export or interaction parity.
