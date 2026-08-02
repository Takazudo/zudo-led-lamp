/**
 * The vocabulary the catalog and the record pages share.
 *
 * Both surfaces publish the same evidence graph at different magnifications,
 * so the words they put next to a value — and the routes they link it by —
 * have to be decided once. Two renderers each inventing a phrase for `OPEN`
 * would be two different claims about the same data.
 *
 * Three rules hold everywhere in this module:
 *
 *   1. A friendly label sits BESIDE the exact recorded string, never instead of
 *      it. `PASS - primary-source confirmed` is always shown verbatim; the
 *      plain-language gloss is an addition, and it lives in the page legend
 *      rather than replacing the term at the point of use.
 *   2. Nothing is rolled up. There is no function here that reduces a record to
 *      a verdict, a grade or a badge, and there must never be one — coverage is
 *      per-domain and an absent open domain is not a safety claim.
 *   3. An unknown provider string degrades, it does not fail and it does not
 *      disappear. Evidence gains new verdicts and domains over time; a term
 *      this module has no gloss for is still published exactly as recorded,
 *      and the legend says the gloss is missing rather than silently omitting
 *      the row.
 */

import { byCodeUnit, type Anchor, type Slug } from "../ids.ts";
import { fragmentRoute, route, type Route } from "../mdx.ts";
import { joinSafe, literal, safeText, type SafeText } from "../text.ts";
import type {
  PublicCoverage,
  PublicFact,
  PublicPlacement,
  PublicRecord,
  PublicViewModel,
} from "../view-model.ts";

// --- routes ----------------------------------------------------------------

export const COMPONENTS_ROUTE: Route = route("/docs/components/");
export const CATALOG_ROUTE: Route = route("/docs/components/catalog/");
export const RECORDS_ROUTE: Route = route("/docs/components/records/");

/** `/docs/components/records/<slug>/`, optionally at one anchor inside it. */
export function recordRoute(slug: Slug, fragment?: Anchor): Route {
  return route(`/docs/components/records/${slug}/`, fragment);
}

/** The record's entry on the catalog page. */
export function catalogEntryRoute(fragment: Anchor): Route {
  return route("/docs/components/catalog/", fragment);
}

/**
 * The raw agent resource a record's evidence actually lives in.
 *
 * The doc site already publishes every `.claude/skills/<name>/SKILL.md` at this
 * route (`claudeResources` in `zfb.config.ts`), so this links the projection
 * back to the thing it is a projection OF. It is deliberately a link and not a
 * copy: the bundle is the source of truth and these pages must not restate it.
 */
export function agentResourceRoute(ownerSkill: string): Route {
  return route(`/docs/claude-skills/${ownerSkill}/`);
}

/** A destination inside the page currently being rendered. */
export function samePage(fragment: Anchor): Route {
  return fragmentRoute(fragment);
}

// --- cross-record index ----------------------------------------------------

/**
 * Everything a renderer needs to turn an evidence ID into a link.
 *
 * The view model is a list of records, but the graph is not a tree: a
 * calculated fact on the AL8860 depends on a fact owned by its sense resistor,
 * and an interaction names up to four records. Rendering those as bare IDs
 * would leave the reader to guess which page to open, so every renderer gets
 * this index and links across.
 */
export type RecordIndex = {
  readonly slugByRecordId: ReadonlyMap<string, Slug>;
  readonly mpnByRecordId: ReadonlyMap<string, SafeText>;
  /** Which record owns a fact — the join that makes cross-record links work. */
  readonly recordIdByFactId: ReadonlyMap<string, string>;
  readonly anchorByFactId: ReadonlyMap<string, Anchor>;
  /** Sidebar order, so a record page never has to know its own position. */
  readonly sidebarPositionByRecordId: ReadonlyMap<string, number>;
};

/**
 * The records index page occupies position 1 inside `records/`, so the first
 * record starts at 2. Positions follow model order, which is inventory order
 * with each subordinate directly after its parent — the sidebar then reads the
 * same way the bill of materials does.
 */
const FIRST_RECORD_SIDEBAR_POSITION = 2;

