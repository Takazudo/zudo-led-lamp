import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { ComponentDocsError } from "../core/errors.ts";
import { PublicationPolicy } from "../core/publication.ts";
import { projectIndex, readEvidenceIndex } from "../adapters/circuit/index.ts";
import { CIRCUIT_PUBLICATION_MATRIX } from "../adapters/circuit/matrix.ts";
import { CIRCUIT_DOCUMENT_VERIFICATION, CIRCUIT_SELECTION } from "../adapters/circuit/selection.ts";
import {
  REFERENCE_LIMITS,
  assertReferenceSize,
  assertSafePreviewAssetName,
  assertSameBasenamePair,
  validateVrml,
} from "../adapters/circuit/references.ts";
import type { PublicViewModel } from "../core/view-model.ts";

let model: PublicViewModel;

before(async () => {
  const index = await readEvidenceIndex();
  model = projectIndex(index, new PublicationPolicy(CIRCUIT_PUBLICATION_MATRIX, CIRCUIT_SELECTION));
});

describe("reviewed document shortcuts", () => {
  it("selects exactly one explicit PDF-representing document for all 32 records", () => {
    assert.equal(CIRCUIT_SELECTION.documentSelections.length, 32);
    assert.equal(new Set(CIRCUIT_SELECTION.documentSelections.map((entry) => entry.recordId)).size, 32);
    assert.equal(model.records.length, 32);
    for (const record of model.records) {
      assert.match(record.reference.document.url, /^https?:\/\//u);
      assert.ok(["Datasheet PDF", "Specification PDF", "Mechanical drawing PDF"].includes(record.reference.document.label));
      assert.equal(record.reference.document.sourceId.length > 0, true);
      assert.equal(record.reference.document.documentTitle.length > 0, true);
      assert.equal(record.reference.document.authorityClass.length > 0, true);
      assert.equal(record.reference.document.availability.length > 0, true);
    }
  });

  it("locks one content-based live-verification result for every selected source", () => {
    const verified = [
      ...CIRCUIT_DOCUMENT_VERIFICATION.downloadedPdfSourceIds,
      ...CIRCUIT_DOCUMENT_VERIFICATION.officialPdfContentSourceIds,
    ];
    assert.equal(CIRCUIT_DOCUMENT_VERIFICATION.checkedOn, "2026-08-03");
    assert.equal(CIRCUIT_DOCUMENT_VERIFICATION.expectedContent, "PDF");
    assert.equal(verified.length, 32);
    assert.equal(new Set(verified).size, 32);
    assert.deepEqual(
      [...verified].sort(),
      CIRCUIT_SELECTION.documentSelections.map((entry) => entry.sourceId).sort(),
    );
  });

  it("does not infer kind from suffix or source order", () => {
    const queryDownload = model.records.find((record) => record.identity.recordId === "rec-c13585");
    assert.ok(queryDownload);
    assert.equal(queryDownload.reference.document.documentKind, "specification");
    assert.match(queryDownload.reference.document.url, /download\.do\?/u);
    const drawing = model.records.find((record) => record.identity.recordId === "rec-c492404");
    assert.equal(drawing?.reference.document.label, "Mechanical drawing PDF");
  });

  it("uses the public exact-part PDF for TYPE-C instead of the referer-gated manufacturer asset", () => {
    const typeC = model.records.find((record) => record.identity.recordId === "rec-type-c-31-m-17");
    assert.equal(typeC?.reference.document.sourceId, "src-type-c-c283540");
    assert.equal(typeC?.reference.document.documentKind, "drawing");
    assert.equal(typeC?.reference.document.label, "Mechanical drawing PDF");
    assert.equal(
      typeC?.reference.document.url,
      "https://datasheet.lcsc.com/datasheet/pdf/26d9c5bff410f020782d77a1fd4062b2.pdf?productCode=C283540",
    );
    assert.doesNotMatch(typeC?.reference.document.url ?? "", /thefastfile\.com/u);
  });

  it("retains STM32's audited availability without inventing an exception label", () => {
    const stm = model.records.find((record) => record.identity.recordId === "rec-c529334");
    assert.equal(stm?.reference.document.sourceId, "src-c529334-ds");
    assert.equal(stm?.reference.document.availability, "SOURCE UNAVAILABLE");
    assert.equal(stm?.reference.document.label, "Datasheet PDF");
  });
});

describe("KiCad preview manifest", () => {
  it("maps every record to one descriptor and collapses it to exactly 22 packages", () => {
    assert.equal(model.records.filter((record) => record.reference.footprint.modelPath.endsWith(".wrl")).length, 32);
    assert.equal(model.packagePreviews.length, 22);
    assert.equal(new Set(model.packagePreviews.map((entry) => entry.packageId)).size, 22);
    assert.equal(model.packagePreviews.flatMap((entry) => entry.recordIds).length, 32);
  });

  it("preserves non-zero Z rotations from the footprint", () => {
    const fnr = model.packagePreviews.find((entry) => entry.footprintName === "IND-SMD_L4.0-W4.0_FNR40XXS");
    const r0603 = model.packagePreviews.find((entry) => entry.footprintName === "R0603");
    assert.equal(fnr?.rotation.z, 90);
    assert.equal(r0603?.rotation.z, 270);
  });
});

describe("preview assets fail closed", () => {
  const rejects = (fn: () => void, code: ComponentDocsError["code"]) =>
    assert.throws(fn, (error: unknown) => error instanceof ComponentDocsError && error.code === code);

  it("rejects traversal, absolute and external-looking asset names", () => {
    for (const path of ["../part.wrl", "/tmp/part.wrl", "models/part.wrl", "C:\\part.wrl", "https:part.wrl"]) {
      rejects(() => assertSafePreviewAssetName(path, "rec-hostile"), "PATH_CONTAINMENT");
    }
  });

  it("rejects resource-loading, executable and loader-unsupported VRML nodes", () => {
    for (const payload of [
      "#VRML V2.0 utf8\nInline { url \"https://evil.invalid/model.wrl\" }",
      "#VRML V2.0 utf8\nScript { url \"javascript:alert(1)\" }",
      "#VRML V2.0 utf8\nImageTexture { url \"data:image/png;base64,AA\" }",
      "#VRML V2.0 utf8\nTransform { children [] }",
      "#VRML V2.0 utf8\nShape { url \"relative-model.wrl\" }",
      "#VRML V2.0 utf8\nROUTE A.out TO B.in",
    ]) rejects(() => validateVrml(payload, "rec-hostile", "hostile.wrl"), "PUBLICATION_POLICY");
    rejects(
      () => validateVrml('#VRML V2.0 utf8\nShape { name "../../private/model.wrl" }', "rec-hostile", "hostile.wrl"),
      "PATH_CONTAINMENT",
    );
  });

  it("allows harmless URLs in generator comments but not live nodes", () => {
    assert.doesNotThrow(() => validateVrml("#VRML V2.0 utf8\n# generated by https://example.invalid\nShape { }", "rec-safe", "safe.wrl"));
  });

  it("rejects missing/mismatched format pairs and all size-cap violations", () => {
    rejects(() => assertSameBasenamePair("part.wrl", "other.step", "rec-hostile"), "ADAPTER_CONTRACT");
    rejects(() => assertSameBasenamePair("part.wrl", "part.stp", "rec-hostile"), "ADAPTER_CONTRACT");
    rejects(() => assertReferenceSize("footprint", REFERENCE_LIMITS.footprintBytes + 1, "rec-hostile"), "PUBLICATION_POLICY");
    rejects(() => assertReferenceSize("model", REFERENCE_LIMITS.modelBytes + 1, "rec-hostile"), "PUBLICATION_POLICY");
    rejects(() => assertReferenceSize("aggregate", REFERENCE_LIMITS.aggregateModelBytes + 1, "rec-hostile"), "PUBLICATION_POLICY");
  });
});
