import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import { VRMLLoader } from "three/addons/loaders/VRMLLoader.js";
import { Box3, Vector3 } from "three";
import { createCircuitAdapter } from "../adapters/circuit/index.ts";
import { buildModelAssetPlan } from "../adapters/circuit/model-assets.ts";
import { CIRCUIT_EXTERNAL_MODELS } from "../adapters/circuit/selection.ts";
import { PublicationPolicy } from "../core/publication.ts";
import { createComponentReferencesDescriptor, encodeComponentReferencesDescriptor, decodeComponentReferencesDescriptor } from "../core/reference-descriptor.ts";
import { renderRecord } from "../core/render/record.ts";
import { buildRecordIndex } from "../core/render/shared.ts";

describe("external panel CAD publication", () => {
  it("renders the real external model and original download without a PCB footprint", async () => {
    const adapter = createCircuitAdapter();
    const model = await adapter.project({ policy: new PublicationPolicy(adapter.matrix, adapter.selection) });
    const record = model.records.find((record) => record.identity.recordId === "rec-wr11as");
    assert.ok(record);
    assert.equal(record.reference.footprint, null);
    assert.equal(record.reference.externalModel?.name, "WR11AS");
    assert.equal(model.packagePreviews.length, 24);
    const page = renderRecord(record, buildRecordIndex(model)).contents;
    const encoded = /<ComponentReferences descriptor="([0-9a-f]+)"/.exec(page)?.[1];
    assert.ok(encoded);
    const reference = decodeComponentReferencesDescriptor(encoded);
    assert.equal(reference.footprint, null);
    assert.equal(reference.sourceCadUrl, "/assets/component-previews/models/WR11AS.stl");
    assert.equal(reference.document.url, "https://www.nkkswitches.com/pdf/WR.pdf");
  });

  it("preserves source bytes and publishes a mesh at the audited millimetre scale", async () => {
    const plan = await buildModelAssetPlan();
    assert.equal(plan.filter((entry) => entry.kind !== "download").length, 25);
    assert.equal(plan.filter((entry) => entry.kind === "download").length, 1);
    const original = plan.find((entry) => entry.name === "WR11AS.stl");
    const converted = plan.find((entry) => entry.name === "WR11AS.wrl");
    assert.ok(original && converted);
    assert.equal(createHash("sha256").update(await readFile(original.source)).digest("hex"), CIRCUIT_EXTERNAL_MODELS[0].originalSha256);
    const object = new VRMLLoader().parse(await readFile(converted.source, "utf8"), "");
    object.scale.setScalar(2.54);
    object.rotation.x = -Math.PI / 2;
    const size = new Box3().setFromObject(object).getSize(new Vector3());
    for (const [actual, expected] of [[size.x, 24.003], [size.y, 43.2054], [size.z, 40.9956]]) {
      assert.ok(Math.abs(actual! - expected!) < .001);
    }
  });

  it("rejects external/PCB confusion and unsafe or mismatched download paths", () => {
    const base = createComponentReferencesDescriptor({
      document: { label: "Datasheet PDF", title: "WR catalog", authority: "MANUFACTURER_PRIMARY", availability: "AVAILABLE", url: "https://www.nkkswitches.com/pdf/WR.pdf" },
      footprintName: null,
      sourceCadUrl: "/assets/component-previews/models/WR11AS.stl",
      model: { version: 1, kind: "external", packageId: "WR11AS", packageLabel: "WR11AS", modelUrl: "/assets/component-previews/models/WR11AS.wrl", offset: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 2.54, y: 2.54, z: 2.54 } },
    });
    assert.doesNotThrow(() => encodeComponentReferencesDescriptor(base));
    for (const sourceCadUrl of ["https://evil.invalid/WR11AS.stl", "/assets/component-previews/models/other.stl", "/assets/component-previews/models/../WR11AS.stl"]) {
      assert.throws(() => encodeComponentReferencesDescriptor({ ...base, sourceCadUrl }));
    }
    assert.throws(() => encodeComponentReferencesDescriptor({ ...base, footprint: { name: "fake", assetUrl: "/assets/component-previews/footprints/fake.svg" } }));
  });
});
