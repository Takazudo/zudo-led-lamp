/**
 * `scan:artifacts` — the publication-safety gate on the BUILT site.
 *
 * Every other check in this feature runs against structured data: the matrix
 * refuses a field, the branded types refuse an unsanitised string, preflight
 * counts what was emitted. This one runs against bytes, after the MDX compiler,
 * the HTML minifier, the search indexer and the `llms.txt` writer have each had
 * a turn — none of which this feature owns, and any of which could reintroduce
 * something the projection correctly withheld.
 *
 * It is a separate command rather than a test on purpose. `test:components`
 * must keep passing on a fresh checkout with no `dist/`, and a safety check
 * that skips itself when its input is missing is the exact shape of a gate that
 * silently stops working. So this one has no skip path: a missing `dist/` is a
 * failure that tells you to build.
 *
 * Three classes of assertion, and all three have to hold:
 *
 *   NEGATIVE  no value reachable only through a denied provider key appears in
 *             any artifact;
 *   POSITIVE  the fields the contract promises a reader — identity, condition,
 *             unit, provenance, verdict, coverage state, locator, source link —
 *             are all still there. Without this, an empty site passes.
 *   SHAPE     hydration payloads, the sitemap and deploy artifacts stay what
 *             they are supposed to be.
 *
 * ## Why the negative scan has two tiers
 *
 * The site publishes component knowledge through channels this feature does not
 * own. The narrative docs are hand-authored and name parts in prose;
 * `claudeResources` mirrors every `SKILL.md` verbatim, and a routing prompt is
 * close to the skill's own frontmatter description by construction. Four values
 * in this corpus are therefore on the site legitimately, in pages this
 * generator never wrote.
 *
 * Scanning the whole site with the full canary set reports those four on every
 * clean build. So:
 *
 *   OWNED  artifacts this feature writes — the generated MDX, the preflight
 *          report, `dist/docs/components/**`, and the component slices of the
 *          search index and `llms.txt` — are scanned with the FULL canary set.
 *          Any hit there is unambiguously this generator's leak.
 *   SITE   everything else in `dist/` is scanned with the canaries that no
 *          other content source publishes. That still catches a denied value
 *          reaching a shared artifact — a client bundle, the worker, the search
 *          index as a whole — through this generator.
 *
 * The `llms-full.txt` component sections are not sliced out separately: their
 * entire input is the generated MDX, which the OWNED tier already scans at full
 * strength, so a clean MDX tree is what makes them clean.
 */

import { readFile } from "node:fs/promises";

import { ComponentDocsError } from "../core/errors.ts";
import { byCodeUnit } from "../core/ids.ts";
import { PublicationPolicy } from "../core/publication.ts";
import {
  assertNoLeaks,
  assertPositiveControls,
  assertRequiredRoutes,
  readScanTargets,
  scanTargets,
  subtractPublishedElsewhere,
  type Canary,
  type ScanTarget,
} from "../core/scan.ts";
import { projectIndex, readEvidenceIndex } from "../adapters/circuit/index.ts";
import { readCanaries } from "../adapters/circuit/canaries.ts";
import { CIRCUIT_PUBLICATION_MATRIX } from "../adapters/circuit/matrix.ts";
import { CIRCUIT_SELECTION } from "../adapters/circuit/selection.ts";
import {
  CONTENT_ROOT,
  DIST_ROOT,
  GENERATED_ROOT,
  PREFLIGHT_FILE,
} from "../adapters/circuit/paths.ts";
import { reportFailure } from "./run.ts";
import type { PublicViewModel } from "../core/view-model.ts";

/**
 * Floors that make a vacuous pass impossible. They are lower bounds, not exact
 * counts — this file must not become a second place the corpus figures are
 * asserted, because then adding one component would fail two checks for the
 * same reason. `corpus.test.ts` owns the exact numbers.
 */
const MINIMUM_OWNED_CANARIES = 100;
// Above what the non-`dist` owned surfaces contribute on their own (the MDX
// tree, preflight and the two slices), so losing every built page cannot clear
// the floor. `assertPageCoverage` is the exact check; this is the backstop that
// keeps the floor from being satisfiable by one surface.
const MINIMUM_OWNED_FILES = 60;
const MINIMUM_SITE_CANARIES = 100;
const MINIMUM_SITE_FILES = 150;

