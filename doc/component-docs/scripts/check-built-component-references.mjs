#!/usr/bin/env node

import assert from "node:assert/strict";
import { lstat, readFile, readdir } from "node:fs/promises";
import { basename, extname, join, relative, resolve, sep } from "node:path";

const DIST = resolve("dist");
const RECORDS_ROOT = join(DIST, "docs", "components", "records");
const CATALOG = join(DIST, "docs", "components", "catalog", "index.html");
const PREVIEW_ROOT = join(DIST, "assets", "component-previews");
const FOOTPRINT_ROOT = join(PREVIEW_ROOT, "footprints");
const MODEL_ROOT = join(PREVIEW_ROOT, "models");
const ALLOWED_PDF_LABELS = new Set([
  "Datasheet PDF",
  "Specification PDF",
  "Mechanical drawing PDF",
]);

async function main() {
  const recordDirectories = (await readdir(RECORDS_ROOT, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink())
    .map((entry) => entry.name)
    .sort();
  assert.equal(recordDirectories.length, 35, "built site must contain exactly 35 component record routes");

  const manifest = JSON.parse(await readFile(join(FOOTPRINT_ROOT, "manifest.json"), "utf8"));
  assert.equal(manifest.packages?.length, 24, "built footprint manifest must contain 24 packages");
  const expectedFootprints = new Set(
    manifest.packages.map((entry) => {
      assert.match(entry.assetPath, /^\/assets\/component-previews\/footprints\/[A-Za-z0-9._+-]+\.svg$/u);
      return basename(entry.assetPath);
    }),
  );
  assert.equal(expectedFootprints.size, 24, "built footprint manifest names must be unique");

  const referencedFootprints = new Set();
  const referencedModels = new Set();
  for (const slug of recordDirectories) {
    const html = await readFile(join(RECORDS_ROOT, slug, "index.html"), "utf8");
    if (slug === "wr11as") {
      assert.match(html, /External panel-mounted component/);
      assert.match(html, /https:\/\/www.nkkswitches.com\/pdf\/WR.pdf/);
      assert.match(html, /Datasheet PDF/);
      assert.doesNotMatch(html, /alt="Footprint preview for/);
      const sections = extractReferenceSections(html);
      assert.equal(sections.length, 1);
      const section = sections[0];
      assert.match(section, /Panel component model/);
      assert.match(section, /data-model-url=(?:"|')?\/assets\/component-previews\/models\/WR11AS.wrl/);
      assert.match(section, /PackageModelViewerIsland/);
      assert.match(section, /data-viewer-state=(?:"no-js"|no-js)/);
      assert.match(section, /Download original STL/);
      assert.match(section, /Download KiCad WRL/);
      assert.match(section, /NKK\/CADENAS model/);
      assert.equal((section.match(/data-component-preview-enlarge=/g) ?? []).length, 1);
      assert.equal((section.match(/data-component-preview-dialog=/g) ?? []).length, 1);
      await assertRegularDistFile("/assets/component-previews/models/WR11AS.stl");
      await assertRegularDistFile("/assets/component-previews/models/WR11AS.wrl");
      referencedModels.add("WR11AS.wrl");
      continue;
    }
    const sections = extractReferenceSections(html);
    assert.equal(sections.length, 1, `${slug} must render exactly one Component references section`);
    const section = sections[0];
    assert.ok(section !== undefined);
    assert.ok(
      html.indexOf(section) < html.indexOf("zld-evidence-table"),
      `${slug} must render Component references before evidence tables`,
    );

    const labels = [...section.matchAll(/<p\b[^>]*class=(?:"zld-component-references__document-label"|zld-component-references__document-label)[^>]*>([^<]+)<\/p>/gu)];
    assert.equal(labels.length, 1, `${slug} must render one selected PDF label`);
    const label = decodeHtml(labels[0]?.[1] ?? "");
    assert.ok(ALLOWED_PDF_LABELS.has(label), `${slug} has an unreviewed PDF label: ${label}`);
    const documents = [...section.matchAll(/<p\b[^>]*class=(?:"zld-component-references__document-title"|zld-component-references__document-title)[^>]*>\s*(<a\b[^>]*>)/gu)];
    assert.equal(documents.length, 1, `${slug} must render one selected document destination`);
    const documentUrl = new URL(decodeHtml(readAttribute(documents[0]?.[1] ?? "", "href")));
    assert.ok(documentUrl.protocol === "https:" || documentUrl.protocol === "http:", `${slug} document URL must be HTTP(S)`);

    const footprintImages = [...section.matchAll(/<img\b[^>]*\balt=(?:"Footprint preview for [^"]+"|'Footprint preview for [^']+'|Footprint[^\s>]*)[^>]*>/gu)];
    assert.equal(footprintImages.length, 1, `${slug} must render one footprint preview image`);
    const footprintPath = decodeHtml(readAttribute(footprintImages[0]?.[0] ?? "", "src"));
    assert.match(footprintPath, /^\/assets\/component-previews\/footprints\/[A-Za-z0-9._+-]+\.svg$/u);
    referencedFootprints.add(basename(footprintPath));
    await assertRegularDistFile(footprintPath);
    assert.match(section, /data-footprint-preview-state=(?:"no-js"|no-js)(?:\s|>)/u, `${slug} footprint enhancement must start inert`);
    assert.match(section, /data-zfb-island=(?:"FootprintPreviewIsland"|FootprintPreviewIsland)(?:\s|>)/u, `${slug} must register the footprint island`);
    assert.ok(
      section.includes(`>Open SVG</a>`),
      `${slug} must retain the direct footprint link without JavaScript`,
    );

    const modelTags = section.match(/<[^>]+\bdata-model-url=(?:"[^"]+"|'[^']+'|[^\s>]+)[^>]*>/gu) ?? [];
    const modelPaths = modelTags.map((tag) => decodeHtml(readAttribute(tag, "data-model-url")));
    assert.equal(modelPaths.length, 1, `${slug} must render one selected package model`);
    const modelPath = modelPaths[0] ?? "";
    assert.match(modelPath, /^\/assets\/component-previews\/models\/[A-Za-z0-9._+-]+\.wrl$/u);
    referencedModels.add(basename(modelPath));
    await assertRegularDistFile(modelPath);

    assert.match(section, /data-viewer-state=(?:"no-js"|no-js)(?:\s|>)/u, `${slug} must retain a no-JS viewer state`);
    assert.match(section, /data-model-viewer-instance=(?:"inline"|inline)(?:\s|>)/u, `${slug} must render only the inline model initially`);
    assert.match(section, /data-zfb-island=(?:"PackageModelViewerIsland"|PackageModelViewerIsland)(?:\s|>)/u, `${slug} must register the model island`);

    const enlargeTriggers = section.match(/<button\b[^>]*\bdata-component-preview-enlarge=(?:"[^"]+"|'[^']+'|[^\s>]+)[^>]*>/gu) ?? [];
    assert.equal(enlargeTriggers.length, 2, `${slug} must render footprint and model enlarge controls`);
    assert.deepEqual(
      enlargeTriggers.map((tag) => readAttribute(tag, "data-component-preview-enlarge")).sort(),
      ["footprint", "model"],
      `${slug} enlarge controls must target both preview kinds`,
    );
    for (const tag of enlargeTriggers) {
      assert.match(decodeHtml(readAttribute(tag, "aria-label")), /^Enlarge (?:footprint|3D) preview/u, `${slug} enlarge control needs a specific accessible name`);
    }

    const dialogs = section.match(/<dialog\b[^>]*\bdata-component-preview-dialog=(?:"[^"]+"|'[^']+'|[^\s>]+)[^>]*>/gu) ?? [];
    assert.equal(dialogs.length, 2, `${slug} must render two closed preview dialog shells`);
    assert.deepEqual(
      dialogs.map((tag) => readAttribute(tag, "data-component-preview-dialog")).sort(),
      ["footprint", "model"],
      `${slug} dialog shells must cover both preview kinds`,
    );
    for (const tag of dialogs) {
      const labelId = readAttribute(tag, "aria-labelledby");
      assert.match(section, new RegExp(`\\bid=(?:"${labelId}"|'${labelId}'|${labelId})(?:\\s|>)`, "u"), `${slug} dialog label must resolve`);
    }
    assert.match(
      section,
      /Interactive inspection requires JavaScript and WebGL\. The package identity remains available in this page\./u,
      `${slug} must retain a useful static viewer explanation`,
    );
    assert.match(html, /id=(?:"sources"|sources)(?:\s|>)/u, `${slug} must retain its Sources section`);
  }

  assert.deepEqual([...referencedFootprints].sort(), [...expectedFootprints].sort(), "record pages must use exactly the manifest-selected SVGs");
  assert.equal(referencedModels.size, 25, "record pages must reference 24 PCB WRLs and one external WRL");

  const actualPreviewFiles = await listFiles(PREVIEW_ROOT);
  const expectedPreviewFiles = new Set([
    "footprints/manifest.json",
    "models/WR11AS.stl",
    ...[...expectedFootprints].map((name) => `footprints/${name}`),
    ...[...referencedModels].map((name) => `models/${name}`),
  ]);
  assert.deepEqual(actualPreviewFiles, [...expectedPreviewFiles].sort(), "built preview output contains missing, extra, or unselected assets");
  assert.equal(actualPreviewFiles.filter((path) => extname(path).toLowerCase() === ".svg").length, 24);
  assert.equal(actualPreviewFiles.filter((path) => extname(path).toLowerCase() === ".wrl").length, 25);
  assert.equal(actualPreviewFiles.some((path) => [".step", ".stp"].includes(extname(path).toLowerCase())), false, "STEP must not be browser-published");

  const catalog = await readFile(CATALOG, "utf8");
  assert.doesNotMatch(
    catalog,
    /data-component-model-viewer-root|data-model-url|component-previews\/models\/|data-component-preview-(?:dialog|enlarge)|<canvas\b/u,
    "catalog index must not create or reference live preview UI",
  );

  process.stdout.write("built component references passed: 35 records, 24 SVGs, 25 WRLs, 1 source STL, 0 STEP; catalog viewer-free\n");
}

async function assertRegularDistFile(publicPath) {
  assert.ok(publicPath.startsWith("/"));
  const target = resolve(DIST, publicPath.slice(1));
  const rel = relative(DIST, target);
  assert.ok(rel !== "" && rel !== ".." && !rel.startsWith(`..${sep}`), `asset escapes dist: ${publicPath}`);
  const fileStat = await lstat(target);
  assert.ok(fileStat.isFile() && !fileStat.isSymbolicLink(), `asset is not a regular file: ${publicPath}`);
}

async function listFiles(root, current = root) {
  const files = [];
  for (const entry of await readdir(current, { withFileTypes: true })) {
    assert.equal(entry.isSymbolicLink(), false, `built preview output contains a symlink: ${entry.name}`);
    const path = join(current, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(root, path));
    else if (entry.isFile()) files.push(relative(root, path).split(sep).join("/"));
    else assert.fail(`built preview output contains a non-file entry: ${entry.name}`);
  }
  return files.sort();
}

function decodeHtml(value) {
  return value.replaceAll("&amp;", "&").replaceAll("&quot;", '"').replaceAll("&#39;", "'");
}

function extractReferenceSections(html) {
  const marker = /\bclass=(?:"zld-component-references"|'zld-component-references'|zld-component-references)(?=\s|>)/gu;
  const matches = [...html.matchAll(marker)];
  return matches.map((match) => {
    const markerIndex = match.index ?? -1;
    const start = html.lastIndexOf("<section", markerIndex);
    const end = html.indexOf("</section>", markerIndex);
    assert.ok(start >= 0 && end >= 0, "Component references section markup is incomplete");
    return html.slice(start, end + "</section>".length);
  });
}

function readAttribute(tag, name) {
  assert.match(name, /^[a-z-]+$/u);
  const match = new RegExp(`\\b${name}=(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "u").exec(tag);
  const value = match?.[1] ?? match?.[2] ?? match?.[3];
  assert.notEqual(value, undefined, `missing ${name} attribute in ${tag.slice(0, 160)}`);
  return value;
}

await main();
