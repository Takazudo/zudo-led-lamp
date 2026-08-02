/**
 * Correctness gates on the real corpus, where unsafe OMISSION is the failure
 * mode rather than unsafe disclosure.
 *
 * `corpus.test.ts` proves the counts and the relationships. This file proves
 * the things that would still be wrong with every count correct: an open
 * coverage domain that reads as safe, a denied field whose canary set has
 * quietly gone empty, a subordinate whose parent link stopped rendering.
 *
 * The hardest of these is the domain with no facts at all. 25 of the 65 open
 * domains carry an empty `factIds` — they are open precisely because nothing
 * addresses them — so `reason` is the only content those sections have. A page
 * that renders them as a bare heading would show a component with several
 * silent gaps and read as complete.
 */

import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { FIELD_KEYS, PublicationPolicy, type FieldKey } from "../core/publication.ts";
import { buildRecordIndex } from "../core/render/shared.ts";
import { renderRecord } from "../core/render/record.ts";
import { harvestCanaries, normalizeForScan } from "../core/scan.ts";
import { projectIndex, readEvidenceIndex } from "../adapters/circuit/index.ts";
import { DENIED_PROVIDER_KEYS, readCanaries } from "../adapters/circuit/canaries.ts";
import { CIRCUIT_PUBLICATION_MATRIX } from "../adapters/circuit/matrix.ts";
import { CIRCUIT_SELECTION } from "../adapters/circuit/selection.ts";
import type { PublicViewModel } from "../core/view-model.ts";

let model: PublicViewModel;
let pages: Map<string, string>;

before(async () => {
  const index = await readEvidenceIndex();
  model = projectIndex(
    index,
    new PublicationPolicy(CIRCUIT_PUBLICATION_MATRIX, CIRCUIT_SELECTION),
  );
  const recordIndex = buildRecordIndex(model);
  pages = new Map(
    model.records.map((record) => [
      record.identity.slug,
      renderRecord(record, recordIndex).contents,
    ]),
  );
});

/**
 * The rendered section for one coverage domain: from its anchor to whatever
 * heading comes next. Sliced on the anchor rather than on the heading text,
 * because the heading is the domain string verbatim and several of those
 * contain markdown punctuation.
 */
