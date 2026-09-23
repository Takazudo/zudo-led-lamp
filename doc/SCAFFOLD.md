# Documentation scaffold maintenance

Baseline: `create-zudo-doc@5.26.5`, released with `@takazudo/zudo-doc@5.26.5`.
The release source is `a88026b51227f65ff6c7c181c69215a23198cd95` in
`zudolab/zudo-doc`. `ZUDO_DEPS_PINS.md` tracks copied files.

## Default feature inventory

| Scaffold feature enabled by default | Site integration |
| --- | --- |
| Search | `search` header item; package search index |
| Sidebar filter | Built into the package sidebar |
| Sidebar resizer | `sidebarResizer: true` |
| Sidebar toggle | `sidebarToggle: true` |
| TOC toggle | `tocToggle: true` |
| Document history | `docHistory: true`, route binding and local history server |
| LLM text exports | `llmsTxt: true` |
| Image enlargement | `imageEnlarge: true` |
| Asset viewer | `assetViewer: true`; package-owned `/files/` routes |
| Dynamic page transitions | `dynamicPageTransition: true` |
| Footer copyright | Existing project attribution |

The theme pack is the package's `default` (no explicit override). Light/dark
mode follows the package default and system preference. This single-locale site
uses GitHub, theme, and search header controls. Asset listing and asset indexing
in search/LLM exports remain off, matching upstream defaults. Files are already
published under `public/assets`; the viewer adds a presentation route.

## Intentional project extensions

- Preserve the site name, domain, navigation and footer attribution.
- Keep CJK handling and repo-root Claude resource publication. The `doc/.claude`
  tooling directory remains outside that publication source.
- Keep the body-foot history strip and component-history exclusions: generated
  component pages carry evidence provenance rather than useful MDX edit history.
- Keep typed MDX bindings and both static preview-island imports in the host doc
  route. The generated route is reconciled, never blindly overwritten.
- Keep component, footprint, model and enclosure generators and their validation
  gates. `component-docs` stays in TypeScript's include list.
- Keep the Cloudflare adapter and deployment configuration, plus dependencies used
  by those extensions. New scaffold dependencies are a minimum, not a removal list.
- Keep the package theme CSS chain and project-specific component styles. The
  upstream base CSS, homepage export and TypeScript aliases require no migration.
- Keep `.zudo-doc/` ignored: this release stages package routes there for nested
  pnpm consumers.

Scaffold scripts use zudo-doc's `run-parallel` to run development services. The
project also starts the component watcher and generates component docs first.
`check:images` is the package image/media validator. `check:links` is the copied
scaffold link checker; existing CI checks remain the authoritative strict checks
for hand-authored routes and generated component references. Diagnostic findings
from a newly adopted checker must be assessed against the pre-upgrade content.

Optional locales, design-token panel, theme switcher, versioning, sitemap, tag
features, Codex publication, and desktop wrappers are not enabled by this refresh.
The reusable circuit documentation foundation is a separate future task.

## Refresh procedure

1. Resolve every `@takazudo/*` dependency on its existing release channel, compare
   published tarballs from lockfile versions, and check peers as a family.
2. Generate a fresh site outside this repository using the exact released
   `create-zudo-doc` version with `--yes --no-install --no-git`.
3. Compare feature defaults, generated config, route stubs, CSS, scripts and
   TypeScript configuration. Reapply the extensions above when reconciling.
4. Install in `doc/`, run the guarded `pnpm b4push`, image/link diagnostics, and
   browser checks covering desktop/mobile, light/dark, preview hydration, TOC,
   search/filtering, history, asset routes and client navigation.
5. Commit regenerated Claude-resource pages together with instruction changes.
   Update the provenance pin only after verification succeeds.

## Known upstream diagnostic

The scaffold link checker exposes a pre-existing TOC slug mismatch for escaped
underscores: a generated heading such as `ABSOLUTE\_MAXIMUM` gets an extra dash
in its TOC href. This is tracked in
[zudo-doc issue 4380](https://github.com/zudolab/zudo-doc/issues/4380).
The migration introduced no new instances. Keep the checker advisory until that
upstream defect is fixed; the existing strict view-model and built-reference
checks remain enabled. Four unrelated authored links found by the checker were
corrected to the actual rendered heading ID.
