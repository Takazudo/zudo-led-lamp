# Doc

Documentation site built with [zudo-doc](https://github.com/zudolab/zudo-doc) — a zfb-based documentation framework with MDX, Tailwind CSS v4, and Preact islands. This project is intentionally minimal: one config file (`zfb.config.ts`) plus markdown content — layout, chrome, and islands all ship from `@takazudo/zudo-doc` in `node_modules`.

## Tech Stack

- **zfb** — documentation build framework
- **MDX** — content format, authored under `src/content/`
- **Tailwind CSS v4** — via `@tailwindcss/vite`
- **Preact** — for interactive islands only (with compat mode for React API)
- **zfb semantic highlighting** — native build-time fenced-code rendering plus lazy `@takazudo/zfb-md-wasm` for HtmlPreview; both emit `hi-*` classes resolved through `--zd-syntax-*` design tokens
- **@takazudo/zudo-doc** — the package that owns everything: layout, chrome, islands, default `@theme` design tokens, and (via `packageOwnedRoutes`, on by default) the doc routes themselves

## Commands

- `pnpm dev` — runs the zfb dev server (port 4321) and the doc-history API server (port 4322) concurrently via zudo-doc’s `run-parallel` (`pnpm dev:zfb` / `pnpm dev:history` individually)
- `pnpm dev:network` — same, but zfb binds `--host 0.0.0.0` for LAN access (`pnpm dev:zfb:network` individually); the doc-history server stays loopback-only and LAN clients reach it through zfb's `/doc-history/*` dev proxy
- **Trusted networks only:** this also serves your git doc-history — including UNPUBLISHED local commits — to anyone on the LAN via the `/doc-history/*` proxy
- Pass zfb-specific flags directly to `pnpm run dev:zfb -- <flags>`. The combined dev command starts the doc-history server and component watcher too.
- `pnpm build` — regenerates public model previews and component docs, then static HTML export to `dist/`
- `pnpm check` — TypeScript type checking (covers `component-docs/` too)
- `pnpm check:images` — validate local image/media references after building
- `pnpm check:anchors` — fail on invalid source and built HTML anchors after building
- `pnpm check:links` — scaffold link diagnostics; strict flags are available via `--help`
- `pnpm preview` — serve the built `dist/`
- `pnpm generate:components` — project `.claude/skills/**` evidence into `src/content/docs/components/`
- `pnpm check:components` — fail if that generated output or `component-docs/preflight.json` is stale
- `pnpm test:components` — the generator's own test suite
- `pnpm generate:footprint-previews` / `pnpm check:footprint-previews` — regenerate with the pinned KiCad container / verify committed SVG previews without Docker
- `pnpm generate:models` / `pnpm check:models` — copy the reviewed selected WRL files into public preview assets / verify their bytes
- `pnpm b4push` — `check` + `test:components` + footprint/model checks + `build` + image/media and anchor validation + `check:components` + both artifact scans; it is the local validation gate, not a deploy command

## Key Directories

```
zfb.config.ts             # THE one config file — zudoDoc({ ...only fields you chose })
pages/
├── index.tsx             # 1-line re-export of the package home route
└── docs/[[...slug]].tsx  # host-owned doc-route stub with static preview-island imports
component-docs/           # component-knowledge projection (see its ARCHITECTURE.md)
├── core/                 # provider-neutral: view model, publication policy, safe MDX
├── adapters/circuit/     # this repo's evidence provider (.claude/skills + validate.py)
├── cli/                  # generate / check / watch entrypoints
└── preflight.json        # committed publication report — regenerate, never hand-edit
public/assets/component-previews/
├── footprints/           # GENERATED, committed SVG previews + manifest
└── models/               # GENERATED, committed reviewed WRL previews
src/
├── chrome-bindings.tsx   # typed primary chrome / named header / MDX bindings
├── content/
│   └── docs/             # MDX content (this project's showcase docs)
│       └── components/   # GENERATED — never hand-edit; owned by component-docs/
└── styles/
    └── global.css        # @import chain + a token-override slot — that's it
```

**`src/content/docs/components/` is exclusively generated.** Edit the evidence under
`.claude/skills/` or the renderers under `component-docs/core/render/`, then run
`pnpm generate:components`. A hand-authored file placed in that tree fails the
generator rather than being deleted. Full contract: `component-docs/ARCHITECTURE.md`.
The footprint SVGs, their manifest, and selected public WRLs are likewise generated
and committed: regenerate them from the reviewed canonical KiCad assets; never edit
them by hand. A component change must explicitly update the selection and its truthful
document kind before any generated page or preview can exist.

`pnpm b4push` completes every credential-free gate. CI runs its extra drift/link
checks and only then performs the credential-gated Cloudflare preview deploy; missing
credentials skip deployment, never validation.

Everything else — layout, header, sidebar, footer, doc chrome, islands, and the default design tokens — lives in `node_modules/@takazudo/zudo-doc`. For supported markup replacement, create `src/chrome-bindings.tsx` with `defineChromeBindings`, set `chromeBindingsModule`, and use the primary `Header` / `Footer` / `Sidebar` / `Toc` / `Breadcrumb` / `DocPager` slots or the named `headerRightComponents` registry. The generated default, locale, and doc-history route shapes already consume the same binding object; do not fork a route stub for presentational customization. `npx zudo-doc eject <component>` only copies source: heed its primary, nested-chrome, or content-layer remediation before expecting the copy to render. Settings you didn't set explicitly in `zfb.config.ts` use the package's documented defaults — hover `zudoDoc`'s `ZudoDocConfig` argument in your editor to see every field and its `@default`.

## Content Conventions

### Frontmatter

- Required: `title` (string)
- Optional: `description`, `sidebar_position` (number), `category`
- Sidebar order is driven by `sidebar_position`

### Admonitions

Available in all MDX files without imports, via directive syntax: `:::note`, `:::tip`, `:::info`, `:::warning`, `:::danger`, `:::caution`, `:::details`. Each accepts an optional **bracketed** title: `:::note[Custom Title]`.

Docusaurus-style `{title="..."}` is **NOT supported**. MDX parses the braces as a JS expression, so it either fails the build with `ReferenceError: title is not defined` or is silently ignored. Always use the bracketed form.

### Headings

Do NOT use h1 (`#`) in doc content — the page title from frontmatter is rendered as h1. Start content headings from h2 (`##`).

### Built-in MDX components

`@takazudo/zudo-doc` ships a few **globally-available MDX components** — usable in any `.mdx` file with **no import**. The seeded `getting-started/index.mdx` already uses one:

- `<CategoryNav category="..." />` — a card-grid list of the pages in a docs category (this is the one seeded into `getting-started/index.mdx`).
- `<CategoryTreeNav category="..." />` — the same listing as a compact nested tree, better for deeper hierarchies.
- `<SiteTreeNavDemo />` — a full-site documentation tree (the MDX-available wrapper of the `SiteTreeNav` island).

Admonitions (above), tabbed content (`<Tabs>` / `<TabItem>`, `<CodeGroup>`), and block math (`<MathBlock>`) work the same way — no import. Full reference: https://zudo-doc.takazudomodular.com/docs/components/

## Scaffold defaults and project extensions

The site follows create-zudo-doc 5.27.0 defaults, including the stock theme pack.
See `SCAFFOLD.md` for the feature inventory, retained extensions, and sync procedure.

- **search** — package-owned full-text search and generated `search-index.json`
- **sidebarFilter**, **sidebarResizer**, **sidebarToggle** — built-in filtering and desktop sidebar controls
- **tocToggle** — show/hide the desktop table of contents
- **docHistory** — document edit history; generated component pages remain excluded
- **llmsTxt** — generates llms.txt for LLM consumption
- **imageEnlarge** — image enlargement
- **assetViewer** — viewer routes under `/files/` for public assets; index and search/LLM indexing retain the upstream off defaults
- **dynamicPageTransition** — client-side page navigation
- **footerCopyright** — the project's existing attribution

Intentional extensions include CJK handling, repo-root Claude resources, the body-foot
history strip, project navigation, Cloudflare adapter, and domain-specific generators,
evidence renderers and preview islands. Optional upstream features stay off unless
listed as an intentional extension. This is a single-locale site, so the header has
no language switcher.