function coverageSection(slug: string, anchor: string): string {
  const page = pages.get(slug);
  assert.ok(page, `no rendered page for ${slug}`);
  const start = page.indexOf(`id="${anchor}"`);
  assert.ok(start >= 0, `no rendered section for ${anchor} on ${slug}`);
  const next = page.slice(start).search(/\n#{2,3} /u);
  return next === -1 ? page.slice(start) : page.slice(start, start + next);
}

describe("open coverage never reads as safety", () => {
  it("still finds the corpus split the epic states", () => {
    const open = model.records.flatMap((record) =>
      record.coverage.filter((entry) => entry.status === "OPEN"),
    );
    assert.equal(open.length, 65);
    // The hard case: open because NOTHING addresses the domain, so there is no
    // fact to show and no blocker to blame.
    const barren = open.filter(
      (entry) => entry.factIds.length === 0 && entry.blockingFactIds.length === 0,
    );
    assert.equal(barren.length, 25);
    assert.equal(open.filter((entry) => entry.blockingFactIds.length === 0).length, 26);
  });

  it("gives every open domain a reason, and every barren one a reason with content", () => {
    for (const record of model.records) {
      for (const entry of record.coverage) {
        if (entry.status !== "OPEN") continue;
        assert.notEqual(entry.reason, "", `${entry.coverageId} is open with no reason`);
        if (entry.factIds.length > 0) continue;
        // `reason` is the whole section here. A one-word reason would render as
        // an open domain with nothing said about it.
        assert.ok(
          entry.reason.length >= 12,
          `${entry.coverageId} has no facts and a reason too short to explain itself`,
        );
      }
    }
  });

  it("renders a factless open domain with its status and its reason, not a bare heading", () => {
    const barren = model.records.flatMap((record) =>
      record.coverage
        .filter(
          (entry) =>
            entry.status === "OPEN" &&
            entry.factIds.length === 0 &&
            entry.blockingFactIds.length === 0,
        )
        .map((entry) => ({ slug: record.identity.slug, entry })),
    );
    assert.equal(barren.length, 25);

    for (const { slug, entry } of barren) {
      const section = coverageSection(slug, entry.anchor);
      assert.ok(section.includes("OPEN"), `${entry.coverageId} does not show its status`);
      assert.ok(
        normalizeForScan(section).includes(normalizeForScan(entry.reason)),
        `${entry.coverageId} does not show its reason`,
      );
      // Both absences are stated in words, not left to be inferred from a gap.
      // An empty list rendered as nothing at all is how an unanswered question
      // starts looking like an answered one.
      assert.ok(
        /none are recorded against it/u.test(section),
        `${entry.coverageId} shows an empty fact list silently`,
      );
      assert.ok(
        /no blocking fact is recorded/u.test(section),
        `${entry.coverageId} shows an empty blocker list silently`,
      );
      assert.ok(
        /the reason above is the whole of what is known/u.test(section),
        `${entry.coverageId} does not say the reason is all there is`,
      );
    }
  });

  it("never rolls a record's domains up into a single verdict", () => {
    for (const [slug, page] of pages) {
      // Phrasings that would turn per-domain coverage into a claim about the
      // part. A fact's own `verdict` legitimately reads `PASS - primary-source
      // confirmed` — that is published evidence about one measurement, and the
      // page says so in as many words — so the test is about ROLL-UP, not about
      // the word.
      for (const forbidden of [
        /\brecord (?:status|verdict)\b/iu,
        /\b(?:component|part) is (?:safe|suitable|approved|verified)\b/iu,
        /\boverall (?:verdict|status|result|assessment)\b/iu,
        /\b(?:all|every) (?:domains?|checks?) (?:pass|passed|clear)\b/iu,
      ]) {
        assert.equal(forbidden.test(page), false, `${slug} synthesises a verdict: ${forbidden}`);
      }

      // The identity block carries no status bullet of its own: every `Status:`
      // on the page belongs to a named coverage domain.
      const statusBullets = [...page.matchAll(/^- \*\*Status:\*\*/gmu)].length;
      const domains = model.records.find((record) => record.identity.slug === slug)?.coverage
        .length;
      assert.equal(statusBullets, domains, `${slug} has a status that is not a domain's`);
    }
  });

  it("shows a record with no open domains as counted, not as cleared", () => {
    const clear = model.records.filter((record) =>
      record.coverage.every((entry) => entry.status !== "OPEN"),
    );
    for (const record of clear) {
      const page = pages.get(record.identity.slug);
      assert.ok(page);
      assert.ok(
        page.includes("**Coverage:**"),
        `${record.identity.slug} drops the coverage line when nothing is open`,
      );
      assert.ok(
        /A record with no open domains has not thereby been declared safe\./u.test(page),
        `${record.identity.slug} omits the legend that stops an empty list reading as a clearance`,
      );
    }
  });
});

describe("relationships stay visible on the page, not just in the model", () => {
  it("shows every subordinate its parent, and links to it", () => {
    const subordinates = model.records.filter(
      (record) => record.identity.kind === "subordinate",
    );
    assert.equal(subordinates.length, 9);
    for (const record of subordinates) {
      const page = pages.get(record.identity.slug);
      assert.ok(page);
      assert.ok(record.identity.parentSlug, `${record.identity.slug} has no parent slug`);
      assert.ok(
        page.includes(`/docs/components/records/${record.identity.parentSlug}/`),
        `${record.identity.slug} does not link to its parent page`,
      );
    }
  });

  it("shows every record its owner bundle route", () => {
    for (const record of model.records) {
      const page = pages.get(record.identity.slug);
      assert.ok(page);
      assert.ok(
        page.includes(`/docs/claude-skills/${record.identity.ownerSkill}/`),
        `${record.identity.slug} does not link back to its raw agent resource`,
      );
    }
  });

  it("keeps two pin maps distinguishable on the one record that has them", () => {
    const header = model.records.find((record) => record.identity.slug === "jst-b6b-xh-a");
    assert.ok(header);
    assert.equal(header.pinMaps.length, 2);
    const page = pages.get("jst-b6b-xh-a");
    assert.ok(page);
    for (const map of header.pinMaps) {
      assert.ok(page.includes(map.pinMapId), `pin map ${map.pinMapId} is not identified`);
      assert.ok(page.includes(map.anchor), `pin map ${map.pinMapId} has no anchor`);
    }

    // The two maps share a symbol and a footprint — one connector, mated at
    // both ends of the harness — so what tells them apart is the pin FUNCTIONS
    // (Board P nets on one, Board L nets on the other). If the page rendered
    // only one of them, or rendered the same table twice, a reader wiring the
    // harness would take the wrong end's net names.
    const [first, second] = header.pinMaps;
    assert.ok(first && second);
    const functionsOf = (map: typeof first): string =>
      map.pins.map((pin) => pin.function).join("|");
    assert.notEqual(functionsOf(first), functionsOf(second), "the two pin maps are identical");
    // Through the scanner's normaliser, because the table escapes `_` and pads
    // its cells — the same reason a raw substring comparison is the wrong tool
    // against generated output anywhere else.
    const rendered = normalizeForScan(page);
    for (const map of header.pinMaps) {
      const distinctive = map.pins[0]?.function;
      assert.ok(distinctive);
      assert.ok(
        rendered.includes(normalizeForScan(distinctive)),
        `pin map ${map.pinMapId} did not render its pins`,
      );
    }
  });

  it("resolves every cross-record fact dependency to a page that exists", () => {
    const slugByFact = new Map<string, string>();
    for (const record of model.records) {
      for (const fact of record.facts) slugByFact.set(fact.factId, record.identity.slug);
    }
    let crossRecord = 0;
    for (const record of model.records) {
      for (const fact of record.facts) {
        for (const dependency of fact.dependsOn) {
          const target = slugByFact.get(dependency);
          assert.ok(target, `${fact.factId} depends on ${dependency}, which is unpublished`);
          if (target === record.identity.slug) continue;
          crossRecord += 1;
          const page = pages.get(record.identity.slug);
          assert.ok(page);
          assert.ok(
            page.includes(`/docs/components/records/${target}/#${dependency}`),
            `${fact.factId} does not link to ${dependency} on ${target}`,
          );
        }
      }
    }
    assert.equal(crossRecord, 7);
  });
});

describe("the canary set cannot quietly become empty", () => {
  /**
   * Every provider key name a denied `FieldKey` reads from. Written out rather
   * than derived, because the mapping from a view-model leaf to the provider
   * key that feeds it lives in the adapter's projection code and nowhere else —
   * so the day a decision flips, this table is what fails.
   */
  const PROVIDER_KEY_FOR_DENIED_FIELD: Readonly<Record<string, string>> = {
    "source.sha256": "sha256",
    "source.evidenceExtract": "evidence_extract",
    "source.alternateAuthoritativeUrl": "alternate_authoritative_url",
    "source.physicalPdfPageIndex": "physical_pdf_page_index",
    "routing.positivePrompts": "positive",
    "routing.negativePrompts": "negative",
    "pinMap.reviewedBy": "reviewed_by",
    // No provider key: V1 reads no assets at all, so there is nothing to canary.
    "asset.binary": "",
  };

  it("covers every denied field in the committed matrix", () => {
    const denied = FIELD_KEYS.filter((key) => CIRCUIT_PUBLICATION_MATRIX[key] === "DENY");
    assert.equal(denied.length, 8, "the number of denied fields moved without review");

    for (const key of denied) {
      const providerKey = PROVIDER_KEY_FOR_DENIED_FIELD[key];
      assert.notEqual(
        providerKey,
        undefined,
        `${key} is denied but no provider key is mapped for the canary scan`,
      );
      if (providerKey === "") continue;
      assert.ok(
        DENIED_PROVIDER_KEYS.includes(providerKey),
        `${key} reads ${providerKey}, which the canary harvest does not walk`,
      );
    }
  });

  it("maps no provider key to a field the matrix publishes", () => {
    for (const [key, providerKey] of Object.entries(PROVIDER_KEY_FOR_DENIED_FIELD)) {
      assert.equal(
        CIRCUIT_PUBLICATION_MATRIX[key as FieldKey],
        "DENY",
        `${key} is mapped as denied here but published by the matrix`,
      );
      void providerKey;
    }
  });

  it("harvests a substantial canary set from the real evidence", async () => {
    const canaries = await readCanaries();
    // A floor, not a count: the exact figure is a property of the evidence and
    // must not become a second place a new component fails the build.
    assert.ok(canaries.length >= 150, `only ${canaries.length} canaries harvested`);
    // Every canary must be a usable search term.
    for (const canary of canaries) {
      assert.ok(canary.normalized.length >= 12);
      assert.ok(canary.path.length > 0, "a canary carries no provenance for the failure message");
    }
  });

  it("finds none of them in the projected view model", async () => {
    const canaries = await readCanaries();
    const serialized = normalizeForScan(JSON.stringify(model));
    for (const canary of canaries) {
      assert.equal(
        serialized.includes(canary.normalized),
        false,
        `the view model leaked a value from ${canary.path}`,
      );
    }
  });

  it("finds none of them in any rendered page", async () => {
    const canaries = await readCanaries();
    for (const [slug, page] of pages) {
      const haystack = normalizeForScan(page);
      for (const canary of canaries) {
        assert.equal(
          haystack.includes(canary.normalized),
          false,
          `${slug} leaked a value from ${canary.path}`,
        );
      }
    }
  });

  it("would notice a leak: the same harvest finds a planted value", () => {
    // Without this the three assertions above could pass because the harvest
    // is broken rather than because the output is clean.
    const planted = "PLANTED-CANARY internal review note that must never publish";
    const canaries = harvestCanaries([{ pin_maps: [{ reviewed_by: planted }] }], {
      deniedKeys: DENIED_PROVIDER_KEYS,
    });
    assert.equal(canaries.length, 1);
    assert.ok(normalizeForScan(`<p>${planted}</p>`).includes(canaries[0]!.normalized));
  });
});