/**
 * How many canaries the SITE tier is allowed to drop because another content
 * source already publishes them. Four today, each verified by hand:
 *
 *   SMAJ20A C571370                 only the claude-skills mirror
 *   AO3401A C347476                 only the claude-skills mirror
 *   JST B6B-XH-A(LF)(SN)            mirror + power/board-p-front-end + ratings-matrix
 *   UMW (Youtai Semiconductor) …    mirror + architecture/decisions + ratings-matrix
 *
 * The subtraction corpus includes `claude-skills/*`, the generated mirror of
 * each `SKILL.md` — and two of the four rest on that mirror ALONE. `SKILL.md`
 * bodies are hand-editable, and the raw file is outside the canary harvest, so
 * a sentence added to one could retire a canary sitewide, invisibly from both
 * directions.
 *
 * Asserting the count makes both directions a decision instead of a silent
 * change: prose that retires a canary stops the build and someone reads the
 * added line; prose that legitimately names a new part stops the build and
 * someone bumps this number with a reason in the diff. Deliberately NOT solved
 * by narrowing the corpus to frontmatter — that would trade this silent failure
 * for a noisy one, firing on component-audit skills whose bodies name parts
 * constantly, and a canary that cries wolf gets suppressed.
 */
const EXPECTED_WITHHELD = 4;

function assertWithheldCount(withheld: number): void {
  if (withheld === EXPECTED_WITHHELD) return;
  throw new ComponentDocsError(
    "PUBLICATION_POLICY",
    "the number of canaries withheld from the SITE tier changed",
    {
      expected: EXPECTED_WITHHELD,
      actual: withheld,
      why: "another content source started or stopped publishing a denied-only value; review the change, then update EXPECTED_WITHHELD",
    },
  );
}

/**
 * Route fragments the docs-to-agent corpus must contain when `--agent-skill`
 * names one.
 *
 * Without this the surface can come up empty — a corpus assembled from the
 * wrong directory, or before generation ran — and nothing notices: the
 * per-surface positive controls below skip an empty surface as "not present",
 * and the four non-agent owned surfaces alone clear `MINIMUM_OWNED_FILES`. So
 * `scan:doc-skill` would exit 0 while proving nothing about what an agent
 * actually reads back, which is the one thing it exists to prove.
 *
 * Named routes rather than a file count, because the acceptance criterion is
 * that catalog, integration and record content are each discoverable — not
 * that some number of files exist. A count would also make this a second place
 * the corpus figures are asserted, which the floors above deliberately avoid.
 */
const REQUIRED_AGENT_ROUTES = [
  "/docs/components/index.",
  "/docs/components/catalog/",
  "/docs/components/integration/",
  "/docs/components/records/",
] as const;

type Surface = {
  readonly name: string;
  readonly targets: readonly ScanTarget[];
};

/** Artifacts this feature writes, or slices of shared artifacts it alone fills. */
async function ownedSurfaces(
  distTargets: readonly ScanTarget[],
  agentTargets: readonly ScanTarget[],
): Promise<readonly Surface[]> {
  return [
    { name: "generated MDX", targets: await readScanTargets(GENERATED_ROOT, "content") },
    {
      name: "preflight report",
      targets: [{ label: "preflight.json", text: await readFile(PREFLIGHT_FILE, "utf8") }],
    },
    {
      name: "built component pages",
      targets: distTargets.filter((target) => target.label.startsWith("dist/docs/components/")),
    },
    { name: "search + llms slices", targets: componentSlices(distTargets) },
    {
      name: "docs-to-agent components",
      targets: agentTargets.filter((target) => target.label.includes("/components/")),
    },
  ];
}

/**
 * The parts of the two shared discovery artifacts that describe generated
 * routes. Both mix this feature's output with the rest of the site, so the
 * component rows are lifted out and held to the OWNED standard.
 */
