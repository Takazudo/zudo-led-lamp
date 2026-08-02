/** @jsxRuntime automatic */
/** @jsxImportSource preact */

/**
 * Host chrome bindings for zudo-doc.
 *
 * The doc route stub (`pages/docs/[[...slug]].tsx`, package-owned and NOT to be
 * edited) already imports `virtual:zudo-doc-chrome-bindings` and spreads it
 * into `createChrome`. Pointing `chromeBindingsModule` at this file is
 * therefore the supported way to register MDX components without touching any
 * route file.
 *
 * `mdxExtras` entries must stay SSR-presentational: the virtual re-export sits
 * outside zfb's static-import scanner reachability graph, so a client island
 * registered here is not guaranteed to hydrate on injected routes. That suits
 * the component docs, whose static HTML must be complete on its own.
 */

import { defineChromeBindings } from "@takazudo/zudo-doc/chrome-bindings";
import { EvidenceAnchor } from "../component-docs/ui/evidence-anchor";
import { EvidenceDetails } from "../component-docs/ui/evidence-details";
import { EvidenceTable } from "../component-docs/ui/evidence-table";
import { ComponentReferences } from "../component-docs/ui/component-references";
import { PackageModelViewer } from "../component-docs/ui/package-model-viewer";

export const chromeBindings = defineChromeBindings({
  mdxExtras: {
    // Generated component pages only. Every entry in
    // ALLOWED_COMPONENT_ATTRIBUTES (doc/component-docs/core/mdx.ts) must
    // either be registered here or ship globally from @takazudo/zudo-doc
    // (CategoryNav does) — a name the generator emits with neither renders as
    // literal text and silently swallows the content it wraps.
    EvidenceAnchor,
    EvidenceDetails,
    EvidenceTable,
    ComponentReferences,
    PackageModelViewer,
  },
});
