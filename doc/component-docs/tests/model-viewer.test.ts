import assert from "node:assert/strict";
import { mkdtemp, readFile, realpath, symlink, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, it } from "node:test";

import { Object3D } from "three";

import { syncModelAssets } from "../adapters/circuit/model-assets.ts";
import { createCircuitAdapter } from "../adapters/circuit/index.ts";
import { PublicationPolicy } from "../core/publication.ts";
import {
  decodeModelDescriptor,
  encodeModelDescriptor,
  MODEL_ASSET_BASE,
  type ModelViewerDescriptor,
} from "../core/model-descriptor.ts";
import { applyModelTransform, createOnDemandInvalidator } from "../../src/component-model-viewer/viewer-runtime.ts";
import { setViewerState } from "../../src/component-model-viewer/viewer-state.ts";

const descriptor: ModelViewerDescriptor = {
  version: 1,
  packageId: "TSSOP-20_L6.5-W4.4-P0.65-LS6.4-BL",
  packageLabel: "TSSOP-20_L6.5-W4.4-P0.65-LS6.4-BL",
  modelUrl: `${MODEL_ASSET_BASE}TSSOP-20_L6.5-W4.4-H1.0-LS6.4-P0.65.wrl`,
  offset: { x: 1, y: -2, z: 3 },
  rotation: { x: 10, y: 20, z: 30 },
  scale: { x: 1, y: 2, z: 3 },
};

const originalRaf = globalThis.requestAnimationFrame;
const originalCancel = globalThis.cancelAnimationFrame;

afterEach(() => {
  globalThis.requestAnimationFrame = originalRaf;
  globalThis.cancelAnimationFrame = originalCancel;
});

describe("model viewer descriptor", () => {
  it("serializes deterministically and round-trips only the closed schema", () => {
    const encoded = encodeModelDescriptor(descriptor);
    assert.match(encoded, /^(?:[0-9a-f]{2})+$/u);
    assert.equal(encoded, encodeModelDescriptor(descriptor));
    assert.deepEqual(decodeModelDescriptor(encoded), descriptor);
    assert.throws(() => decodeModelDescriptor("../model.wrl"));
    assert.throws(() => encodeModelDescriptor({ ...descriptor, modelUrl: "https://evil.invalid/model.wrl" }));
  });

  it("projects 35 records onto 24 safe local package models and preserves rotations", async () => {
    const adapter = createCircuitAdapter();
    const policy = new PublicationPolicy(adapter.matrix, adapter.selection);
    const model = await adapter.project({ policy });
    assert.equal(model.records.length, 35);
    assert.equal(model.packagePreviews.length, 24);
    assert.equal(new Set(model.records.flatMap((record) => record.reference.footprint ? [record.reference.footprint.packageId] : [])).size, 24);
    assert.ok(model.records.some((record) => Object.values(record.reference.footprint?.rotation ?? {}).some((value) => value !== 0)));
  });
});

describe("model asset publication", () => {
  it("copies byte-identically and reports missing, changed, and extra output", async () => {
    const temp = await realpath(await mkdtemp(join(tmpdir(), "zld-model-assets-")));
    const source = join(temp, "source.wrl");
    const output = join(temp, "public");
    await writeFile(source, "#VRML V2.0 utf8\nShape {}\n");
    const plan = [{ name: "source.wrl", source }];

    assert.deepEqual((await syncModelAssets(plan, output, true)).drift, ["missing: source.wrl"]);
    assert.deepEqual((await syncModelAssets(plan, output, false)).written, ["source.wrl"]);
    assert.equal(await readFile(join(output, "source.wrl"), "utf8"), await readFile(source, "utf8"));
    assert.deepEqual((await syncModelAssets(plan, output, true)).drift, []);

    await writeFile(join(output, "source.wrl"), "stale");
    assert.deepEqual((await syncModelAssets(plan, output, true)).drift, ["changed: source.wrl"]);
    await writeFile(join(output, "extra.wrl"), "extra");
    assert.deepEqual((await syncModelAssets(plan, output, true)).drift, ["changed: source.wrl", "extra: extra.wrl"]);
    await assert.rejects(() => syncModelAssets([{ name: "source.step", source }], output, true));

    await unlink(join(output, "source.wrl"));
    await symlink(source, join(output, "source.wrl"));
    await assert.rejects(() => syncModelAssets(plan, output, true));
  });
});

describe("viewer lifecycle helpers", () => {
  it("applies offset, degree rotations, and scale without losing non-zero axes", () => {
    const object = new Object3D();
    applyModelTransform(object, descriptor.offset, descriptor.rotation, descriptor.scale);
    assert.deepEqual(object.position.toArray(), [1, -2, 3]);
    assert.ok(Math.abs(object.rotation.x - Math.PI / 18) < 1e-12);
    assert.ok(Math.abs(object.rotation.z - Math.PI / 6) < 1e-12);
    assert.deepEqual(object.scale.toArray(), [1, 2, 3]);
  });

  it("coalesces invalidations and cancels pending work", () => {
    let nextFrame = 0;
    const callbacks = new Map<number, FrameRequestCallback>();
    globalThis.requestAnimationFrame = (callback) => {
      nextFrame += 1;
      callbacks.set(nextFrame, callback);
      return nextFrame;
    };
    globalThis.cancelAnimationFrame = (id) => void callbacks.delete(id);
    let renders = 0;
    const invalidator = createOnDemandInvalidator(() => renders += 1);
    invalidator.invalidate();
    invalidator.invalidate();
    assert.equal(callbacks.size, 1);
    const first = callbacks.get(1);
    callbacks.delete(1);
    first?.(0);
    assert.equal(renders, 1);
    invalidator.invalidate();
    invalidator.cancel();
    assert.equal(callbacks.size, 0);
  });

  it("keeps fallback copy meaningful for failure states", () => {
    const status = { textContent: "" } as unknown as Element;
    const root = {
      dataset: {} as DOMStringMap,
      querySelector: () => status,
    };
    setViewerState(root, "unavailable", "WebGL is unavailable. The package identity remains available.");
    assert.equal(root.dataset.viewerState, "unavailable");
    assert.match(status.textContent ?? "", /package identity/u);
  });
});
