/**
 * Hand-authored pages that link into the generated component tree.
 *
 * `core/links.ts` proves the links the GENERATOR emits. It cannot see the other
 * direction: the BOM, the decisions log and the ratings matrix are hand-written
 * MDX that now cite canonical record pages and fact anchors, and nothing in the
 * generation pipeline reads those files.
 *
 * That direction is the one that rots. A fact ID is a stable published anchor,
 * but the evidence bundles are owned elsewhere and a rename there would leave a
 * narrative page pointing at a fragment that no longer exists — silently, since
 * a browser does not report a missing fragment. zfb's own `linkValidation`
 * cannot cover it either: it resolves fragments against heading-derived anchors
 * only, so every `<EvidenceAnchor>` id is invisible to it (see `core/links.ts`).
 *
 * So the check lives here, on the committed files, and fails the suite rather
 * than warning. Deliberately narrow: it validates `/docs/components/` targets
 * and nothing else, because that tree is the only one this feature owns.
 */

import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { describe, it } from "node:test";

import { DOC_ROOT, GENERATED_ROOT } from "../adapters/circuit/paths.ts";

const CONTENT_ROOT = join(DOC_ROOT, "src", "content", "docs");

/** `[label](/docs/components/…)` — the only targets this suite is about. */
const COMPONENT_LINK = /\]\((\/docs\/components\/[^)\s]*)\)/gu;
const EVIDENCE_ANCHOR = /<EvidenceAnchor id="([^"]+)"/gu;

async function mdxFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const found = await Promise.all(
    entries.map(async (entry) => {
      const path = join(root, entry.name);
      if (entry.isDirectory()) return mdxFiles(path);
      return entry.isFile() && entry.name.endsWith(".mdx") ? [path] : [];
    }),
  );
  return found.flat();
}

/** `<generated root>/records/al8860mp-13/index.mdx` → `/docs/components/records/al8860mp-13/`. */
function routeOf(path: string): string {
  const rel = relative(GENERATED_ROOT, path).split("\\").join("/");
  const dir = rel.slice(0, rel.length - "index.mdx".length);
  return `/docs/components/${dir}`;
}

async function anchorsByRoute(): Promise<Map<string, Set<string>>> {
  const pages = await mdxFiles(GENERATED_ROOT);
  const byRoute = new Map<string, Set<string>>();
  for (const path of pages) {
    const contents = await readFile(path, "utf8");
    byRoute.set(
      routeOf(path),
      new Set([...contents.matchAll(EVIDENCE_ANCHOR)].map((match) => match[1] as string)),
    );
  }
  return byRoute;
}

describe("hand-authored pages linking into the generated tree", () => {
  it("resolves every /docs/components/ page and fragment they cite", async () => {
    const byRoute = await anchorsByRoute();
    const authored = (await mdxFiles(CONTENT_ROOT)).filter(
      (path) => !path.startsWith(GENERATED_ROOT),
    );

    const broken: string[] = [];
    let checked = 0;
    for (const path of authored) {
      const contents = await readFile(path, "utf8");
      for (const match of contents.matchAll(COMPONENT_LINK)) {
        const target = match[1] as string;
        const hash = target.indexOf("#");
        const route = hash === -1 ? target : target.slice(0, hash);
        const fragment = hash === -1 ? null : target.slice(hash + 1);
        const anchors = byRoute.get(route);
        checked += 1;

        const where = `${relative(CONTENT_ROOT, path)} → ${target}`;
        if (anchors === undefined) {
          broken.push(`${where} (no such generated page)`);
        } else if (fragment !== null && !anchors.has(fragment)) {
          broken.push(`${where} (no such anchor on that page)`);
        }
      }
    }

    assert.deepEqual(broken, []);
    // A guard against the guard: if the narrative links were ever stripped, an
    // empty sweep would pass silently and this suite would prove nothing.
    assert.ok(checked >= 20, `expected the narrative pages to cite the component tree, saw ${checked}`);
  });

  it("cites the integration rules from the pages that state their conditioned arithmetic", async () => {
    // The three conditioned overages the decisions log and the ratings matrix
    // both describe in prose. Each is published as a calculation with the
    // conditions that keep it honest, and the prose must point at it rather
    // than becoming the second place those numbers live.
    const decisions = await readFile(
      join(CONTENT_ROOT, "architecture", "decisions.mdx"),
      "utf8",
    );
    const ratings = await readFile(join(CONTENT_ROOT, "power", "ratings-matrix.mdx"), "utf8");

    for (const anchor of ["calc-stusb-vdd-clamp-overage", "calc-q1-vds-clamp-overage"]) {
      assert.ok(decisions.includes(anchor), `decisions.mdx does not cite ${anchor}`);
      assert.ok(ratings.includes(anchor), `ratings-matrix.mdx does not cite ${anchor}`);
    }
    assert.ok(decisions.includes("rule-al8860-led-stage"));
    assert.ok(ratings.includes("rule-rail-envelope"));
  });
});
