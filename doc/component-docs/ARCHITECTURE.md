# Component knowledge docs — V1 architecture contract

Status: **locked** (epic #57, issue #58, Wave 1)
Scope: project-local code under `doc/`. Not a framework feature, not an installable package, not a change to any other repository.

This document is the contract the rest of epic #57 codes against. Where it names a
file, a command or a rule, that is the decision — not a suggestion. Anything it
does not decide is genuinely open.

---

## 1. What this is

The repository already holds validated component evidence as structured JSON under
`.claude/skills/`. That data is the **only** source of technical truth. This feature
adds a **projection** of it into human documentation. It never re-states a fact in
prose, never repairs a value, and never synthesises a component-wide verdict.

Corpus as of this contract: **13 owner bundles, 32 records (23 standalone, 9
subordinate), 81 sources, 369 facts, 109 coverage domains, 50 interactions, 32
routes, 33 pin maps, 140 pins**, plus **6 cross-component rules** in
`circuit-spec-integration`; 29 inventory lines fitted, 3 DNP/hand-fit.
These figures are asserted in code (`adapters/circuit/selection.ts`) and a mismatch
fails the build.

## 2. Directory ownership

| Path | Owner | Rule |
|---|---|---|
| `doc/component-docs/` | this feature | all generator code, tests, this document |
| `doc/src/content/docs/components/` | **generator, exclusively** | never hand-edit; every file is rewritten from evidence |
| `doc/component-docs/preflight.json` | generator | committed, deterministic, reviewable |
| `doc/src/chrome-bindings.tsx` | this feature | MDX component registry |
| `doc/src/styles/global.css` | site | an appended presentation block for the generated pages (`.zld-evidence-anchor`, plus the `.zld-evidence-table` scroll container and its long-token wrapping, added by #62) |
| `doc/zfb.config.ts` | site | `chromeBindingsModule`, `docHistoryExclude` |
| `doc/pages/**` | **package** | never modified — the proof below does not need it |
| `doc/src/content/docs/claude*/` | zudo-doc generator | never hand-edited by this feature |
| `.claude/skills/**` | evidence owners | **read-only** to this feature |

### Module layout under `doc/component-docs/`

```
core/                       provider-neutral; no Python, no `.claude`, no fs paths
  errors.ts                 ErrorCode union + ComponentDocsError + fail()
  text.ts                   SafeText brand + safeText() sanitiser
  url.ts                    SafeUrl brand + classifyUrl() policy
  ids.ts                    Slug/Anchor brands, recordSlug(), anchor(), byCodeUnit()
  view-model.ts             the public view model TYPES (frozen here)
  publication.ts            FieldKey union, PublicationMatrix, PublicationPolicy, PreflightReport
  mdx.ts                    mdast builders + serializeBody() + assertMdxSafe()
  page.ts                   frontmatter + buildPage() + generated-file marker
  emit.ts                   owned-tree write / prune / diff, path containment
  adapter.ts                ComponentDataAdapter + ValidationRunner interfaces
  pipeline.ts               the one generation path
  render/landing.ts         /docs/components/          (Wave 1)
  render/catalog.ts         /docs/components/catalog/  (#60)
  render/record.ts          /docs/components/records/… (#60)
  render/shared.ts          routes, glosses and orderings both pages share (#60)
  render/integration.ts     /docs/components/integration/ (#63)
adapters/circuit/           this repository's evidence provider
  paths.ts                  every path the adapter may touch
  validate.ts               python3 validate.py subprocess
  read.ts                   contained, symlink-refusing JSON reads
  selection.ts              committed instance allowlist (32 records / 81 sources)
  matrix.ts                 committed per-field decisions
  integration.ts            cross-component rules: shapes, projection, closure
  evidence.ts               provider shapes, bundle reads, the joins (pure)
  index.ts                  the adapter itself; `projectIndex` is the pure projection
cli/                        run.ts (shared body), generate.ts, check.ts, watch.ts
ui/evidence-anchor.tsx      the one MDX component the generator emits
tests/                      node:test suites, plus two fixture modules:
                            fixtures.ts (a finished PublicViewModel, for the
                            renderers) and provider-fixtures.ts (raw provider
                            JSON, for the adapter and the denied-field canaries)
```

`evidence.ts` and `projectIndex` are pure functions over parsed JSON, so every
join rule and every publication rule is provable against a fixture corpus with no
filesystem, no subprocess and no edit to the read-only evidence tree.

The dependency direction is one-way: `adapters/circuit/**` imports from `core/**`;
`core/**` imports nothing from `adapters/**`. A second provider means a second
adapter directory and no change under `core/`.

## 3. Build and watch seam — package scripts, not a host plugin

`doc/package.json`:

| Script | Command | Purpose |
|---|---|---|
| `generate:components` | `node --experimental-strip-types component-docs/cli/generate.ts` | validate → project → render → emit |
| `check:components` | `node --experimental-strip-types component-docs/cli/check.ts` | dry-run; nonzero on drift |
| `scan:artifacts` | `node --experimental-strip-types component-docs/cli/scan-artifacts.ts` | denied-value scan of the BUILT site (§6.1) |
| `scan:doc-skill` | `bash component-docs/scripts/scan-doc-skill.sh` | same scan over an isolated docs-to-agent corpus |
| `test:components` | `node --experimental-strip-types --test "component-docs/tests/*.test.ts"` | unit + integration |
| `dev:components` | `… component-docs/cli/generate.ts --watch` | debounced regeneration |
| `build` | `pnpm generate:components && zfb build` | generation precedes the content snapshot |
| `dev` | `pnpm generate:components && run-p dev:zfb dev:history dev:components` | seeded, then watched |
| `check` | `zfb check` (unchanged) | typechecks `component-docs/**` via `tsconfig.json` `include` |
| `b4push` | `pnpm check && pnpm test:components && pnpm build && pnpm check:components && pnpm scan:artifacts && pnpm scan:doc-skill` | local gate |

**Why not a `zfb` plugin.** `@takazudo/zfb/plugins` does expose a supported
composition seam (`setup` / `preBuild` / `postBuild` / `devMiddleware` /
`previewMiddleware`), and `preBuild` is documented to run before the build. It was
rejected anyway:

- `preBuild` does not fire under `zfb preview`, so `preview` and `build` would
  disagree about who generates.
- A plugin cannot gate `pnpm check` or `pnpm test:components`, so the ordering
  guarantee would cover one command out of four.
- Script sequencing makes the ordering a *process* boundary — generation has
  finished and exited before `zfb` starts — instead of an assumption about an
  internal build-stage order that a future zfb release could re-order.

Proven from a clean checkout: `rm -rf doc/src/content/docs/components && pnpm build`
recreates the tree and builds 52 pages.

**Watch behaviour** (`cli/watch.ts`):

- watches `.claude/skills/` recursively, `.json` files only;
- **never** watches `doc/src/content/docs/components/` — the generator's own output
  cannot wake the generator (zfb's content watcher sees the write and refreshes the
  browser, which is the intended path);
- **debounced** (150 ms) so a `git checkout` touching thirteen bundles is one run;
- **serialized** — at most one generation in flight; triggers arriving mid-run cause
  exactly one follow-up run, never an overlapping second writer;
- a failed run reports and keeps watching (an editor save can leave JSON briefly
  unparsable); it does not take the dev server down.

The scheduler is exported separately from the filesystem watcher and is unit-tested
without touching the disk.

### TypeScript execution

Generator code runs under **Node's native type stripping**, not a bundler and not a
new dev dependency. This constrains how it may be written:

- **relative imports inside `component-docs/` must carry the `.ts` extension** —
  there is no resolution rewriting (`tsconfig.json` already sets
  `allowImportingTsExtensions`, `verbatimModuleSyntax`, `isolatedModules`);
- **no `enum`, no `namespace`, no parameter properties, no `declare` merging** —
  type stripping erases annotations, it does not transform;
- type-only imports must use `import type`.

`--experimental-strip-types` is passed explicitly: Node 22.18+ and Node 24 strip
types unflagged, older 22.x needs the flag, and the flag is accepted (harmless) on
both. CI pins `node-version: 22`.

## 4. Validation — one validator, in Python, fatal on failure

`adapters/circuit/validate.ts` runs

```
python3 <repo>/.claude/skills/component-spec-audit/scripts/validate.py
```

as an **argument array** (`execFile`, no shell, no interpolation), cwd = repository
root, before any evidence is read. Nonzero exit aborts generation with
`VALIDATION_FAILED`, carrying the command, exit code and both streams. `--online` is
never passed: generation must work offline, and online mode mutates retained
evidence.

- **Python is pinned to >= 3.12**, matching `actions/setup-python@v5` with
  `python-version: '3.12'` in `.github/workflows/component-spec-skills.yml`. A
  too-old or missing interpreter is reported as a validation failure, not a crash.
  `COMPONENT_DOCS_PYTHON` overrides the interpreter.
- The core knows none of this. `core/adapter.ts` declares
  `ValidationRunner = () => Promise<ValidationOutcome>` — a callback. No string
  command, no `.claude`, no Python anywhere under `core/`.
- **No component validation is reimplemented in TypeScript.** The provider shapes in
  `adapters/circuit/index.ts` are narrow structural reads that make the joins
  type-checked; they do not restate a single contract rule. A weaker second
  validator that disagreed with the Python one would be worse than none.
- The Python unit tests (`test_validate.py`) and the cross-component forward tests
  (`check_forward_tests.py`) stay owned by `component-spec-skills.yml`. They are not
  duplicated into `test:components`.

## 5. View model and adapter seam

`core/view-model.ts` freezes the public shape. `VIEW_MODEL_VERSION = 1`; an adapter
declares `supportedViewModelVersions` and the pipeline refuses to run on a mismatch,
so a core/adapter skew is a startup error rather than a subtly wrong page.

**v1 stays v1 for the whole of epic #57, including through incompatible shape
changes.** #59 both widened `PublicFact["value"]` and added a required
`PublicRecordIdentity.ownerSkill`; #63 added `calculations`, `evidenceChain` and
`ownerSkill` to `PublicIntegrationRule`. None of them bumped the number. That is
deliberate, and it is the one place the version rule is suspended: the core and
the only adapter are compiled together from one repository, so a skew between
them is a *compile* error long before the runtime check sees it, and package
extraction is explicitly deferred (§12). Nothing outside this repository has ever
consumed v1, so there is no consumer a bump could protect — it would only churn
`preflight.json` and imply a compatibility boundary that never existed. The
number becomes a real boundary the moment `core/**` is extracted; from then on,
the rule in the `VIEW_MODEL_VERSION` doc comment applies literally and any
incompatible change bumps it.

Population ownership:

| Field | Owner |
|---|---|
| `corpus`, `records[].identity` | Wave 1 (done) |
| `records[].aliases/sources/facts/coverage/interactions/pinMaps` | #59 (done) |
| `integration` | #63 (done) |

Rules the shape enforces:

- every published string is `SafeText`, every published URL is `SafeUrl` — both are
  branded types obtainable only through the sanitiser, so an unsanitised evidence
  string is a **compile error**, not a review finding;
- a fact `value` keeps its JSON shape so `42` renders as `42` and units/conditions
  stay separate fields;
- no file paths, no provider identifiers, no raw JSON blobs.

**`PublicRecordIdentity.ownerSkill`** was added in #59: the owner bundle's name
(`component-al8860mp-13`) is what lets a record page link back to its raw agent
resource at `/docs/claude-skills/<name>/`, and it is not derivable — 13 owners
cover 32 records and `component-project-passives` owns eleven of them.
`FIELD_KEYS` gained `record.ownerSkill` and the matrix publishes it; those bundle
routes are already on the live site, so it publishes a route rather than a new
fact.

**One shape change since Wave 1.** `PublicFact["value"]` was frozen as
`number | SafeText`. Three facts in the corpus record a distributor identity
binding as a JSON object (`{lcsc, manufacturer, mpn, variant}`), and #59 forbids
flattening a value into a string, so the union widened to
`number | SafeText | readonly PublicFactValueEntry[]` (`{key, value}` pairs,
sorted by key with `byCodeUnit`). No new `FieldKey`: the leaf is still
`fact.value` and `matrix.ts` is untouched. A boolean, array or null value is a
fatal `ADAPTER_CONTRACT` — there is no fourth shape to guess at.

### Identity, ordering, errors

- **Record slug** = record ID minus the `rec-` prefix (`rec-al8860mp-13` →
  `al8860mp-13`). Verified unique across all 32 records. Derived from the ID and
  never from the MPN, because MPNs contain commas and slashes (`PESD24VS1UB,115`).
  A slug that does not match `^[a-z][a-z0-9]*(-[a-z0-9]+)*$`, or that hits the
  reserved list (`index`, `404`, `assets`, `api`, `search`, `sitemap`, `robots`,
  `llms`, `con`, `prn`, `aux`, `nul`, …), is a fatal `IDENTITY_COLLISION`.
  Note for #60/#61: several records are named after their LCSC code, so their route
  reads `/docs/components/records/c13585/` rather than a part number. That is
  intentional — the slug follows the record ID, which is what stays stable. The page
  **title** is the MPN, and `alias.mpn` / `alias.lcsc` feed the search index, so
  exact-MPN discovery does not depend on the slug.
- **Anchors** are provider IDs verbatim (`#fact-al8860-vin-absolute-max`,
  `#src-al8860-ds39014`). They are emitted by `<EvidenceAnchor id="…" />` rather
  than derived from heading text, so rewording a heading never breaks an external
  deep link. Uniqueness is asserted every run, **per page** — an anchor becomes an
  HTML id, and that is the document-scoped invariant. Record-scoped nodes
  (sources, facts, coverage, pin maps) each carry a single `recordId` and so stay
  globally unique anyway; interactions legitimately repeat across the pages of the
  records they name, and a separate assertion proves one anchor never denotes two
  different interactions.
- **Ordering** is inventory-line order, each standalone record immediately followed
  by its own subordinates. The inventory is generated identity truth, so its order
  is already stable. Sorting is `byCodeUnit`, never `localeCompare` — ICU-dependent
  ordering would make generated bytes machine-dependent and trip CI's freshness
  check. Within a record, sources and facts follow the manifest's own order, which
  is curated (primary source first); coverage, pin maps and routes follow file
  order.
- **An interaction is published on every record it names.** Six of the 50
  interactions name a standalone record *and* its subordinates, so 50 interactions
  land on 59 record pages; a reader on `rec-fxl0630-330-m` has to see that it
  participates in the AL8860 power stage. This is why anchor uniqueness is scoped
  per page (see above): the same `#int-…` fragment appears on up to four pages,
  each time denoting the same interaction, which is what an HTML id has to mean.
- **Selection is closed under published links.** A published record whose source is
  unselected, a published fact whose dependency is on an unpublished record, a
  published interaction naming an unpublished record, and an integration rule
  naming an unpublished record or fact are each a fatal `STALE_SELECTION`.
  Dropping the evidence instead would publish an unprovenanced number or a dead
  link.
- **Integration rules are NOT instance-selected.** They live in one file outside
  every owner bundle and each spans records rather than belonging to one, so
  there is no rule allowlist and no per-rule link opt-in. What is asserted is
  `expect.integrationRules`, alongside the record and source counts: a rule
  appearing or vanishing changes what the integration page claims about the
  whole design and must be a reviewed change.
- **Errors** are `ComponentDocsError` with a closed `ErrorCode` union:
  `VALIDATION_FAILED`, `ADAPTER_CONTRACT`, `PATH_CONTAINMENT`, `STALE_SELECTION`,
  `PUBLICATION_POLICY`, `UNSAFE_VALUE`, `UNSAFE_MDX`, `IDENTITY_COLLISION`,
  `GENERATED_DRIFT`. Every failure is fail-closed: there is no "skip the bad record
  and carry on" path.

## 6. Publication — default-zero, three gates

A value publishes only if it clears **all three**:

1. **Instance** — its record ID (and for a source, its source ID) is listed in
   `adapters/circuit/selection.ts`.
2. **Field** — its `FieldKey` is `PUBLISH` in `adapters/circuit/matrix.ts`.
3. **Value** — it survives `safeText()` / `classifyUrl()`.

Default-zero is structural, not conventional:

- `PublicationMatrix` is `Readonly<Record<FieldKey, FieldDecision>>`. Adding a leaf
  to the view model without recording a decision **does not compile**. The default
  for anything new is "the build stops until a human decides".
- `InstanceSelection` is an allowlist. An unlisted instance is never read. A listed
  instance the provider does not have is a fatal `STALE_SELECTION`, as is a change
  in `expect.records` / `expect.sources`. Adding a component to the project
  therefore does **not** silently add a public page.
- `linkableSourceIds` is a separate, narrower opt-in: selecting a source publishes
  its title, revision, locator and availability; it does not by itself publish an
  outbound link.
- Repository visibility is irrelevant to all three gates.

### V1 field decisions

`DENY` (8 of 81 keys):

| Field | Why |
|---|---|
| `source.sha256` | retained-copy integrity machinery; publishing a hash invites redistributing the hashed artifact |
| `source.evidenceExtract` | verbatim vendor-datasheet quotations, retained for audit and not licensed for republication |
| `source.alternateAuthoritativeUrl` | mirrors and retrieval fallbacks, not the citation |
| `source.physicalPdfPageIndex` | meaningless without the PDF in hand, and V1 publishes no PDFs; `printedPageLabel` is the reader-usable one |
| `routing.positivePrompts`, `routing.negativePrompts` | agent-steering text that reads as instructions; a prompt-injection surface once mirrored into `llms.txt` and the search index |
| `pinMap.reviewedBy` | internal review state ("pending manager independent review") that reads as a quality claim out of context |
| `asset.binary` | V1 publishes no PDFs and no skill assets; the key exists so the decision is recorded rather than merely unimplemented |

Everything else is `PUBLISH`, including the full fact shape (value, unit, class,
conditions, provenance, verdict, locator, `dependsOn`, expression), coverage
`reason` and `blockingFactIds`, and every part of an integration rule.

**The ten integration keys #63 added are all `PUBLISH`, and the reasoning is the
same for each.** A cross-component rule's whole point is its `refusal` — the
exact statement of what may NOT be concluded — and the conditioned calculations
and the source-to-bench evidence chain are what the refusal is about. Publishing
a rule while withholding any of them produces the one page this feature must
never produce: conditions, arithmetic and a verdict, with nothing saying what
none of it proves. The evidence chain in particular is mostly `OPEN`, and
withholding it would leave the settled upstream stages on the page implying a
downstream closure that has not happened. Nothing in the group names a reviewer,
a ticket or a machine path — the `pinMap.reviewedBy` reasoning does not apply.

### URL policy

`classifyUrl` allows **only** absolute `http:`/`https:` with a host and no embedded
credentials. Denied with a recorded reason: `javascript:`, `data:`, `file:`,
`vbscript:`, protocol-relative, bare hosts, absolute machine paths, Windows paths,
embedded whitespace or control characters, and anything over 2000 characters. The
original string is published, never `URL.href` — normalisation would change a URL
the evidence record locked a hash against.

An allowed URL still needs its source in `linkableSourceIds`. Because
`source.availability` is `PUBLISH` whenever a URL is, a `SOURCE UNAVAILABLE`
document always renders with its unavailability visible.

### Preflight report

`doc/component-docs/preflight.json` is generated, committed and deterministic (no
timestamps, every list sorted). It lists selected record slugs, selected source IDs,
the linkable count, every field with its decision and how many values were **emitted
vs withheld**, every URL considered with its decision and reason, and the published
counts. A URL's **string** is recorded only when the decision is `ALLOW` — a
denial already carries its reason and its source ID, and the report is a committed
file, so echoing a link policy just refused to republish would put it in the
repository anyway. Counts come from what the run actually did, not from what the matrix
declares — so a field marked `PUBLISH` that nothing reads shows `emitted: 0` and the
drift is visible. `check:components` compares it byte-for-byte.

### 6.1 Artifact-level proof (`scan:artifacts`, #64)

Everything above proves the **view model** is clean. It cannot prove the built
site is, because between the view model and `dist/` sit an MDX compiler, an HTML
minifier, a search indexer and an `llms.txt` writer — none of which this feature
owns. `scan:artifacts` scans the bytes.

Canaries are harvested from the **raw** `.claude/skills/**` JSON, not through the
adapter's provider types: those types name only the fields the projection
consumes, so `sha256`, `evidence_extract` and `reviewed_by` are absent from them
by design and a harvest through them would find nothing. `DENIED_PROVIDER_KEYS`
in `adapters/circuit/canaries.ts` lists the key **names**, which also covers the
retrieval bookkeeping (`request_headers`, `refresh_policy`, …) that has no
`FieldKey` for the matrix to deny.

**Comparison is on whole values with output escaping normalised, never on raw
substrings.** Four false-positive modes are live in this corpus, and a scanner
that hits any of them fails on clean builds — after which it gets suppressed,
and a suppressed canary masks the leak it exists to catch:

1. a denied value that is a **substring of a published one** (an alternate URL
   that is a prefix of the citation URL) — subtracted before searching;
2. **output escaping mutates published values** (`…%E7%AE%A1\&type2=…`) — both
   sides fold character references, backslashes and whitespace through
   `normalizeForScan`. Backslashes are **deleted** rather than unescaped,
   because one level of unescaping cannot tell a literal backslash from an
   escape and the canary would stop matching its own leak;
3. **degenerate values** — a placeholder `sha256` of 64 zeros matches any zero
   run in any file (it hit a `.wasm`). Single-character repeats and all-digit
   values are not canaries, and binary assets are counted but never
   text-searched. `source.physicalPdfPageIndex` is a small integer, so it has no
   value-level canary at all; its absence is proven structurally, by the matrix,
   the missing view-model leaf and `emitted: 0` in preflight;
4. a denied value **published by a channel this feature does not own** — four
   routing prompts are in the hand-authored narrative docs and in the
   `claudeResources` mirror of each `SKILL.md`.

Mode 4 is why the scan has **two tiers**. Artifacts this feature writes — the
generated MDX, `preflight.json`, `dist/docs/components/**`, and the component
slices of the search index and `llms.txt` — are scanned with the **full** canary
set, where any hit is unambiguously this generator's. The rest of `dist/` is
scanned with the canaries no other content source publishes, re-derived from the
content tree every run rather than kept as a list of excused strings.

The scan fails closed on three things, not one: a hit, too few canaries, or too
few artifacts. Failure messages name the artifact and the denied **field**, never
the value — the message lands in CI logs, and reprinting a denied value to prove
it leaked would publish it again somewhere with a longer memory.

**Positive controls run per surface**, so an empty projection cannot pass: an
all-empty site satisfies every negative scan. Full-text surfaces carry all 18
(identity, unit, conditions, provenance, verdict, locator, coverage status and
reason, source title/availability/locator/link, and one `EvidenceDetails`-wrapped
pin row — a container may change how content is *presented*, never whether it
exists). Discovery surfaces carry the 4 a reader searches by; the search index
truncates `body` to 300 characters and `llms.txt` holds only titles and
descriptions, so neither can be expected to hold a locator. `llms-full.txt`
carries the **full** set, because an agent reading it instead of the pages must
not silently lose the pin assignments.

Also asserted against the built site: no hydration payload carries an
evidence-model key (published identifiers *do* legitimately reach `data-props`
through page descriptions and heading text — what must never be hydrated is the
evidence graph); no deploy artifact matches a credential shape; `sitemap.xml`
stays an empty `urlset`; one built page per record and no page the projection did
not produce; every record present in `search-index.json`.

**The docs-to-agent scan (`scan:doc-skill`) runs `setup:doc-skill` with `HOME`
pointed at a throwaway directory and verifies afterwards that the real
`$HOME/.claude/skills` and `$HOME/.codex/skills` were not touched.** It never
passes `--target auto`, because auto probes `$HOME`. The corpus is assembled in
the sandbox rather than read through the skill's own `docs` symlink, which
resolves to the main worktree by design.

## 7. Safe generation — three layers

1. **Build.** Content is constructed only through the builders in `core/mdx.ts`
   (`text`, `code`, `strong`, `link`, `paragraph`, `heading`, `bulletList`, `table`,
   `component`, `evidenceAnchor`, `space`). They accept `SafeText`/`SafeUrl` and a
   closed node vocabulary. There is no raw-node builder, so a caller cannot inject
   markup even deliberately.
2. **Serialize.** `mdast-util-to-markdown` with `mdast-util-mdx` and
   `mdast-util-gfm-table`. The MDX extension is what escapes `{` — plain markdown
   does not care about braces, so without it every evidence string containing `{`
   is a live MDX expression. Two additional `unsafe` rules cover constructs no
   bundled table knows about: a line-leading `:::` (this site enables
   `remark-directive`) and a line-leading `import`/`export` (MDX ESM, escaped as a
   numeric character reference since backslash cannot escape a letter; ordinary
   words like "importantly" are untouched).
3. **Guard.** `assertMdxSafe` re-reads the **final** body text and fails the build
   on: a line-leading `import`/`export`, a line-leading `:::`, a `---` fence line,
   an HTML comment, any `{` or `<` not escaped by an **odd** number of preceding
   backslashes (so `\\<` is correctly treated as live), any JSX name outside
   `ALLOWED_COMPONENT_ATTRIBUTES`, any attribute not listed **for that
   component**, and any attribute value outside `^[a-z0-9][a-z0-9-]*$`.

**The HTML-comment check is deliberately not escape-aware** — it refuses `\<!--`
too, and that is the settled decision (#64), not an oversight #60 worked around.
MDX has no HTML comment syntax: `<!--` is a *parse error* there rather than a
comment, so unlike `\<` it has no well-defined inert form, and accepting the
escaped spelling would mean betting on backslash handling staying identical
across future remark/MDX majors — which is precisely where comment handling has
moved before. The cost is a build that stops with a file, a line and a reason, on
a corpus where nothing triggers it; the remedy is an evidence decision by the
evidence owner. The alternative failure — a page whose meaning depends on the
compiler version — is silent. **Relaxing it is a publication decision, not a
refactor.**

Consequences that downstream code must not weaken:

- **Evidence text never reaches a JSX attribute.** Attribute values are slugs and
  IDs only. If a renderer needs evidence inside a component, it passes it as
  *children* (escaped text), never as a prop.
- **Frontmatter** is a closed key set (`title`, `description`, `sidebar_position`)
  with `JSON.stringify`d values. YAML 1.2 is a JSON superset, so a JSON string is
  always a valid double-quoted YAML scalar — that is the entire escaping story for
  the header, and an evidence string cannot terminate the block or introduce a key.
- **No evidence in hydration data.** Pages are markdown rendered server-side. The
  one MDX component is SSR-only and not an island. No generated data module is
  imported by `chrome-bindings.tsx` or by any client entry, so no evidence graph —
  raw or projected — reaches a browser JS asset. Static HTML carries the complete
  human reference; JavaScript may enhance but is never required.
- **Text sanitisation is destructive-free.** `safeText` NFC-normalises (so bytes are
  machine-independent) and then **rejects** rather than strips: C0/C1 controls, bidi
  overrides and invisible formatting (Trojan Source, CVE-2021-42574), lone
  surrogates, over-long values. Silent stripping would let a mutated evidence string
  publish as a different-looking claim.

## 8. Generated-tree ownership and cleanup

`doc/src/content/docs/components/` is written by `core/emit.ts` and nothing else.

- Every write path is checked with `assertContained` — segment-wise, not string
  prefix, so `/a/bc` is not inside `/a/b`.
- **No `rm -rf` of the tree.** Emit writes this run's files, then removes only
  leftovers that (a) live under the owned root, (b) end in `.mdx`, and (c) carry the
  generated marker (`# GENERATED by doc/component-docs …`, a YAML comment inside the
  frontmatter block — MDX has no `<!-- -->` syntax, and a frontmatter *key* would
  surface in page metadata).
- A file under the owned root **without** the marker is a fatal `PATH_CONTAINMENT`
  naming the path — hand-authored content in a generated tree is reported, never
  destroyed.
- A symlink anywhere in the tree is fatal. Provider reads likewise walk from
  `.claude/skills/` down to the file rejecting a symlink at **every** step, not just
  the leaf.
- Emit is idempotent: unchanged files are not rewritten, so mtimes stay stable and
  a second run reports `0 written`.

Nothing outside that tree is ever deleted, and no hand-authored content anywhere is
touched.

## 9. Routes, navigation, lifecycle

| Route | Source | Wave |
|---|---|---|
| `/docs/components/` | `render/landing.ts` → `index.mdx` | 1 (done) |
| `/docs/components/catalog/` | `render/catalog.ts` | #60 (done) |
| `/docs/components/records/<slug>/` | `render/record.ts` | #60 (done) |
| `/docs/components/integration/` | `render/integration.ts` | #63 (done) |

- **Header nav `Claude` → `Components` is #61's change**, not Wave 1's. Wave 1
  leaves `headerNav` untouched; the landing page is reachable via URL, sidebar,
  search and `llms.txt` already. When #61 makes the swap it must keep the raw agent
  routes (`/docs/claude-skills/…`, `/docs/claude-md/…`) reachable through reciprocal
  links, direct URLs and search — they stay generated by `claudeResources` either
  way.
- **Sitemap stays disabled.** `sitemap` is not set in `zfb.config.ts`; the
  package-owned `/sitemap.xml` route emits an empty `urlset`. Verified unchanged
  after this work. Enabling it is a separate, tested decision.
- **`docHistoryExclude: ["components", "components/**"]`** — generated pages carry
  their own provenance on the page; git history of generated MDX would show
  generator churn, not evidence history. Two patterns because the landing page's
  slug is `components`, not `components/index`.
- **MDX binding seam**: `chromeBindingsModule: "./src/chrome-bindings.tsx"` +
  `mdxExtras`. The package-owned doc-route stub already imports
  `virtual:zudo-doc-chrome-bindings` and spreads it into `createChrome`, so this
  registers MDX components **without editing `doc/pages/**`**. Proven: the built
  `dist/docs/components/index.html` contains
  `<span class="zld-evidence-anchor" id="components-corpus" …>` and the string
  `EvidenceAnchor` appears nowhere in the output.
  Bindings must stay SSR-presentational — the virtual re-export sits outside zfb's
  static-import scanner reachability graph, so a client island registered there is
  not guaranteed to hydrate.
- `ALLOWED_COMPONENT_ATTRIBUTES` in `core/mdx.ts` and the `mdxExtras` registry in
  `chrome-bindings.tsx` must be kept in sync. Every allowed name must either be
  registered there or ship globally from `@takazudo/zudo-doc` (`CategoryNav` does).
  A name with neither renders as literal text and silently swallows what it wraps.

## 10. CI

Wired by #65. Every gate below is **credential-free and mandatory**; a missing
Cloudflare credential skips the deploy, never a check.

`.github/workflows/pr-checks.yml`, in order:

| Step | Command | What only this step catches |
|---|---|---|
| Type check | `pnpm check` | — |
| Component generator tests | `pnpm test:components` | matrix / branded-type / adapter / renderer regressions, as assertions rather than as a diff |
| Build site | `pnpm build` | — (log captured, see below) |
| Hand-authored links resolve | `component-docs/scripts/check-zfb-link-warnings.sh` | a broken link in a **hand-authored** page — `pnpm build` exits 0 on those |
| Generated output is committed and up to date | `git add -N` + `git diff --exit-code` over `doc/src/content/docs` and `doc/component-docs/preflight.json` | committed `components/`, `claude*/` or `preflight.json` gone stale, **and** a generated page that was never committed at all |
| Component generation is deterministic | `pnpm check:components` | run-to-run nondeterminism, which would otherwise surface as an intermittent diff on an unrelated PR |
| Denied-value scan over the built site | `pnpm scan:artifacts` | a denied value surviving the MDX compiler, minifier, indexer or `llms.txt` writer |
| Denied-value scan over the docs-to-agent corpus | `pnpm scan:doc-skill` | the same, in what an agent reads back through `setup:doc-skill` |

Then the credential-gated tail: readiness → `.assetsignore` → preview deploy →
route smoke test → sticky comment.

This is `pnpm b4push` plus two steps b4push cannot express as one command — the
drift check needs a clean git index rather than a script, and the link check
needs the build's captured log. Their local equivalents:

```sh
pnpm b4push
git add --intent-to-add -A -- src/content/docs component-docs/preflight.json  # from doc/
git diff --exit-code -- src/content/docs component-docs/preflight.json
```

Five things about the sequence are load-bearing:

- Because `build` runs `generate:components` first, **generated component pages
  must be committed** or the drift step fails. That is the intended contract, and
  the step covers *all* of `doc/src/content/docs`, not just `components/` —
  editing `doc/CLAUDE.md` also regenerates `doc/src/content/docs/claude-md/doc.mdx`.
- That step is the drift authority for **everything** generated, and two details
  in it are not tidiness. `--intent-to-add` is what makes a *newly generated,
  never-committed* page visible — `git diff` alone cannot see untracked files, so
  a PR adding a record without committing its page would pass clean. And
  `preflight.json` has to be named explicitly: it sits outside
  `doc/src/content/docs`, and `build` rewrites it before any later step looks at
  it, so a stale committed copy is invisible to every other gate in the job.
  Both holes were verified by construction, not assumed.
- `build` + `check:components` are the two generation runs: the first writes the
  tree, the second re-projects from the evidence and proves the result
  byte-identical. Its job is **determinism**, not staleness — after `build` has
  run, the tree on disk is fresh by construction, so it cannot see a stale
  commit. That is the drift step's job, above.
- `scan:artifacts` must run **after** `build`, because `dist/` is its input; it
  has no skip path, so a missing `dist/` is a failure rather than a silent pass.
- `scan:doc-skill` runs `setup:doc-skill` with `HOME` pointed at a throwaway
  directory and then verifies the real `$HOME/.claude/skills` and
  `$HOME/.codex/skills` were untouched. Never writing to a user-global skill
  directory is a hard rule on a runner as much as on a laptop.

The paths filter needed nothing new: `doc/component-docs/**` is already covered
by `doc/**`, and `.claude/skills/**` plus `**/CLAUDE.md` are already listed.

### The link decision

`check-zfb-link-warnings.sh` exists because neither obvious option is right.
zfb's `linkValidation` resolves fragments against heading-derived anchors only,
so it cannot see an `<EvidenceAnchor>` id and every one of its warnings on a
generated page is false. `failOnBroken: true` would therefore fail every build;
ignoring the log would mean a genuinely broken hand-authored link never surfaces.
The count is not a gate either — `assertLinkIntegrity` runs on the **view model**
and is already fatal in the pipeline regardless of emitted markup, which is why
wrapping the evidence tables in a component moved the count 4324 → 2536 with no
change in link health.

So the script suppresses exactly one class — a same-page `#fragment` reported
against a file in the generated tree — and fails on everything else, including a
warning whose *shape* it does not recognise, so a zfb format change turns CI red
instead of silently disarming the gate. Locally:

```sh
pnpm build 2>&1 | tee /tmp/doc-build.log
bash component-docs/scripts/check-zfb-link-warnings.sh /tmp/doc-build.log
```

`.github/workflows/main-deploy.yml` runs the same gates minus the two
agent-corpus/link steps, all **before** the deploy: type check →
`test:components` → `build` → `git diff --exit-code` → `check:components` →
`scan:artifacts`. The drift steps close a real gap — the job used to build fresh
output without ever comparing it to what was committed, so a direct push carrying
stale generated pages deployed a rebuilt site while the repository claimed
otherwise. The link check is deliberately *not* there: after a merge, refusing to
publish over a broken link in prose is a worse outcome than publishing it, while
stale or leaky bytes genuinely must not ship.

`.github/workflows/component-spec-skills.yml` — the Python validator, its unit
tests, the forward tests, and schematic regen-idempotency. The four checks are
unchanged; #65 only pinned its two actions by SHA and added `timeout-minutes`
and `concurrency`.

All three workflows run `actions/setup-python@a26af69…` (v5) with
`python-version: '3.12'`, added to the two doc workflows by #58 because
`pnpm build` shells out to the validator — depending on whichever Python the
runner image happens to ship would let them silently disagree.

## 11. Direct dependencies added

Runtime (`dependencies`), all used by `core/mdx.ts`:

- `mdast-util-to-markdown` ^2.1.2 — the serializer
- `mdast-util-mdx` ^3.0.0 — MDX escaping (**the `{` escape**); without it every
  evidence brace is a live expression
- `mdast-util-gfm-table` ^2.0.0 — GFM table serialisation, including `|` escaping
  inside cells

Dev (`devDependencies`):

- `@types/mdast` ^4.0.4 — mdast node types

No test framework, no TS runner, no bundler plugin: `node:test` and Node's native
type stripping cover both.

## 12. Portability boundary

`core/**` is the provider-neutral local API. It depends on: a `ComponentDataAdapter`
(id, contract version, supported view-model versions, a `ValidationRunner` callback,
an `InstanceSelection`, a `PublicationMatrix`, and a `project()` function), plus a
generated-root path. It contains no reference to Python, `.claude`, KiCad, a file
layout, a storage format, or a validator runtime — the only `.claude` mentions under
`core/` are comments, two of which describe the *site's* own generated route shape
rather than this provider.

**Neutral about the provider, not about the domain.** Measured at #66: `core/` is
free of provider mechanics, but the view model it freezes is an *electronic-component*
one. `PublicRecordIdentity` carries `mpn`, `manufacturer`, `lcsc`, `packageName` and
`dnp`; `PublicPlacement` carries `board` and `refdes`; `corpus` counts
`inventoryLines` and `dnpOrHandFitLines`; `FIELD_KEYS` includes `record.lcsc` and
`alias.lcsc`; and `render/catalog.ts` labels a column "Orderable ID". An earlier
version of this section claimed `core/**` had no reference to LCSC. It does, in
`core/view-model.ts` and `core/publication.ts`, and always has.

That is a reasonable design — the renderers have to name what they render — but it
sets the real reuse boundary. A second **source of component evidence** is a sibling
adapter directory and no change under `core/`. A second **domain** is not: it needs
the view model, the field keys and the renderers generalised first, which is a
larger job than writing an adapter and should be costed as one.

`adapters/circuit/**` is the only provider-specific code.

**Package extraction is deliberately deferred.** This epic does not modify or
release `@takazudo/zfb`, `@takazudo/zudo-doc`, or any other repository/package. The
adoption guide is #66's deliverable.

## 13. Non-goals

- No full catalog, record-detail, integration or responsive UI here — those are
  #59/#60/#61/#62/#63.
- No change to component selections, schematic connectivity, firmware behaviour, or
  the frozen evidence contract. The evidence schema is **not** adjusted for
  presentation convenience.
- No PDFs, no skill assets, no browser-side raw JSON viewer.
- No component-wide PASS/FAIL verdict, ever. Coverage is per-domain; an absent open
  domain is not a safety claim.
- No replacement of narrative design rationale with generated tables.

## 14. Verification performed

```
python3 .claude/skills/component-spec-audit/scripts/validate.py     PASS: 32 lines; offline=True
python3 -m unittest discover -s .claude/skills/component-spec-audit/scripts -p 'test_*.py'
python3 .claude/skills/circuit-spec-integration/scripts/check_forward_tests.py
pnpm --dir doc run test:components        113 tests, 0 failures
pnpm --dir doc run generate:components    32/32 records, 81/81 sources, 1 page
pnpm --dir doc run check:components       generated output is up to date
pnpm --dir doc run check                  tsc — no errors
pnpm --dir doc run build                  52 pages
```

Additionally proven:

- clean-checkout ordering — `rm -rf doc/src/content/docs/components && pnpm build`
  recreates the tree in the same build;
- validator failure propagation — a seeded `sys.exit(3)` script aborts the pipeline
  with `VALIDATION_FAILED` carrying the exit code and stderr, before any projection;
- two-run idempotency and byte-identical output across separate roots;
- denied-value canaries (a source SHA-256, an evidence extract, a routing prompt, a
  `reviewedBy` string) appear in **zero** files under `doc/dist/`;
- the sitemap remains an empty `urlset`.

### Re-verified at #64 (Wave 4)

```
pnpm --dir doc run test:components   371 tests, 0 failures
pnpm --dir doc run scan:artifacts    OWNED 226 canaries x 73 artifacts, 0 hits
                                     SITE  222 canaries x 195 artifacts, 0 hits
pnpm --dir doc run scan:doc-skill    isolated corpus, 0 hits; real $HOME untouched
```

Zero leaks, on every surface swept: generated MDX, `preflight.json`, all 84 built
HTML pages, client bundles and island payloads, `_worker.js` / `_zfb_inner.mjs`,
theme packs, `search-index.json`, `llms.txt`, `llms-full.txt`, `sitemap.xml`,
`robots.txt`, `__zfb/routes.json`, and an isolated docs-to-agent corpus. 161
binary artifacts were counted and deliberately not text-searched.

Two things measured here that the prose above could be read as denying:

- **Published identifiers do reach browser hydration data.** 427 `data-props`
  payloads on the built component pages carry `rec-`, `int-`, `pinmap-` and
  `fact-` ids, because the site chrome hydrates page *descriptions* and TOC
  heading text and #61 put identifiers in descriptions. §7's "no evidence in
  hydration data" is accurate as written — it is about generated data modules
  reaching a browser JS asset, and none do — but the artifact-level truth is
  narrower: what must never be hydrated is the evidence GRAPH, and that is now
  asserted by key name rather than assumed.
- **`zfb`'s link validation reports ~4,300 broken-link warnings** on the
  generated pages. They are false positives with a known cause (`core/links.ts`
  documents it: the validator resolves fragments against heading-derived anchors
  and cannot see `<EvidenceAnchor id="…" />`), and the anchors are present in the
  built HTML. The generator proves its own links fatally instead. The volume is
  the risk, not the warnings: a real broken link in a hand-authored page would be
  invisible in that noise.