function componentSlices(distTargets: readonly ScanTarget[]): readonly ScanTarget[] {
  const slices: ScanTarget[] = [];

  const searchIndex = distTargets.find((target) => target.label === "dist/search-index.json");
  if (searchIndex?.text != null) {
    const entries = JSON.parse(searchIndex.text) as readonly { url: string }[];
    slices.push({
      label: "dist/search-index.json (component entries)",
      text: JSON.stringify(entries.filter((entry) => entry.url.includes("/docs/components/"))),
    });
  }

  const llms = distTargets.find((target) => target.label === "dist/llms.txt");
  if (llms?.text != null) {
    slices.push({
      label: "dist/llms.txt (component lines)",
      text: llms.text
        .split("\n")
        .filter((line) => line.includes("/docs/components"))
        .join("\n"),
    });
  }

  return slices;
}

type Control = { readonly label: string; readonly value: string };

/**
 * What discovery surfaces must carry.
 *
 * The search index truncates `body` to 300 characters and stores `description`
 * whole, and `llms.txt` carries only titles and descriptions — so neither can
 * be expected to hold a fact's locator. What they must hold is what a reader
 * searches BY: the exact part number, the orderable ID, the manufacturer and
 * the function. If those stop being findable, the catalog is unusable even
 * though every page still exists.
 */
function discoveryControls(model: PublicViewModel): readonly Control[] {
  const record = model.records.find((entry) => entry.identity.slug === "al8860mp-13");
  if (record === undefined) throw new Error("expected record al8860mp-13 in the projection");
  return [
    { label: "discovery: MPN", value: record.identity.mpn },
    { label: "discovery: orderable ID", value: record.identity.lcsc },
    { label: "discovery: manufacturer", value: record.identity.manufacturer },
    { label: "discovery: function", value: record.identity.function },
  ];
}

/**
 * Positive controls, derived from the projection rather than hard-coded, so
 * they cannot drift away from what the corpus actually contains. One value per
 * field class the acceptance criteria name.
 */
function positiveControls(model: PublicViewModel): readonly Control[] {
  const record = model.records.find((entry) => entry.identity.slug === "al8860mp-13");
  if (record === undefined) throw new Error("expected record al8860mp-13 in the projection");

  const factWithUnit = record.facts.find((fact) => fact.unit !== "" && fact.conditions !== "");
  const factWithVerdict = record.facts.find((fact) => fact.verdict !== "");
  const openDomain = record.coverage.find((entry) => entry.status === "OPEN");
  const linkedSource = record.sources.find((source) => source.url !== null);
  // Pin assignments are wrapped in an `EvidenceDetails` container. A container
  // may change how content is PRESENTED, never whether it exists — so one of
  // its rows is a control, and the day the wrapper becomes a client-gated
  // island the static artifacts lose it and this fails.
  const containerRow = record.pinMaps[0]?.pins[0]?.function;

  if (factWithUnit === undefined || factWithVerdict === undefined) {
    throw new Error("expected a fact carrying a unit, conditions and a verdict");
  }
  if (openDomain === undefined || linkedSource?.url == null) {
    throw new Error("expected an open coverage domain and a source with a published link");
  }
  if (containerRow === undefined) {
    throw new Error("expected a pin map row to use as a container-content control");
  }

  return [
    { label: "identity: MPN", value: record.identity.mpn },
    { label: "identity: orderable ID", value: record.identity.lcsc },
    { label: "identity: manufacturer", value: record.identity.manufacturer },
    { label: "identity: package", value: record.identity.packageName },
    { label: "identity: function", value: record.identity.function },
    { label: "identity: owner skill", value: record.identity.ownerSkill },
    { label: "fact: unit", value: factWithUnit.unit },
    { label: "fact: conditions", value: factWithUnit.conditions },
    { label: "fact: provenance", value: factWithVerdict.provenance },
    { label: "fact: verdict", value: factWithVerdict.verdict },
    { label: "fact: locator", value: factWithUnit.locator },
    { label: "coverage: status", value: openDomain.status },
    { label: "coverage: reason", value: openDomain.reason },
    { label: "source: document title", value: linkedSource.documentTitle },
    { label: "source: availability", value: linkedSource.availability },
    { label: "source: locator", value: linkedSource.locator },
    { label: "source: link", value: linkedSource.url },
    { label: "container content: pin function", value: containerRow },
  ];
}

/**
 * Every `data-props` payload the built pages carry, decoded.
 *
 * These are the site chrome's islands (navigation tree, table of contents,
 * theme toggle), not this feature's — the one MDX component it emits is
 * SSR-only. What must stay true is that the evidence GRAPH never becomes
 * hydration data: published identifiers do legitimately reach these payloads
 * through page descriptions and heading text, but a fact's value, unit,
 * provenance or verdict must not.
 */
