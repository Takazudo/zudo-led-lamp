import { defineConfig } from "zfb/config";
import { zudoDoc } from "@takazudo/zudo-doc/config";

export default defineConfig(
  zudoDoc({
    themePack: "sumi",
    siteName: "Doc",
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
    headerNav: [
      {
        label: "Getting Started",
        path: "/docs/getting-started",
        categoryMatch: "getting-started",
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
