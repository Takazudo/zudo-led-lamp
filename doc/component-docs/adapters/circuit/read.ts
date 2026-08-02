/**
 * Contained, symlink-refusing reads of provider JSON.
 *
 * Two rules, both enforced per call rather than per directory:
 *   - the resolved path must live under `.claude/skills/`;
 *   - no component of the path may be a symlink.
 * A symlink inside the evidence tree could otherwise point at `~/.ssh` or at
 * another checkout and the generator would happily publish whatever it found.
 */

import { lstat, readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

import { fail } from "../../core/errors.ts";
import { SKILLS_ROOT } from "./paths.ts";

export async function readProviderJson(path: string): Promise<unknown> {
  const resolved = assertUnderSkillsRoot(path);
  await assertNoSymlinkOnPath(resolved);

  let raw: string;
  try {
    raw = await readFile(resolved, "utf8");
  } catch (error) {
    fail("ADAPTER_CONTRACT", `cannot read provider file`, {
      path: relative(SKILLS_ROOT, resolved).split(sep).join("/"),
      reason: (error as Error).message,
    });
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    fail("ADAPTER_CONTRACT", `provider file is not valid JSON`, {
      path: relative(SKILLS_ROOT, resolved).split(sep).join("/"),
      reason: (error as Error).message,
    });
  }
}

export function assertUnderSkillsRoot(path: string): string {
  const root = resolve(SKILLS_ROOT);
  const resolved = resolve(path);
  const rel = relative(root, resolved);

  if (rel === "" || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    fail("PATH_CONTAINMENT", "provider path escapes the skills root", {
      root,
      path: resolved,
    });
  }
  return resolved;
}

/**
 * Walk from the skills root down to the file, rejecting a symlink at any step.
 * Checking only the leaf would miss a symlinked intermediate directory.
 */
async function assertNoSymlinkOnPath(resolved: string): Promise<void> {
  const root = resolve(SKILLS_ROOT);
  const segments = relative(root, resolved).split(sep).filter(Boolean);

  let current = root;
  for (const segment of segments) {
    current = resolve(current, segment);
    let stats;
    try {
      stats = await lstat(current);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
    if (stats.isSymbolicLink()) {
      fail("PATH_CONTAINMENT", "provider path crosses a symlink", {
        path: relative(root, current).split(sep).join("/"),
      });
    }
  }
}
