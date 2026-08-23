/**
 * Hand-authored sources that link into the generated component tree.
 *
 * `core/links.ts` proves the links the GENERATOR emits. It cannot see the other
 * direction, and there are now two of those:
 *
 *   - the BOM, the decisions log and the ratings matrix cite canonical record
 *     pages and fact anchors, and nothing in the generation pipeline reads them;
 *   - each owner bundle's `SKILL.md` carries a "Human component reference"
 *     section linking its own record pages. That closes the two-way path with
 *     the record pages' own link back to `/docs/claude-skills/<bundle>/`, and
 *     it is read from `.claude/` — a tree this feature otherwise only reads
 *     evidence JSON from.
 *
 * Both directions rot the same way. A record slug is a stable published route,
 * but a record ID rename in the evidence would leave these pointing at a page
 * that no longer exists — silently, since a browser does not report a missing
 * fragment and a 404 on an internal link is nobody's build failure. zfb's own
 * `linkValidation` cannot cover the fragments either: it resolves them against
 * heading-derived anchors only, so every `<EvidenceAnchor>` id is invisible to
 * it (see `core/links.ts`).
 *
 * So the check lives here, on the committed files, and fails the suite rather
 * than warning. Deliberately narrow: it validates `/docs/components/` targets
 * and nothing else, because that tree is the only one this feature owns.
 */

import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { describe, it } from "node:test";

import { DOC_ROOT, GENERATED_ROOT, SKILLS_ROOT } from "../adapters/circuit/paths.ts";

const CONTENT_ROOT = join(DOC_ROOT, "src", "content", "docs");

/** The heading every owner bundle's reciprocal link sits under. */
const HUMAN_REFERENCE_HEADING = "## Human component reference";

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

/** Every owner bundle's `SKILL.md`, read-only, from the evidence tree. */
async function ownerSkillFiles(): Promise<string[]> {
  const entries = await readdir(SKILLS_ROOT, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("component-"))
    .filter((entry) => entry.name !== "component-spec-audit")
    .map((entry) => join(SKILLS_ROOT, entry.name, "SKILL.md"));
}

/** Resolve one `/docs/components/…` target; `null` when it lands. */
function unresolved(target: string, byRoute: ReadonlyMap<string, ReadonlySet<string>>): string | null {
  const hash = target.indexOf("#");
  const route = hash === -1 ? target : target.slice(0, hash);
  const fragment = hash === -1 ? null : target.slice(hash + 1);
  const anchors = byRoute.get(route);
  if (anchors === undefined) return "no such generated page";
  if (fragment !== null && !anchors.has(fragment)) return "no such anchor on that page";
  return null;
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
        checked += 1;
        const reason = unresolved(target, byRoute);
        if (reason !== null) broken.push(`${relative(CONTENT_ROOT, path)} → ${target} (${reason})`);
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

describe("owner bundles linking back to their record pages", () => {
  it("gives every owner bundle a human-reference section whose links resolve", async () => {
    const byRoute = await anchorsByRoute();
    const bundles = await ownerSkillFiles();

    // 13 owner bundles cover the 34 records. `component-spec-audit` and
    // `circuit-spec-integration` own none and are correctly excluded — the
    // filter above drops the first by name and the second by prefix.
    assert.equal(bundles.length, 13);

    const broken: string[] = [];
    const missing: string[] = [];
    let recordLinks = 0;
    for (const path of bundles) {
      const contents = await readFile(path, "utf8");
      const name = relative(SKILLS_ROOT, path).split("\\").join("/");
      if (!contents.includes(HUMAN_REFERENCE_HEADING)) {
        missing.push(name);
        continue;
      }
      for (const match of contents.matchAll(COMPONENT_LINK)) {
        const target = match[1] as string;
        if (target.startsWith("/docs/components/records/")) recordLinks += 1;
        const reason = unresolved(target, byRoute);
        if (reason !== null) broken.push(`${name} → ${target} (${reason})`);
      }
    }

    assert.deepEqual(missing, []);
    assert.deepEqual(broken, []);
    // One link per record, across all 13 bundles: the reciprocal of the record
    // pages' own link to their owning bundle, which completes the two-way path.
    assert.equal(recordLinks, 34);
  });

  it("keeps the section in the body, never in the frontmatter block", async () => {
    // `validate.py` parses the frontmatter and enforces the filename; it does
    // not constrain body prose. A section that drifted above the closing `---`
    // would be a contract change, not a documentation edit.
    for (const path of await ownerSkillFiles()) {
      const contents = await readFile(path, "utf8");
      const closing = contents.indexOf("\n---\n", "---\n".length);
      assert.ok(closing > 0, `${path} has no frontmatter block`);
      assert.ok(
        contents.indexOf(HUMAN_REFERENCE_HEADING) > closing,
        `${path} puts the human-reference section inside its frontmatter`,
      );
    }
  });
});
