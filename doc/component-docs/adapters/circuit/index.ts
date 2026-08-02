/**
 * The circuit adapter: `.claude/skills/**` evidence to the public view model.
 *
 * V1 scope (this wave) is deliberately narrow. It reads the central inventory
 * and every owner manifest, proves the joins, asserts the selection is fresh,
 * and returns identity plus corpus counts. Facts, sources, coverage,
 * interactions and pin maps are declared in the view model and populated by
 * issue #59; integration rules by #63. Nothing about the SHAPE changes when
 * they land — only the arrays stop being empty.
 *
 * Ordering is inventory-line order, then parents before their subordinates.
 * The inventory is generated identity truth, so its order is already stable
 * and reviewable; deriving order from anything else (MPN, manufacturer) would
 * reshuffle pages whenever a part is renamed.
 */

import { anchor, byCodeUnit, recordSlug, type Slug } from "../../core/ids.ts";
import { fail } from "../../core/errors.ts";
import { safeText } from "../../core/text.ts";
import { VIEW_MODEL_VERSION } from "../../core/view-model.ts";
import type { ComponentDataAdapter, ProjectionContext } from "../../core/adapter.ts";
import type {
  CorpusSummary,
  PublicRecord,
  PublicRecordIdentity,
  PublicViewModel,
} from "../../core/view-model.ts";
import { CIRCUIT_PUBLICATION_MATRIX } from "./matrix.ts";
import { CIRCUIT_SELECTION } from "./selection.ts";
import { BUNDLE_FILES, INTEGRATION_RULES_FILE, INVENTORY_FILE, SKILLS_ROOT } from "./paths.ts";
import { readProviderJson } from "./read.ts";
import { createPythonValidator } from "./validate.ts";
import { join } from "node:path";

/** The frozen component-spec contract this adapter is written against. */
export const CIRCUIT_CONTRACT_VERSION = 1;

export const CIRCUIT_ADAPTER_ID = "circuit-component-spec";

export function createCircuitAdapter(): ComponentDataAdapter {
  return {
    id: CIRCUIT_ADAPTER_ID,
    contractVersion: CIRCUIT_CONTRACT_VERSION,
    supportedViewModelVersions: [VIEW_MODEL_VERSION],
    validate: createPythonValidator(),
    selection: CIRCUIT_SELECTION,
    matrix: CIRCUIT_PUBLICATION_MATRIX,
    project,
  };
}

// --- provider shapes -------------------------------------------------------
// Narrow structural reads only. The Python validator already enforced the
// frozen contract; re-stating it here would be the weaker second validator the
// epic forbids. These types exist to make the joins type-checked, not to
// re-validate the data.

type InventoryLine = {
  line_id: string;
  mpn: string;
  manufacturer: string;
  lcsc: string;
  package: string;
  dnp: boolean;
  owner_skill: string;
  identity_state: string;
  source_state: string;
  function: string;
  placements: { board: string; refdes: string }[];
};

type Inventory = {
  schema_version: number;
  assertions: { orderable_lines: number; fitted_lines: number; dnp_or_hand_fit_lines: number };
  lines: InventoryLine[];
};

type ManifestRecord = {
  record_id: string;
  line_id: string;
  kind: "standalone" | "subordinate";
  parent_record_id: string | null;
  source_ids: string[];
  fact_ids: string[];
  interaction_ids: string[];
  open_domains: string[];
};