export function buildRecordIndex(model: PublicViewModel): RecordIndex {
  const slugByRecordId = new Map<string, Slug>();
  const mpnByRecordId = new Map<string, SafeText>();
  const recordIdByFactId = new Map<string, string>();
  const anchorByFactId = new Map<string, Anchor>();
  const sidebarPositionByRecordId = new Map<string, number>();

  for (const [position, record] of model.records.entries()) {
    slugByRecordId.set(record.identity.recordId, record.identity.slug);
    mpnByRecordId.set(record.identity.recordId, record.identity.mpn);
    sidebarPositionByRecordId.set(
      record.identity.recordId,
      position + FIRST_RECORD_SIDEBAR_POSITION,
    );
    for (const fact of record.facts) {
      recordIdByFactId.set(fact.factId, fact.recordId);
      anchorByFactId.set(fact.factId, fact.anchor);
    }
  }

  return {
    slugByRecordId,
    mpnByRecordId,
    recordIdByFactId,
    anchorByFactId,
    sidebarPositionByRecordId,
  };
}

/**
 * Where a fact ID should link from the page for `currentRecordId`.
 *
 * `null` means "do not link": the fact is not published, so a link would 404.
 * The caller still renders the ID as code — an unpublished dependency is
 * information, and dropping it would hide that the chain leaves the corpus.
 */
export function factDestination(
  index: RecordIndex,
  factId: string,
  currentRecordId: string,
): Route | null {
  const ownerRecordId = index.recordIdByFactId.get(factId);
  const anchor = index.anchorByFactId.get(factId);
  if (ownerRecordId === undefined || anchor === undefined) return null;
  if (ownerRecordId === currentRecordId) return samePage(anchor);

  const slug = index.slugByRecordId.get(ownerRecordId);
  return slug === undefined ? null : recordRoute(slug, anchor);
}

// --- fixed labels ----------------------------------------------------------

/**
 * As-built fit state.
 *
 * `dnp` is one boolean covering two situations the project treats together —
 * a part deliberately not fitted, and one fitted by hand rather than by the
 * assembler — so the label names both instead of asserting the wrong one.
 */
export function fitLabel(dnp: boolean): SafeText {
  return dnp ? literal("DNP or hand-fit") : literal("Fitted");
}

/**
 * How much of a record's coverage is unresolved.
 *
 * The denominator is the point. A bare "0 open" invites the reading "nothing
 * open, therefore fine", which is exactly the component-wide safety verdict
 * this feature refuses to make. "0 open of 7 published domains" says what was
 * actually checked, and a record with no published coverage says so rather
 * than counting to zero.
 */
export function openDomainSummary(coverage: readonly PublicCoverage[]): SafeText {
  if (coverage.length === 0) return literal("no coverage domains published");
  const open = coverage.filter((entry) => entry.status === "OPEN").length;
  return safeText(`${open} open of ${coverage.length} published`, {
    field: "coverage summary",
  });
}

/** The same figure as a bare ratio, for a table cell that already has a header. */
export function openDomainRatio(coverage: readonly PublicCoverage[]): SafeText {
  if (coverage.length === 0) return literal("none published");
  const open = coverage.filter((entry) => entry.status === "OPEN").length;
  return safeText(`${open} of ${coverage.length}`, { field: "coverage ratio" });
}

/**
 * Placements grouped by board.
 *
 * One inventory line is placed 24 times. A flat run of 24 designators is a wall
 * of text; grouped by board it reads as "two boards, this many each" at a
 * glance while still naming every designator exactly.
 */
export function placementSummary(placements: readonly PublicPlacement[]): SafeText {
  if (placements.length === 0) return literal("no placement published");

  const boards: string[] = [];
  const byBoard = new Map<string, string[]>();
  for (const placement of placements) {
    const bucket = byBoard.get(placement.board);
    if (bucket === undefined) {
      boards.push(placement.board);
      byBoard.set(placement.board, [placement.refdes]);
    } else {
      bucket.push(placement.refdes);
    }
  }

  const parts = boards.map((board) =>
    safeText(`${board} ${(byBoard.get(board) ?? []).join(", ")}`, {
      field: "placement group",
    }),
  );
  return joinSafe(parts, "; ");
}

/** A fact's value and its unit, kept as two fields because they are two fields. */
export function factValue(fact: PublicFact): SafeText {
  return typeof fact.value === "number"
    ? safeText(String(fact.value), { field: `${fact.factId} value` })
    : fact.value;
}

// --- fact classes ----------------------------------------------------------