function hydrationPayloads(targets: readonly ScanTarget[]): readonly { label: string; json: string }[] {
  const payloads: { label: string; json: string }[] = [];
  for (const target of targets) {
    if (target.text === null || !target.label.endsWith(".html")) continue;
    for (const match of target.text.matchAll(/data-props='([^']*)'/gu)) {
      payloads.push({ label: target.label, json: decodeAttribute(match[1] as string) });
    }
  }
  return payloads;
}

function decodeAttribute(value: string): string {
  return value
    .replace(/&#39;/gu, "'")
    .replace(/&quot;/gu, '"')
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&amp;/gu, "&");
}

/**
 * Object keys that would mean the evidence graph itself had been serialised
 * into a browser payload. Every one is a view-model leaf; none is part of the
 * chrome's vocabulary, so a hit is unambiguous.
 */
const EVIDENCE_MODEL_KEYS: readonly string[] = [
  "factId",
  "sourceId",
  "coverageId",
  "interactionId",
  "pinMapId",
  "recordId",
  "ruleId",
  "provenance",
  "verdict",
  "conditions",
  "blockingFactIds",
  "evidenceExtract",
  "sha256",
  "reviewedBy",
  "authoritativeUrl",
  "alternateAuthoritativeUrl",
  "physicalPdfPageIndex",
  "positivePrompts",
  "negativePrompts",
];

function assertNoEvidenceGraphHydration(targets: readonly ScanTarget[]): number {
  const payloads = hydrationPayloads(targets);
  const offenders: string[] = [];

  for (const payload of payloads) {
    for (const key of EVIDENCE_MODEL_KEYS) {
      if (payload.json.includes(`"${key}"`)) offenders.push(`${payload.label} ← "${key}"`);
    }
  }

  if (offenders.length > 0) {
    throw new ComponentDocsError(
      "PUBLICATION_POLICY",
      `${offenders.length} hydration payload(s) carry evidence-model keys`,
      { offenders: [...new Set(offenders)].slice(0, 20) },
    );
  }
  return payloads.length;
}

/**
 * Credential shapes that must never ship in a deploy artifact. The build has no
 * business reading a secret at all, so any hit is a real finding rather than a
 * style question.
 */
