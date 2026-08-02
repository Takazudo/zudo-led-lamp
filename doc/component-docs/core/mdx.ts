/**
 * Safe MDX generation: data to AST to text, then verify the text.
 *
 * Three layers, each of which alone would be insufficient:
 *
 *   1. BUILD  — the only way to construct content is the builders below, which
 *               accept `SafeText`/`SafeUrl` and a closed node vocabulary. There
 *               is no "raw" node type, so a caller cannot inject markup even by
 *               trying.
 *   2. SERIALIZE — `mdast-util-to-markdown` with the MDX and GFM-table
 *               extensions does the escaping. The MDX extension is what
 *               escapes `{` (plain markdown does not care about braces, so
 *               without it every evidence string is a live MDX expression).
 *   3. GUARD  — `assertMdxSafe` re-reads the FINAL file text and fails the
 *               build on anything active that survived. This is the layer that
 *               catches a serializer regression or a construct the extensions
 *               do not know about (`:::` directives are enabled on this site
 *               and are not part of any escaping table).
 */

import { toMarkdown } from "mdast-util-to-markdown";
import { mdxToMarkdown } from "mdast-util-mdx";
import { gfmTableToMarkdown } from "mdast-util-gfm-table";
import type { Nodes, PhrasingContent, RootContent } from "mdast";

import { fail } from "./errors.ts";
import { SLUG_PATTERN, type Anchor } from "./ids.ts";
import type { SafeText } from "./text.ts";
import type { SafeUrl } from "./url.ts";

/**
 * The only MDX components generated pages may reference. Each needs a binding
 * in `doc/src/chrome-bindings.tsx`; an unbound name renders as literal text
 * and would silently swallow content, so the guard rejects anything else.
 */
export const ALLOWED_COMPONENTS: readonly string[] = ["EvidenceAnchor", "CategoryNav"];

/**
 * The only attribute names those components accept, and the pattern every
 * attribute VALUE must match. Evidence text can never reach an attribute:
 * the pattern admits slugs and small integers and nothing else.
 */
export const ALLOWED_ATTRIBUTES: readonly string[] = ["id", "category"];
export const ATTRIBUTE_VALUE_PATTERN = /^[a-z0-9][a-z0-9-]*$/u;

// --- builders --------------------------------------------------------------

export function text(value: SafeText): PhrasingContent {
  return { type: "text", value };
}

/**
 * A single separating space. `safeText` trims, so a caller cannot express
 * "space between these two runs" by padding a string — this builder is how
 * inline runs are spaced.
 */
export function space(): PhrasingContent {
  return { type: "text", value: " " };
}

export function code(value: SafeText): PhrasingContent {
  return { type: "inlineCode", value };
}

export function strong(value: SafeText): PhrasingContent {
  return { type: "strong", children: [{ type: "text", value }] };
}

export function link(url: SafeUrl, label: SafeText): PhrasingContent {
  return { type: "link", url, children: [{ type: "text", value: label }] };
}

export function paragraph(children: readonly PhrasingContent[]): RootContent {
  return { type: "paragraph", children: [...children] };
}

export function heading(depth: 2 | 3 | 4, value: SafeText): RootContent {
  return { type: "heading", depth, children: [{ type: "text", value }] };
}

export function bulletList(items: readonly (readonly PhrasingContent[])[]): RootContent {
  return {
    type: "list",
    ordered: false,
    spread: false,
    children: items.map((item) => ({
      type: "listItem" as const,
      spread: false,
      children: [{ type: "paragraph" as const, children: [...item] }],
    })),
  };
}

/** One table row: an array of cells, each of which is inline content. */
export type TableRow = readonly (readonly PhrasingContent[])[];

export function table(header: readonly SafeText[], rows: readonly TableRow[]): RootContent {
  return {
    type: "table",
    children: [
      {
        type: "tableRow",
        children: header.map((value) => ({
          type: "tableCell" as const,
          children: [{ type: "text" as const, value }],
        })),
      },
      ...rows.map((row) => ({
        type: "tableRow" as const,
        children: row.map((cell) => ({
          type: "tableCell" as const,
          children: [...cell],
        })),
      })),
    ],
  };
}

/** A void JSX element from the whitelist. Attribute values are re-checked here. */
export function component(
  name: (typeof ALLOWED_COMPONENTS)[number],
  attributes: Readonly<Record<string, string>> = {},
): RootContent {
  if (!ALLOWED_COMPONENTS.includes(name)) {
    fail("UNSAFE_MDX", `component ${name} is not on the allow-list`, { name });
  }
  for (const [key, value] of Object.entries(attributes)) {
    if (!ALLOWED_ATTRIBUTES.includes(key)) {
      fail("UNSAFE_MDX", `attribute ${key} is not on the allow-list`, { name, attribute: key });
    }
    if (!ATTRIBUTE_VALUE_PATTERN.test(value)) {
      fail("UNSAFE_MDX", `attribute ${key} has an unpublishable value`, {
        name,
        attribute: key,
        value,
      });
    }
  }
  return {
    type: "mdxJsxFlowElement",
    name,
    attributes: Object.entries(attributes).map(([key, value]) => ({
      type: "mdxJsxAttribute" as const,
      name: key,
      value,
    })),
    children: [],
  } as unknown as RootContent;
}

/** An anchor target that survives heading-text edits. */
export function evidenceAnchor(id: Anchor): RootContent {
  return component("EvidenceAnchor", { id });
}

// --- serialize -------------------------------------------------------------