/**
 * The order fact classes are presented in, and why each one exists.
 *
 * Not alphabetical: the ordering is the reading order a spec is meant to be
 * read in. An absolute maximum and a recommended operating value are the pair
 * most often collapsed into one "rating" by a hurried reader, and collapsing
 * them is how parts get destroyed, so they lead and they lead adjacent.
 *
 * A class absent from this list still renders — it sorts after the known ones
 * and simply has no gloss. New evidence classes must not need a code change to
 * become visible.
 */
export const FACT_CLASS_ORDER: readonly string[] = [
  "ABSOLUTE_MAXIMUM",
  "RECOMMENDED_OPERATION",
  "GUARANTEED_ELECTRICAL",
  "TYPICAL_CURVE",
  "TRANSIENT",
  "THERMAL_SOA",
  "PROTECTION_STANDOFF",
  "PROTECTION_BREAKDOWN",
  "PROTECTION_CLAMP",
  "PROJECT_STATE",
];

export const FACT_CLASS_GLOSS: Readonly<Record<string, string>> = {
  ABSOLUTE_MAXIMUM:
    "A never-exceed limit. Reaching it may damage the part; it is not an operating target " +
    "and there is no margin implied by it.",
  RECOMMENDED_OPERATION:
    "The range the manufacturer intends the part to be used in. Always narrower than the " +
    "absolute maximum.",
  GUARANTEED_ELECTRICAL:
    "A parameter the manufacturer guarantees over the stated conditions, usually with " +
    "minimum, typical and maximum values.",
  TYPICAL_CURVE:
    "A representative figure read from a characteristic curve. Typical values are not " +
    "guaranteed and vary part to part.",
  TRANSIENT: "Behaviour during a short event — startup, a switching edge, a fault or a surge.",
  THERMAL_SOA:
    "Thermal and safe-operating-area behaviour: how much the part may dissipate, and under " +
    "what mounting and ambient conditions.",
  PROTECTION_STANDOFF:
    "The voltage a protection device is expected to sit at without conducting.",
  PROTECTION_BREAKDOWN: "The voltage at which a protection device begins to conduct.",
  PROTECTION_CLAMP:
    "The voltage a protection device clamps to while conducting its rated surge current.",
  PROJECT_STATE:
    "A value this project recorded about how the part is used here — a chosen operating " +
    "point, a net assignment, or a derived figure. Not a manufacturer specification.",
};

/** Classes present on a record, known ones in reading order, then the rest. */
export function orderedFactClasses(facts: readonly PublicFact[]): SafeText[] {
  const present = [...new Set(facts.map((fact) => fact.factClass))];
  const known = present.filter((entry) => FACT_CLASS_ORDER.includes(entry));
  known.sort(
    (left, right) => FACT_CLASS_ORDER.indexOf(left) - FACT_CLASS_ORDER.indexOf(right),
  );
  const unknown = present.filter((entry) => !FACT_CLASS_ORDER.includes(entry)).sort(byCodeUnit);
  return [...known, ...unknown];
}

// --- plain-language glosses ------------------------------------------------

/**
 * What each recorded term means, in words a reader who has never opened the
 * evidence bundle can act on.
 *
 * These gloss the vocabulary, never a value. "NEEDS BENCH means it cannot be
 * settled from documents" is a definition; "this part is fine" would be a
 * verdict, and no gloss here makes one.
 *
 * Only terms that actually appear on a page reach that page's legend, so the
 * legend stays a legend rather than becoming a glossary of the whole schema.
 * Fields the publication matrix denies appear in none of these tables — the
 * legend must not describe something the pages do not show.
 */
export const VERDICT_GLOSS: Readonly<Record<string, string>> = {
  "PASS - primary-source confirmed":
    "Confirmed against the manufacturer's own document for this exact part.",
  "CONFIRMED - distributor identity only":
    "A distributor listing confirms which part this is, and nothing more. It carries no " +
    "electrical, thermal or lifetime authority.",
  "NEEDS BENCH":
    "Cannot be settled from documents. It needs measurement on real hardware before it can " +
    "be relied on.",
  UNSOURCED: "No accepted source backs this value yet. Treat it as a claim, not a fact.",
  "NOT APPLICABLE": "The parameter does not apply to this part as it is used here.",
};

