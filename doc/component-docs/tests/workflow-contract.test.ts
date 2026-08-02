import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, it } from "node:test";

import { REPO_ROOT } from "../adapters/circuit/paths.ts";

const WORKFLOWS = ["pr-checks.yml", "main-deploy.yml"] as const;
const REQUIRED_CHECKS = [
  "pnpm check:footprint-previews",
  "pnpm check:models",
  "pnpm check:built-component-references",
  "pnpm test:model-viewer:browser",
] as const;

describe("component-reference workflow contract", () => {
  for (const workflowName of WORKFLOWS) {
    it(`${workflowName} selects every source and runs every production guard`, async () => {
      const source = await readFile(join(REPO_ROOT, ".github", "workflows", workflowName), "utf8");
      const paths = extractWorkflowPaths(source);
      for (const required of [
        "doc/**",
        ".claude/skills/**",
        "CLAUDE.md",
        "**/CLAUDE.md",
        "footprints/**/*.kicad_mod",
        "footprints/**/*.wrl",
        "footprints/**/*.step",
      ]) assert.ok(paths.includes(required), `${workflowName} is missing path filter ${required}`);

      for (const command of REQUIRED_CHECKS) {
        assert.match(source, new RegExp(`run:\\s+${escapeRegExp(command)}(?:\\s|$)`, "u"));
      }

      // Source-only edits must select a workflow that contains the stale-output
      // check for that asset family; generated doc/public changes are already
      // covered by doc/**.
      for (const scenario of [
        ["footprints/kicad/R0603.kicad_mod", "pnpm check:footprint-previews"],
        ["footprints/kicad/zudo-led-lamp.pretty/R0603.kicad_mod", "pnpm check:footprint-previews"],
        ["footprints/kicad/zudo-led-lamp.3dshapes/R0603.wrl", "pnpm check:models"],
        ["footprints/kicad/zudo-led-lamp.3dshapes/R0603.step", "pnpm check:models"],
      ] as const) {
        const [changedPath, expectedCheck] = scenario;
        assert.ok(
          paths.some((pattern) => matchesPathFilter(pattern, changedPath)),
          `${workflowName} does not select source-only change ${changedPath}`,
        );
        assert.ok(source.includes(`run: ${expectedCheck}`));
      }
    });
  }
});

function extractWorkflowPaths(source: string): string[] {
  const lines = source.split(/\r?\n/u);
  const paths: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (!/^ {4}paths:\s*$/u.test(lines[index] ?? "")) continue;
    for (let next = index + 1; next < lines.length; next += 1) {
      const line = lines[next] ?? "";
      if (/^ {0,4}\S/u.test(line)) break;
      const match = /^ {6}-\s+["']?([^"'#]+?)["']?\s*$/u.exec(line);
      if (match?.[1] !== undefined) paths.push(match[1].trim());
    }
  }
  assert.ok(paths.length > 0, "workflow has no parsed path filters");
  return paths;
}

function matchesPathFilter(pattern: string, path: string): boolean {
  let expression = "^";
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    if (character === "*" && pattern[index + 1] === "*") {
      if (pattern[index + 2] === "/") {
        expression += "(?:.*/)?";
        index += 2;
      } else {
        expression += ".*";
        index += 1;
      }
    } else if (character === "*") {
      expression += "[^/]*";
    } else {
      expression += escapeRegExp(character ?? "");
    }
  }
  return new RegExp(`${expression}$`, "u").test(path);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