async function project(context: ProjectionContext): Promise<PublicViewModel> {
  const { policy } = context;

  const inventory = (await readProviderJson(INVENTORY_FILE)) as Inventory;
  if (inventory.schema_version !== CIRCUIT_CONTRACT_VERSION) {
    fail("ADAPTER_CONTRACT", "inventory schema_version is not the contract this adapter reads", {
      expected: CIRCUIT_CONTRACT_VERSION,
      actual: inventory.schema_version,
    });
  }

  const ownerSkills = uniqueInOrder(inventory.lines.map((line) => line.owner_skill));
  const lineById = new Map(inventory.lines.map((line) => [line.line_id, line]));

  const manifestRecords: ManifestRecord[] = [];
  const sourceIds: string[] = [];
  const counts = { facts: 0, coverage: 0, pinMaps: 0, pins: 0 };
  const interactionIds = new Set<string>();

  for (const skill of ownerSkills) {
    const bundle = await readBundle(skill);
    manifestRecords.push(...bundle.records);
    sourceIds.push(...bundle.sourceIds);
    counts.facts += bundle.factCount;
    counts.coverage += bundle.coverageCount;
    counts.pinMaps += bundle.pinMapCount;
    counts.pins += bundle.pinCount;
    for (const id of bundle.interactionIds) interactionIds.add(id);
  }

  // Fatal when the committed selection names something the provider lost, and
  // when the corpus size moved. Must run before anything is projected.
  policy.assertSelectionFresh(
    manifestRecords.map((record) => record.record_id),
    sourceIds,
  );

  const selected = manifestRecords.filter((record) => policy.isRecordSelected(record.record_id));
  const ordered = orderRecords(selected, inventory.lines);
  const slugByRecordId = new Map(
    ordered.map((record) => [record.record_id, recordSlug(record.record_id)]),
  );

  const records: PublicRecord[] = ordered.map((record) => {
    const line = lineById.get(record.line_id);
    if (!line) {
      fail("ADAPTER_CONTRACT", `record ${record.record_id} references an unknown inventory line`, {
        recordId: record.record_id,
        lineId: record.line_id,
      });
    }
    return {
      identity: buildIdentity(record, line, slugByRecordId, policy),
      // Populated by #59 / #63. The shape is already frozen; only the arrays grow.
      aliases: { mpn: [], lcsc: [], manufacturer: [], function: [] },
      sources: [],
      facts: [],
      coverage: [],
      interactions: [],
      pinMaps: [],
    };
  });

  const corpus: CorpusSummary = {
    ownerBundles: ownerSkills.length,
    records: manifestRecords.length,
    standaloneRecords: manifestRecords.filter((record) => record.kind === "standalone").length,
    subordinateRecords: manifestRecords.filter((record) => record.kind === "subordinate").length,
    sources: sourceIds.length,
    facts: counts.facts,
    coverageDomains: counts.coverage,
    interactions: interactionIds.size,
    pinMaps: counts.pinMaps,
    pins: counts.pins,
    inventoryLines: inventory.assertions.orderable_lines,
    fittedLines: inventory.assertions.fitted_lines,
    dnpOrHandFitLines: inventory.assertions.dnp_or_hand_fit_lines,
  };

  assertCorpusMatchesInventory(corpus, inventory);
  // Read so a missing integration bundle fails now rather than in #63.
  await readProviderJson(INTEGRATION_RULES_FILE);

  return {
    version: VIEW_MODEL_VERSION,
    provider: {
      id: safeText(CIRCUIT_ADAPTER_ID, { field: "provider.id" }),
      contractVersion: CIRCUIT_CONTRACT_VERSION,
    },
    corpus,
    records,
    integration: [],
  };
}

function buildIdentity(
  record: ManifestRecord,
  line: InventoryLine,
  slugByRecordId: ReadonlyMap<string, Slug>,
  policy: ProjectionContext["policy"],
): PublicRecordIdentity {
  const slug = slugByRecordId.get(record.record_id);
  if (slug === undefined) {
    fail("IDENTITY_COLLISION", `no slug for record ${record.record_id}`, {
      recordId: record.record_id,
    });
  }

  const parentRecordId = policy.publish("record.parentRecordId", record.parent_record_id);
  let parentSlug: Slug | null = null;
  if (parentRecordId != null) {
    const found = slugByRecordId.get(parentRecordId);
    if (found === undefined) {
      fail("STALE_SELECTION", `parent record ${parentRecordId} is not published`, {
        recordId: record.record_id,
        parentRecordId,
      });
    }
    parentSlug = found;
  }

  return {
    recordId: policy.publishRequired(
      "record.recordId",
      safeText(record.record_id, { field: "record_id" }),
    ),
    slug: policy.publishRequired("record.slug", slug),
    anchor: anchor(record.record_id),
    kind: policy.publishRequired("record.kind", record.kind),
    parentRecordId:
      parentRecordId == null
        ? null
        : safeText(parentRecordId, { field: "parent_record_id" }),
    parentSlug,
    lineId: policy.publishRequired("record.lineId", safeText(line.line_id, { field: "line_id" })),
    mpn: policy.publishRequired("record.mpn", safeText(line.mpn, { field: "mpn" })),
    manufacturer: policy.publishRequired(
      "record.manufacturer",
      safeText(line.manufacturer, { field: "manufacturer" }),
    ),
    lcsc: policy.publishRequired("record.lcsc", safeText(line.lcsc, { field: "lcsc" })),
    packageName: policy.publishRequired(
      "record.package",
      safeText(line.package, { field: "package" }),
    ),
    function: policy.publishRequired(
      "record.function",
      safeText(line.function, { field: "function" }),
    ),
    identityState: policy.publishRequired(
      "record.identityState",
      safeText(line.identity_state, { field: "identity_state" }),
    ),
    sourceState: policy.publishRequired(
      "record.sourceState",
      safeText(line.source_state, { field: "source_state" }),
    ),
    dnp: policy.publishRequired("record.dnp", line.dnp),
    placements: policy.publishRequired(
      "record.placements",
      line.placements.map((placement) => ({
        board: safeText(placement.board, { field: "placement.board" }),
        refdes: safeText(placement.refdes, { field: "placement.refdes" }),
      })),
    ),
  };
}