const CREDENTIAL_PATTERNS: readonly { readonly label: string; readonly pattern: RegExp }[] = [
  { label: "PEM private key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/u },
  { label: "AWS access key id", pattern: /\bAKIA[0-9A-Z]{16}\b/u },
  { label: "GitHub token", pattern: /\bgh[pousr]_[A-Za-z0-9]{36,}/u },
  { label: "Cloudflare API token assignment", pattern: /CLOUDFLARE_API_TOKEN\s*[:=]\s*["'][^"']+/u },
  { label: "generic secret assignment", pattern: /\b(?:api[_-]?key|secret|password|passwd)\s*[:=]\s*["'][A-Za-z0-9_\-]{16,}["']/iu },
  { label: "Authorization: Bearer header", pattern: /Authorization["'\s:]+Bearer\s+[A-Za-z0-9._-]{20,}/u },
];

function assertCredentialFree(targets: readonly ScanTarget[]): void {
  const offenders: string[] = [];
  for (const target of targets) {
    if (target.text === null) continue;
    for (const { label, pattern } of CREDENTIAL_PATTERNS) {
      if (pattern.test(target.text)) offenders.push(`${target.label} ← ${label}`);
    }
  }
  if (offenders.length > 0) {
    throw new ComponentDocsError(
      "PUBLICATION_POLICY",
      `${offenders.length} deploy artifact(s) look like they carry a credential`,
      { offenders: offenders.slice(0, 20) },
    );
  }
}

/**
 * The sitemap is not enabled, and enabling it is a separate tested decision —
 * it would publish every generated route to crawlers in one file. An empty
 * `urlset` is the contracted state; a populated one means the config changed
 * without that decision being taken.
 */
function assertSitemapUnchanged(targets: readonly ScanTarget[]): void {
  const sitemap = targets.find((target) => target.label === "dist/sitemap.xml");
  if (sitemap?.text === undefined || sitemap.text === null) {
    throw new ComponentDocsError("PUBLICATION_POLICY", "dist/sitemap.xml is missing");
  }
  if (/<url>/u.test(sitemap.text)) {
    throw new ComponentDocsError(
      "PUBLICATION_POLICY",
      "sitemap.xml has entries; enabling it is a separate publication decision",
    );
  }
}

/**
 * The section pages the projection emits alongside one page per record.
 *
 * Deliberately one explicit list rather than a count. The extra-page check below
 * derives its expectation from `.length`, so adding a section page means editing
 * this list only. It was previously a literal `+ 3`, which passed the
 * missing-page check and failed the extra-page check with a bare pair of numbers
 * the moment #63 added the integration route — a real page looked like an
 * intruder, and the error did not say which one.
 */
const SECTION_PAGES: readonly string[] = [
  "dist/docs/components/index.html",
  "dist/docs/components/catalog/index.html",
  "dist/docs/components/records/index.html",
  "dist/docs/components/integration/index.html",
];

/** One built HTML page per generated record, plus the section pages. */
function assertPageCoverage(model: PublicViewModel, targets: readonly ScanTarget[]): number {
  const pages = new Set(
    targets
      .filter((target) => target.label.startsWith("dist/docs/components/"))
      .filter((target) => target.label.endsWith("/index.html"))
      .map((target) => target.label),
  );

  const expected = new Set<string>(SECTION_PAGES);
  for (const record of model.records) {
    expected.add(`dist/docs/components/records/${record.identity.slug}/index.html`);
  }

  const missing = [...expected].filter((page) => !pages.has(page)).sort(byCodeUnit);
  if (missing.length > 0) {
    throw new ComponentDocsError("PUBLICATION_POLICY", `${missing.length} generated page(s) did not build`, {
      missing: missing.slice(0, 20),
    });
  }

  // Name the intruders. "built 36, projected 35" tells whoever is reading CI
  // that something is wrong but not what, and the answer is the whole point.
  const unexpected = [...pages].filter((page) => !expected.has(page)).sort(byCodeUnit);
  if (unexpected.length > 0) {
    throw new ComponentDocsError(
      "PUBLICATION_POLICY",
      "the built tree has pages the projection did not produce",
      { built: pages.size, projected: expected.size, unexpected: unexpected.slice(0, 20) },
    );
  }
  return pages.size;
}

/**
 * The search index stores `description` whole while truncating `body`, so a
 * description is the one published string that reaches search in full. It has
 * to carry the identity a reader would search for, and it has to be clean.
 */
function assertSearchIndex(targets: readonly ScanTarget[], model: PublicViewModel): number {
  const target = targets.find((entry) => entry.label === "dist/search-index.json");
  if (target?.text === undefined || target.text === null) {
    throw new ComponentDocsError("PUBLICATION_POLICY", "dist/search-index.json is missing");
  }

  const entries = JSON.parse(target.text) as readonly { url: string; description?: string }[];
  const componentEntries = entries.filter((entry) => entry.url.includes("/docs/components/"));
  const missing = model.records.filter(
    (record) =>
      !componentEntries.some((entry) => entry.url.endsWith(`/records/${record.identity.slug}`)),
  );

  if (missing.length > 0) {
    throw new ComponentDocsError("PUBLICATION_POLICY", `${missing.length} record(s) are not searchable`, {
      missing: missing.map((record) => record.identity.slug).slice(0, 20),
    });
  }
  return componentEntries.length;
}

function surfaceReport(surface: Surface, canaries: readonly Canary[]): string {
  const result = scanTargets(surface.targets, canaries);
  return `  ${surface.name.padEnd(22)} ${String(result.filesScanned).padStart(4)} scanned, ${String(
    result.filesSkippedBinary,
  ).padStart(2)} binary, ${result.hits.length} hit(s)`;
}

async function main(): Promise<void> {
  const agentSkillIndex = process.argv.indexOf("--agent-skill");
  const agentSkillRoot = agentSkillIndex === -1 ? null : (process.argv[agentSkillIndex + 1] ?? null);
  if (agentSkillIndex !== -1 && agentSkillRoot === null) {
    throw new ComponentDocsError("ADAPTER_CONTRACT", "--agent-skill requires a directory");
  }

  const model = projectIndex(
    await readEvidenceIndex(),
    new PublicationPolicy(CIRCUIT_PUBLICATION_MATRIX, CIRCUIT_SELECTION),
  );

  const canaries = await readCanaries();
  const distTargets = await readScanTargets(DIST_ROOT, "dist");
  const agentTargets =
    agentSkillRoot === null ? [] : await readScanTargets(agentSkillRoot, "agent-skill");
  if (agentSkillRoot !== null) {
    assertRequiredRoutes(
      agentTargets,
      REQUIRED_AGENT_ROUTES,
      `docs-to-agent corpus at ${agentSkillRoot}`,
    );
  }

  // --- OWNED tier: full canary set, artifacts this feature writes -----------
  const owned = await ownedSurfaces(distTargets, agentTargets);
  const ownedResult = scanTargets(
    owned.flatMap((surface) => surface.targets),
    canaries,
  );
  assertNoLeaks(ownedResult, {
    canaries: MINIMUM_OWNED_CANARIES,
    files: MINIMUM_OWNED_FILES,
  });

  // Positive controls run per surface, not against the union: a value present
  // in the MDX but absent from the built HTML is exactly the regression worth
  // catching, and a union check would let one surface cover for another.
  const controls = positiveControls(model);
  const discovery = discoveryControls(model);
  for (const surface of owned) {
    if (surface.name === "preflight report") continue;
    if (surface.targets.length === 0) continue;
    assertPositiveControls(
      surface.targets,
      surface.name === "search + llms slices" ? discovery : controls,
      surface.name,
    );
  }

  // --- SITE tier: canaries no other content source publishes ---------------
  const contentTargets = (await readScanTargets(CONTENT_ROOT, "content")).filter(
    (target) => !target.label.startsWith("content/components/"),
  );
  const siteCanaries = subtractPublishedElsewhere(canaries, contentTargets);
  assertWithheldCount(canaries.length - siteCanaries.length);
  const siteResult = scanTargets([...distTargets, ...agentTargets], siteCanaries);
  assertNoLeaks(siteResult, {
    canaries: MINIMUM_SITE_CANARIES,
    files: MINIMUM_SITE_FILES,
  });

  // `llms-full.txt` mirrors the whole site, so its negative scan belongs to the
  // SITE tier — but it is the artifact an agent reads instead of the pages, and
  // an agent that silently loses the pin assignments is worse off than one that
  // cannot find the page at all. So it carries the full positive controls.
  const llmsFull = distTargets.filter((target) => target.label === "dist/llms-full.txt");
  if (llmsFull.length === 0) {
    throw new ComponentDocsError("PUBLICATION_POLICY", "dist/llms-full.txt is missing");
  }
  assertPositiveControls(llmsFull, controls, "llms-full.txt");

  const payloads = assertNoEvidenceGraphHydration(distTargets);
  assertCredentialFree(distTargets);
  assertSitemapUnchanged(distTargets);
  const pages = assertPageCoverage(model, distTargets);
  const searchable = assertSearchIndex(distTargets, model);

  process.stdout.write(
    [
      "artifact scan: no denied value reached a published artifact",
      "",
      `  OWNED tier            ${ownedResult.canaries} canaries × ${ownedResult.filesScanned} artifacts, 0 hits`,
      ...owned.map((surface) => surfaceReport(surface, canaries)),
      "",
      `  SITE tier             ${siteResult.canaries} canaries × ${siteResult.filesScanned} artifacts, 0 hits`,
      `                        ${canaries.length - siteCanaries.length} canary/canaries withheld — published by another content source`,
      `                        ${siteResult.filesSkippedBinary} binary artifact(s) not text-scanned`,
      "",
      `  positive controls     ${controls.length} per full-text surface, ${discovery.length} on discovery surfaces`,
      `  built pages           ${pages} under /docs/components/`,
      `  searchable records    ${searchable} entries in search-index.json`,
      `  hydration payloads    ${payloads} checked, none carrying evidence-model keys`,
      agentSkillRoot === null
        ? "  docs-to-agent         not scanned (pass --agent-skill <dir>)"
        : `  docs-to-agent         ${agentTargets.length} file(s) scanned at ${agentSkillRoot}`,
      "",
    ].join("\n"),
  );
}

main().catch(reportFailure);
