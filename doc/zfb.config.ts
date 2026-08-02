import { defineConfig } from "zfb/config";
import { zudoDoc } from "@takazudo/zudo-doc/config";

export default defineConfig(
  zudoDoc({
    themePack: "sumi",
    siteName: "zudo-led-lamp",
    githubUrl: "https://github.com/Takazudo/zudo-led-lamp",
    // siteUrl host MUST match the wrangler.toml custom-domain route.
    siteUrl: "https://zudo-led-lamp.takazudomodular.com",
    llmsTxt: true,
    cjkFriendly: true,
    sidebarResizer: true,
    sidebarToggle: true,
    imageEnlarge: true,
    dynamicPageTransition: true,
    docHistory: true,
    // Generated component pages carry their own provenance (source, revision,
    // locator, retrieval date) on the page itself. Git history of the
    // generated MDX would show generator churn, not evidence history, so it is
    // excluded. The first pattern covers /docs/components/ itself (its slug is
    // `components`, not `components/index`), the second everything beneath.
    docHistoryExclude: ["components", "components/**"],
    bodyFootUtilArea: {
      docHistory: true,
      viewSourceLink: false,
    },
    // Registers the MDX components generated component pages reference,
    // without editing the package-owned route stub under pages/.
    chromeBindingsModule: "./src/chrome-bindings.tsx",
    // Publish the REPO-ROOT .claude, not doc/.claude. The component-audit
    // skills that document this circuit live at the repo root; doc/.claude
    // holds only tooling for editing this site and is deliberately unpublished.
    // Both paths resolve against the doc-site project root (doc/), so ".."
    // reaches the repo root. `scanRoot` widens CLAUDE.md discovery only —
    // generated pages still land in doc/src/content/docs (zudolab/zudo-doc#2558).
    claudeResources: {
      claudeDir: "../.claude",
      scanRoot: "..",
    },
    // Generated trees have no translated counterpart and never will — the
    // generators write only into the default-locale content dir. Listing them
    // keeps a future locale from advertising a translation that cannot exist.
    defaultLocaleOnlyPrefixes: [
      "/docs/claude/",
      "/docs/claude-md/",
      "/docs/claude-skills/",
      "/docs/claude-agents/",
      "/docs/claude-commands/",
      "/docs/components/",
    ],
    footer: {
      links: [],
      // The copyright field renders HTML, not markdown — links must be <a> tags.
      copyright:
        'Copyright © 2026 <a href="https://x.com/takazudo">Takazudo</a>. Built with zudo-doc. Enjoy synths on <a href="https://takazudomodular.com/">Takazudo Modular</a>.',
    },
    // Header nav holds only top-level categories, 3-6 items, each categoryMatch
    // a single top-level directory under src/content/docs/ (zudo-doc navigation
    // rules). Ordered as the project reads: intro, the locked design, then the
    // research and ops material behind it.
    headerNav: [
      {
        label: "Getting Started",
        path: "/docs/getting-started",
        categoryMatch: "getting-started",
      },
      {
        label: "Architecture",
        path: "/docs/architecture",
        categoryMatch: "architecture",
      },
      {
        label: "Power",
        path: "/docs/power",
        categoryMatch: "power",
      },
      {
        label: "Research",
        path: "/docs/research",
        categoryMatch: "research",
      },
      {
        label: "How-To",
        path: "/docs/how-to",
        categoryMatch: "how-to",
      },
      // Took the sixth slot from `Claude` rather than adding a seventh — the
      // header is capped at 6. The raw agent-resource routes stay generated,
      // linked and indexed; only their header slot moved. /docs/components/
      // links back to /docs/claude/, and every record page links to its own
      // owning bundle, so the hub is still reachable by navigation.
      {
        label: "Components",
        path: "/docs/components",
        categoryMatch: "components",
      },
    ],
    headerRightItems: [
      {
        type: "component",
        component: "github-link",
      },
      {
        type: "component",
        component: "theme-toggle",
      },
      {
        type: "component",
        component: "search",
      },
      {
        type: "component",
        component: "language-switcher",
      },
    ],
    // Cloudflare Workers adapter — required for the deploy (dist/_worker.js).
    adapter: "@takazudo/zfb-adapter-cloudflare",
  }),
);
