/**
 * The provider-neutral public view model.
 *
 * This is the ONLY shape the renderer sees. It contains no file paths, no
 * provider identifiers, no raw JSON, and every string is already `SafeText`.
 * A different evidence provider (a different circuit, a different repository,
 * a different validator) can populate the same shape without the renderer
 * changing.
 *
 * Ownership of population:
 *   - `corpus` and `records[].identity` — Wave 1 (this module's adapter).
 *   - `records[].facts/sources/coverage/interactions/pinMaps` — issue #59.
 *   - `integration` — issue #63.
 * The TYPES are frozen here in Wave 1 so #59/#60/#63 code against one shape.
 *
 * Every leaf below has exactly one `FieldKey` in `publication.ts`. Adding a
 * leaf without adding its key is a compile error.
 */

import type { Anchor, Slug } from "./ids.ts";
import type { SafeText } from "./text.ts";
import type { SafeUrl } from "./url.ts";

/** Bumped only when the shape changes incompatibly; adapters negotiate on it. */
export const VIEW_MODEL_VERSION = 1;

export type ViewModelVersion = typeof VIEW_MODEL_VERSION;

/** Which provider produced this model, and against which of its contracts. */
export type ProviderIdentity = {
  /** Stable provider id, e.g. `"circuit-component-spec"`. */
  readonly id: SafeText;
  /** The provider's own frozen-contract version (NOT the view-model version). */
  readonly contractVersion: number;
};

/**
 * Corpus-level counts. Presentation-only aggregates — never a synthesised
 * pass/fail verdict for a component or for the board.
 */
export type CorpusSummary = {
  readonly ownerBundles: number;
  readonly records: number;
  readonly standaloneRecords: number;
  readonly subordinateRecords: number;
  readonly sources: number;
  readonly facts: number;
  readonly coverageDomains: number;
  readonly interactions: number;
  readonly pinMaps: number;
  readonly pins: number;
  readonly inventoryLines: number;
  readonly fittedLines: number;
  readonly dnpOrHandFitLines: number;
};

/** Where a record's part is placed on a board. */
export type PublicPlacement = {
  readonly board: SafeText;
  readonly refdes: SafeText;
};

/** Identity of one orderable line, as published. */
export type PublicRecordIdentity = {
  readonly recordId: SafeText;
  readonly slug: Slug;
  readonly anchor: Anchor;
  readonly kind: "standalone" | "subordinate";
  /** Present only for `kind: "subordinate"`. */
  readonly parentRecordId: SafeText | null;
  readonly parentSlug: Slug | null;
  readonly lineId: SafeText;
  readonly mpn: SafeText;
  readonly manufacturer: SafeText;
  readonly lcsc: SafeText;
  readonly packageName: SafeText;
  readonly function: SafeText;
  /** Verbatim provider state strings, e.g. `VERIFIED` / `UNRESOLVED`. */
  readonly identityState: SafeText;
  readonly sourceState: SafeText;
  readonly dnp: boolean;
  readonly placements: readonly PublicPlacement[];
};

/** Search/routing aliases. Powers exact-term discovery in the catalog index. */
export type PublicAliases = {
  readonly mpn: readonly SafeText[];
  readonly lcsc: readonly SafeText[];
  readonly manufacturer: readonly SafeText[];
  readonly function: readonly SafeText[];
};

/**
 * One evidence source. `url` is `null` whenever the URL was denied by policy —
 * the source itself still publishes so a reader can see that evidence exists
 * and what state it is in.
 */
export type PublicSource = {
  readonly sourceId: SafeText;
  readonly anchor: Anchor;
  readonly documentTitle: SafeText;
  readonly documentNumber: SafeText;
  readonly revision: SafeText;
  readonly documentDate: SafeText;
  readonly retrievalDate: SafeText;
  readonly authorityClass: SafeText;
  /** `AVAILABLE` or `SOURCE UNAVAILABLE`, verbatim. */
  readonly availability: SafeText;
  readonly locator: SafeText;
  readonly printedPageLabel: SafeText;
  readonly url: SafeUrl | null;
};

