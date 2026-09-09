# ZUDO_DEPS_PINS

Provenance for artifacts vendored or generated from first-party (takazudo/zudolab) upstreams.
Updated by /dev-bump-zudo-deps on every sync — keep `pinned:` accurate.

## zudo-doc (doc route stub)
- repo: zudolab/zudo-doc
- what: doc-route stub, scaffolded by create-zudo-doc and hand-adapted (no package.json pin of its own)
- files: doc/pages/docs/[[...slug]].tsx
- source: packages/create-zudo-doc/templates/base/pages/docs/[[...slug]].tsx
- track: releases (create-zudo-doc / zudo-doc are released together from this monorepo)
- pinned: 7c65061b24236643204dda83d2e2d8793adcabfb (v4.4.6 / zudo-doc-v4.4.6)
- updated: 2026-09-10
- notes: (1) two static island imports plus `void FootprintPreviewIsland; void PackageModelViewerIsland;`
  and their explanatory comment, added after scaffold (commit 412f40b/d888a54) so zfb's
  static-import-graph island scanner registers `FootprintPreviewIsland`
  (`doc/src/component-preview/footprint-preview-island`) and `PackageModelViewerIsland`
  (`doc/src/component-model-viewer/package-model-viewer-island`) — re-add these on any
  regenerate/re-copy, they are not part of the upstream template. (2) the file also carries the
  generator's own docHistory-feature patch (static `DocHistory` import merged into `createChrome`'s
  second argument) — this is regenerated automatically whenever create-zudo-doc is re-run with the
  docHistory feature selected, so it needs no manual re-application, but a manual merge that skips
  re-running the generator must reproduce it by hand. No established regenerate command for this
  specific file (it isn't in the eject CLI's ejectable component list — see
  `packages/create-zudo-doc/docs/eject-contract.md`); resync is a manual diff of `pinned` → `latest`
  scoped to the `source:` path above, re-applying both notes.
