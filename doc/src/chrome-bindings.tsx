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

export const chromeBindings = defineChromeBindings({
  mdxExtras: {
    // Generated component pages only. Keep this registry in sync with
    // ALLOWED_COMPONENTS in doc/component-docs/core/mdx.ts — a name the
    // generator emits without a binding here renders as literal text.
    EvidenceAnchor,
  },
});
