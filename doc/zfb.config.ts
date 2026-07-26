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
    bodyFootUtilArea: {
      docHistory: true,
      viewSourceLink: false,
    },
    claudeResources: {
      claudeDir: ".claude",
    },
    defaultLocaleOnlyPrefixes: [
      "/docs/claude-md/",
      "/docs/claude-skills/",
      "/docs/claude-agents/",
      "/docs/claude-commands/",
    ],
    footer: {
      links: [],
      copyright: "Copyright © 2026 Your Name. Built with zudo-doc.",
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
      {
        label: "Claude",
        path: "/docs/claude",
        categoryMatch: "claude",
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
