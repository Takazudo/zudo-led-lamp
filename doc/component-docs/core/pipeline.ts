/**
 * The one generation path. `generate`, `check` and the watcher all call
 * `runPipeline` — there is no second code path that could drift.
 *
 * Order is load-bearing and fail-closed at every step:
 *
 *   1. negotiate  — adapter must support this core's view-model version
 *   2. validate   — the provider's OWN validator; nonzero exit aborts here,
 *                   before a single byte is projected
 *   3. project    — adapter reads its data and asserts its selection is fresh
 *   4. render     — data to AST to text, guarded
 *   5. emit       — into the exclusively-owned tree (or diff, in check mode)
 *   6. preflight  — deterministic report of what was published and withheld
 */

import { diffAgainstDisk, emit, type EmitResult } from "./emit.ts";
import { fail } from "./errors.ts";
import { assertUnique } from "./ids.ts";
import { PublicationPolicy, type PreflightReport } from "./publication.ts";
import { renderCatalog } from "./render/catalog.ts";
import { renderLanding } from "./render/landing.ts";
import { renderRecord, renderRecordsIndex } from "./render/record.ts";
import { buildRecordIndex } from "./render/shared.ts";
import { VIEW_MODEL_VERSION } from "./view-model.ts";
import type { ComponentDataAdapter } from "./adapter.ts";
import type { GeneratedPage } from "./page.ts";

export type PipelineOptions = {
  /** Absolute path of the exclusively-owned generated root. */
  readonly generatedRoot: string;
  /** `true` reports drift and writes nothing. */
  readonly dryRun: boolean;
};

export type PipelineResult = {
  readonly pages: readonly GeneratedPage[];
  readonly report: PreflightReport;
  /** Present only when `dryRun` is false. */
  readonly emitted: EmitResult | null;
  /** Present only when `dryRun` is true; empty means the tree is in sync. */
  readonly drift: readonly string[];
};

export async function runPipeline(
  adapter: ComponentDataAdapter,
  options: PipelineOptions,
): Promise<PipelineResult> {
  if (!adapter.supportedViewModelVersions.includes(VIEW_MODEL_VERSION)) {
    fail("ADAPTER_CONTRACT", `adapter ${adapter.id} does not support view model v${VIEW_MODEL_VERSION}`, {
      adapter: adapter.id,
      required: VIEW_MODEL_VERSION,
      supported: adapter.supportedViewModelVersions.map(String),
    });
  }

  const validation = await adapter.validate();
  if (!validation.ok) {
    fail("VALIDATION_FAILED", `provider validator exited ${validation.exitCode}`, {
      command: validation.command,
      exitCode: validation.exitCode,
      stdout: tail(validation.stdout),
      stderr: tail(validation.stderr),
    });
  }

  const policy = new PublicationPolicy(adapter.matrix, adapter.selection);
  const model = await adapter.project({ policy });

  if (!policy.selectionChecked) {
    fail("ADAPTER_CONTRACT", `adapter ${adapter.id} did not assert its selection is fresh`, {
      adapter: adapter.id,
    });
  }
  if (model.version !== VIEW_MODEL_VERSION) {
    fail("ADAPTER_CONTRACT", `adapter ${adapter.id} returned view model v${model.version}`, {
      adapter: adapter.id,
      expected: VIEW_MODEL_VERSION,
    });
  }

  const slugs = model.records.map((record) => record.identity.slug);
  assertUnique("record slug", slugs);
  assertUnique(
    "anchor",
    model.records.flatMap((record) => [
      record.identity.anchor,
      ...record.sources.map((source) => source.anchor),
      ...record.facts.map((fact) => fact.anchor),
      ...record.coverage.map((entry) => entry.anchor),
      ...record.interactions.map((entry) => entry.anchor),
      ...record.pinMaps.map((entry) => entry.anchor),
    ]),
  );

  // One index built once and handed to every record page. The evidence graph
  // crosses records — a calculated fact cites a fact owned by another part, an
  // interaction spans several — so a page cannot resolve its own links from its
  // own record alone.
  const recordIndex = buildRecordIndex(model);

  const pages: GeneratedPage[] = [
    renderLanding(model, policy),
    renderCatalog(model),
    renderRecordsIndex(model.records),
    ...model.records.map((record) => renderRecord(record, recordIndex)),
  ];
  assertUnique("generated path", pages.map((page) => page.relativePath));

  const plan = { root: options.generatedRoot, pages };
  const emitted = options.dryRun ? null : await emit(plan);
  const drift = options.dryRun ? await diffAgainstDisk(plan) : [];

  const report = policy.buildReport({
    viewModelVersion: model.version,
    providerId: adapter.id,
    providerContractVersion: adapter.contractVersion,
    availableRecords: model.corpus.records,
    availableSources: model.corpus.sources,
    selectedSlugs: slugs,
    counts: {
      generatedPages: pages.length,
      publishedRecords: model.records.length,
      publishedFacts: model.records.reduce((sum, record) => sum + record.facts.length, 0),
      publishedSources: model.records.reduce((sum, record) => sum + record.sources.length, 0),
      publishedCoverageDomains: model.records.reduce(
        (sum, record) => sum + record.coverage.length,
        0,
      ),
      publishedInteractions: model.records.reduce(
        (sum, record) => sum + record.interactions.length,
        0,
      ),
      publishedPinMaps: model.records.reduce((sum, record) => sum + record.pinMaps.length, 0),
      publishedIntegrationRules: model.integration.length,
    },
  });

  return { pages, report, emitted, drift };
}

/** Keep failure detail bounded; a validator can print a lot on a bad day. */
function tail(value: string, limit = 2000): string {
  const trimmed = value.trimEnd();
  return trimmed.length <= limit ? trimmed : `…${trimmed.slice(-limit)}`;
}