/**
 * One key/value pair of a structured fact value.
 *
 * Entries are sorted by key with `byCodeUnit` so the rendered order is stable
 * across machines — JSON object key order is an artefact of how the evidence
 * file was written, not a claim the evidence makes.
 */
export type PublicFactValueEntry = {
  readonly key: SafeText;
  readonly value: number | SafeText;
};

/**
 * A fact value in its original JSON shape.
 *
 * A number stays a number so the page renders `42` and not `"42"`, and an
 * object stays an object: three facts in this corpus record a distributor
 * identity binding as `{lcsc, manufacturer, mpn, variant}`, and flattening
 * that into one string would be exactly the lossy coercion the contract
 * forbids. There is no fourth shape — a boolean, array or null value is a
 * fatal `ADAPTER_CONTRACT`, not something to guess a rendering for.
 */
export type PublicFactValue = number | SafeText | readonly PublicFactValueEntry[];

/**
 * One fact. Value keeps its original JSON shape, and unit/conditions stay
 * separate fields so nothing has to be re-parsed out of prose.
 */
export type PublicFact = {
  readonly factId: SafeText;
  readonly anchor: Anchor;
  readonly recordId: SafeText;
  readonly sourceId: SafeText;
  readonly factClass: SafeText;
  readonly value: PublicFactValue;
  readonly unit: SafeText;
  readonly conditions: SafeText;
  readonly locator: SafeText;
  readonly provenance: SafeText;
  readonly verdict: SafeText;
  readonly dependsOn: readonly SafeText[];
  /** Empty for raw facts; an evaluable arithmetic expression for calculated ones. */
  readonly expression: SafeText;
};

/** One coverage domain. `status` is per-domain and is never rolled up. */
export type PublicCoverage = {
  readonly coverageId: SafeText;
  readonly anchor: Anchor;
  readonly recordId: SafeText;
  readonly domain: SafeText;
  readonly status: "COVERED" | "OPEN";
  readonly reason: SafeText;
  readonly factIds: readonly SafeText[];
  readonly blockingFactIds: readonly SafeText[];
};

/** One cross-record interaction. */
export type PublicInteraction = {
  readonly interactionId: SafeText;
  readonly anchor: Anchor;
  readonly recordIds: readonly SafeText[];
  readonly factIds: readonly SafeText[];
  readonly conditions: SafeText;
  readonly verdict: SafeText;
};

export type PublicPin = {
  readonly symbolPin: SafeText;
  readonly name: SafeText;
  readonly footprintPad: SafeText;
  readonly function: SafeText;
};

export type PublicPinMap = {
  readonly pinMapId: SafeText;
  readonly anchor: Anchor;
  readonly recordId: SafeText;
  readonly symbol: SafeText;
  readonly footprint: SafeText;
  readonly pins: readonly PublicPin[];
};

/** One published record page's complete data. */
export type PublicRecord = {
  readonly identity: PublicRecordIdentity;
  readonly aliases: PublicAliases;
  readonly sources: readonly PublicSource[];
  readonly facts: readonly PublicFact[];
  readonly coverage: readonly PublicCoverage[];
  readonly interactions: readonly PublicInteraction[];
  readonly pinMaps: readonly PublicPinMap[];
};

/** One cross-component rule, published on the integration page. */
export type PublicIntegrationRule = {
  readonly ruleId: SafeText;
  readonly anchor: Anchor;
  readonly domain: SafeText;
  readonly recordIds: readonly SafeText[];
  readonly factIds: readonly SafeText[];
  readonly conditions: SafeText;
  readonly verdict: SafeText;
  readonly refusal: SafeText;
};

export type PublicViewModel = {
  readonly version: ViewModelVersion;
  readonly provider: ProviderIdentity;
  readonly corpus: CorpusSummary;
  /** Deterministically ordered: inventory-line order, parents before children. */
  readonly records: readonly PublicRecord[];
  readonly integration: readonly PublicIntegrationRule[];
};
