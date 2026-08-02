/**
 * Every filesystem location this adapter is allowed to touch, resolved once.
 *
 * The doc site is a pnpm project rooted at `doc/` with no package.json above
 * it, so every command runs with cwd `doc/` and the repository root is exactly
 * one level up. Resolving from `import.meta.url` rather than `process.cwd()`
 * keeps the paths correct when a test or a watcher runs from elsewhere.
 */

import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** `doc/component-docs/adapters/circuit/` */
const HERE = dirname(fileURLToPath(import.meta.url));

/** `doc/` — the pnpm project root and the cwd of every package script. */
export const DOC_ROOT = resolve(HERE, "..", "..", "..");

/** The repository root. */
export const REPO_ROOT = resolve(DOC_ROOT, "..");

/** The only directory the adapter reads evidence from. */
export const SKILLS_ROOT = join(REPO_ROOT, ".claude", "skills");

export const AUDIT_SKILL = join(SKILLS_ROOT, "component-spec-audit");
export const INVENTORY_FILE = join(AUDIT_SKILL, "references", "inventory.json");
export const SCHEMA_FILE = join(AUDIT_SKILL, "references", "schema.json");
export const VALIDATOR_SCRIPT = join(AUDIT_SKILL, "scripts", "validate.py");

export const INTEGRATION_SKILL = join(SKILLS_ROOT, "circuit-spec-integration");
export const INTEGRATION_RULES_FILE = join(INTEGRATION_SKILL, "references", "rules.json");

/**
 * The exclusively-owned generated tree. Nothing outside it is ever written,
 * and everything inside it is regenerated from evidence.
 */
export const GENERATED_ROOT = join(DOC_ROOT, "src", "content", "docs", "components");

/** Committed, deterministic publication preflight report. */
export const PREFLIGHT_FILE = join(DOC_ROOT, "component-docs", "preflight.json");

/** Per-record bundle files, in the order a record page consumes them. */
export const BUNDLE_FILES = [
  "manifest.json",
  "sources.json",
  "facts.json",
  "coverage.json",
  "routing.json",
  "interactions.json",
  "pin-map.json",
] as const;

export type BundleFile = (typeof BUNDLE_FILES)[number];