/**
 * Two constructs the bundled escaping tables do not cover, both only active at
 * the start of a line:
 *
 *   - `:::` opens a remark-directive container. `remark-directive` is a
 *     project dependency and admonitions use it, so evidence text beginning a
 *     line with `:::` would become an admonition. `\:` is a valid CommonMark
 *     backslash escape and renders as a literal colon.
 *   - `import`/`export` as the first token of a line is MDX ESM. Backslash
 *     cannot escape a letter, so `mdast-util-to-markdown` emits a numeric
 *     character reference instead (`&#x69;mport`), which renders as the
 *     original word. The lookahead keeps ordinary words such as "importantly"
 *     untouched.
 */
const PROJECT_UNSAFE = [
  { atBreak: true, character: ":", after: ":" },
  { atBreak: true, character: "i", after: "mport(?:[\\s{*'\"]|$)" },
  { atBreak: true, character: "e", after: "xport(?:[\\s{*'\"]|$)" },
];

export function serializeBody(children: readonly RootContent[]): string {
  const tree: Nodes = { type: "root", children: [...children] };
  return toMarkdown(tree, {
    extensions: [mdxToMarkdown(), gfmTableToMarkdown()],
    unsafe: PROJECT_UNSAFE,
    bullet: "-",
    emphasis: "_",
    strong: "*",
    fence: "`",
    fences: true,
    rule: "-",
    resourceLink: false,
  });
}

// --- guard -----------------------------------------------------------------

/** Opening/closing tag of a whitelisted component, with only allowed attributes. */
const JSX_TAG =
  /^<\/?(?<name>[A-Z][A-Za-z0-9]*)(?<attrs>(?:\s+[a-zA-Z][a-zA-Z0-9]*="[^"<>]*")*)\s*\/?>/u;
const JSX_ATTR = /([a-zA-Z][a-zA-Z0-9]*)="([^"<>]*)"/gu;

/**
 * Verify final MDX file text. `body` excludes the frontmatter block; the
 * caller passes the frontmatter separately so a `---` inside content is always
 * an error rather than an ambiguous second document boundary.
 */
export function assertMdxSafe(body: string, where: string): void {
  const lines = body.split("\n");

  for (const [index, line] of lines.entries()) {
    const at = { file: where, line: index + 1 };

    if (/^\s{0,3}(?:import|export)\s/u.test(line)) {
      fail("UNSAFE_MDX", `${where}:${index + 1}: line begins an MDX import/export`, at);
    }
    if (/^\s{0,3}:::/u.test(line)) {
      fail("UNSAFE_MDX", `${where}:${index + 1}: line opens a directive`, at);
    }
    if (/^\s{0,3}-{3,}\s*$/u.test(line)) {
      fail("UNSAFE_MDX", `${where}:${index + 1}: line looks like a frontmatter fence`, at);
    }
    if (line.includes("<!--")) {
      fail("UNSAFE_MDX", `${where}:${index + 1}: line contains an HTML comment`, at);
    }
  }

  assertNoActiveDelimiters(body, where);
  assertOnlyAllowedJsx(body, where);
}

/**
 * `{` opens an MDX expression and `<` opens JSX/HTML. Either is safe only when
 * backslash-escaped. "Escaped" means preceded by an ODD number of backslashes:
 * `\\<` is an escaped backslash followed by a LIVE `<`.
 */
function assertNoActiveDelimiters(body: string, where: string): void {
  for (let index = 0; index < body.length; index += 1) {
    const character = body[index];
    if (character !== "{" && character !== "<") continue;
    if (isBackslashEscaped(body, index)) continue;
    if (character === "<" && JSX_TAG.test(body.slice(index))) continue;

    fail("UNSAFE_MDX", `${where}: unescaped '${character}' at offset ${index}`, {
      file: where,
      offset: index,
      character,
      context: body.slice(Math.max(0, index - 40), index + 40),
    });
  }
}

function assertOnlyAllowedJsx(body: string, where: string): void {
  for (let index = 0; index < body.length; index += 1) {
    if (body[index] !== "<" || isBackslashEscaped(body, index)) continue;
    const match = JSX_TAG.exec(body.slice(index));
    if (!match?.groups) continue;

    const name = match.groups.name as string;
    if (!ALLOWED_COMPONENTS.includes(name)) {
      fail("UNSAFE_MDX", `${where}: component ${name} is not on the allow-list`, {
        file: where,
        name,
      });
    }
    for (const attribute of (match.groups.attrs ?? "").matchAll(JSX_ATTR)) {
      const [, key = "", value = ""] = attribute;
      if (!ALLOWED_ATTRIBUTES.includes(key)) {
        fail("UNSAFE_MDX", `${where}: attribute ${key} is not on the allow-list`, {
          file: where,
          name,
          attribute: key,
        });
      }
      if (!ATTRIBUTE_VALUE_PATTERN.test(value)) {
        fail("UNSAFE_MDX", `${where}: attribute ${key} has an unpublishable value`, {
          file: where,
          name,
          attribute: key,
          value,
        });
      }
    }
  }
}

function isBackslashEscaped(body: string, index: number): boolean {
  let backslashes = 0;
  for (let cursor = index - 1; cursor >= 0 && body[cursor] === "\\"; cursor -= 1) {
    backslashes += 1;
  }
  return backslashes % 2 === 1;
}

/** Re-exported so page assembly and the guard agree on one anchor pattern. */
export const ANCHOR_PATTERN = SLUG_PATTERN;