export const PROVENANCE_GLOSS: Readonly<Record<string, string>> = {
  "PRIMARY-SPEC": "Taken from the manufacturer's own specification document.",
  "DISTRIBUTOR-IDENTITY": "Taken from a distributor listing. Identity information only.",
  "REFERENCE-DESIGN":
    "Taken from a vendor reference design or application note rather than the device " +
    "specification.",
  CALCULATED:
    "Derived arithmetically from other facts listed here. The expression and every input " +
    "are shown, so the number can be recomputed rather than trusted.",
  "PROJECT-CHOICE": "A decision made by this project. No vendor asserts it.",
  UNVERIFIED: "Recorded, but not yet backed by an accepted source.",
};

export const AVAILABILITY_GLOSS: Readonly<Record<string, string>> = {
  AVAILABLE: "The document was retrieved and is on record.",
  "SOURCE UNAVAILABLE":
    "The document could not be retrieved. It stays listed so the gap is visible; anything " +
    "resting on it remains unsourced.",
};

export const AUTHORITY_GLOSS: Readonly<Record<string, string>> = {
  MANUFACTURER_PRIMARY: "The manufacturer's own document for this exact part.",
  MANUFACTURER_MIRROR:
    "A copy of a manufacturer document hosted elsewhere. Usable, but weaker than the " +
    "manufacturer's own copy.",
  DISTRIBUTOR_IDENTITY: "A distributor listing. Establishes which part this is, nothing more.",
  REFERENCE_DESIGN: "A reference design or application note rather than a device specification.",
  PROJECT_GENERATOR: "A document this project generated, such as a schematic or netlist export.",
};

export const COVERAGE_STATUS_GLOSS: Readonly<Record<string, string>> = {
  COVERED: "Every question this domain asks is answered by the facts listed against it.",
  OPEN:
    "Unresolved. Open means the question has not been answered, not that the part is unsafe — " +
    "the reason states what is missing.",
};

export const IDENTITY_STATE_GLOSS: Readonly<Record<string, string>> = {
  VERIFIED: "The exact orderable part has been confirmed against a source.",
  UNRESOLVED:
    "The exact orderable part is not yet confirmed. Substituting a same-name part from " +
    "another vendor is not permitted on that basis.",
};

export const SOURCE_STATE_GLOSS: Readonly<Record<string, string>> = {
  AVAILABLE: "At least one document backing this line was retrieved.",
  "SOURCE UNAVAILABLE": "No document backing this line could be retrieved.",
};

export const UNIT_NONE_GLOSS =
  "The value is not a physical quantity, so it carries no unit. Recorded as `NONE`.";

/** The fallback for a recorded term this module has no wording for yet. */
export const MISSING_GLOSS = "No plain-language description is recorded for this term yet.";

export function glossFor(table: Readonly<Record<string, string>>, term: string): SafeText {
  return literal(table[term] ?? MISSING_GLOSS);
}

/** Terms of one kind that actually occur on a page, in stable order. */
export function presentTerms(values: readonly SafeText[]): SafeText[] {
  return [...new Set(values)].sort(byCodeUnit);
}

// --- owner skill -----------------------------------------------------------

/**
 * The evidence bundle a record belongs to, when the view model carries it.
 *
 * Issue #60 asks each record page to name its owner skill and to link back to
 * the raw agent resource it is projected from. The provider has the value —
 * `InventoryLine.owner_skill` is read by the circuit adapter to count bundles —
 * but view model v1 does not carry it to the renderer, and this feature does
 * not own the view model.
 *
 * So the read sits behind this one accessor. It returns `null` today, and both
 * pages fall back to linking the agent-resource index rather than the owning
 * bundle. Adding `ownerSkill: SafeText` to `PublicRecordIdentity` is all that
 * is needed to complete both surfaces; nothing else has to change.
 */
type OwnerSkillCarrier = { readonly ownerSkill?: SafeText };

export function ownerSkillOf(record: PublicRecord): SafeText | null {
  return (record.identity as OwnerSkillCarrier).ownerSkill ?? null;
}

/** The index of every published agent resource — the owner-skill fallback. */
export const AGENT_RESOURCES_ROUTE: Route = route("/docs/claude-skills/");

/** Where a record's raw evidence bundle is published, as precisely as we know. */
export function agentResourceDestination(record: PublicRecord): Route {
  const ownerSkill = ownerSkillOf(record);
  return ownerSkill === null ? AGENT_RESOURCES_ROUTE : agentResourceRoute(ownerSkill);
}