async function readBundle(skill: string) {
  const dir = join(SKILLS_ROOT, skill);
  // Read by name, not by position: a tuple destructure of BUNDLE_FILES would
  // silently misalign if that list is ever reordered.
  const read = async <T>(file: (typeof BUNDLE_FILES)[number]): Promise<T> =>
    (await readProviderJson(join(dir, file))) as T;

  const [manifest, sources, facts, coverage, routing, interactions, pinMap] =
    await Promise.all([
      read<{ records: ManifestRecord[] }>("manifest.json"),
      read<{ sources: { source_id: string }[] }>("sources.json"),
      read<{ facts: unknown[] }>("facts.json"),
      read<{ coverage: unknown[] }>("coverage.json"),
      // Not projected until #59; read so a missing or malformed routing bundle
      // fails now rather than three issues later.
      read<{ routes: unknown[] }>("routing.json"),
      read<{ interactions: { interaction_id: string }[] }>("interactions.json"),
      read<{ pin_maps: { pins: unknown[] }[] }>("pin-map.json"),
    ]);

  return {
    routeCount: routing.routes.length,
    records: manifest.records,
    sourceIds: sources.sources.map((source) => source.source_id),
    factCount: facts.facts.length,
    coverageCount: coverage.coverage.length,
    interactionIds: interactions.interactions.map((entry) => entry.interaction_id),
    pinMapCount: pinMap.pin_maps.length,
    pinCount: pinMap.pin_maps.reduce((sum, entry) => sum + entry.pins.length, 0),
  };
}

/** Inventory-line order, parents before their own subordinates. */
function orderRecords(
  records: readonly ManifestRecord[],
  lines: readonly InventoryLine[],
): ManifestRecord[] {
  const lineIndex = new Map(lines.map((line, index) => [line.line_id, index]));
  const rank = (record: ManifestRecord): number =>
    lineIndex.get(record.line_id) ?? Number.MAX_SAFE_INTEGER;

  const standalone = records
    .filter((record) => record.kind === "standalone")
    .sort((left, right) => rank(left) - rank(right) || byCodeUnit(left.record_id, right.record_id));

  const childrenByParent = new Map<string, ManifestRecord[]>();
  const orphans: ManifestRecord[] = [];
  for (const record of records) {
    if (record.kind !== "subordinate") continue;
    const parent = record.parent_record_id;
    if (parent === null) {
      orphans.push(record);
      continue;
    }
    const bucket = childrenByParent.get(parent) ?? [];
    bucket.push(record);
    childrenByParent.set(parent, bucket);
  }
  if (orphans.length > 0) {
    fail("ADAPTER_CONTRACT", "subordinate record has no parent_record_id", {
      recordIds: orphans.map((record) => record.record_id).sort(byCodeUnit),
    });
  }

  const ordered: ManifestRecord[] = [];
  for (const parent of standalone) {
    ordered.push(parent);
    const children = (childrenByParent.get(parent.record_id) ?? []).sort(
      (left, right) => rank(left) - rank(right) || byCodeUnit(left.record_id, right.record_id),
    );
    ordered.push(...children);
    childrenByParent.delete(parent.record_id);
  }

  // A subordinate whose parent is not selected would silently vanish; that is
  // a selection mistake, not something to paper over with a fallback ordering.
  if (childrenByParent.size > 0) {
    fail("STALE_SELECTION", "subordinate records reference an unselected parent", {
      parents: [...childrenByParent.keys()].sort(byCodeUnit),
    });
  }

  return ordered;
}

function assertCorpusMatchesInventory(corpus: CorpusSummary, inventory: Inventory): void {
  if (inventory.lines.length !== inventory.assertions.orderable_lines) {
    fail("ADAPTER_CONTRACT", "inventory line count disagrees with its own assertion", {
      lines: inventory.lines.length,
      asserted: inventory.assertions.orderable_lines,
    });
  }
  if (corpus.standaloneRecords + corpus.subordinateRecords !== corpus.records) {
    fail("ADAPTER_CONTRACT", "record kinds do not sum to the record total", {
      standalone: corpus.standaloneRecords,
      subordinate: corpus.subordinateRecords,
      total: corpus.records,
    });
  }
}

function uniqueInOrder(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}
