# ZUDO_DEPS_PINS

Provenance for artifacts vendored or generated from first-party upstreams.
Update pins with the reconciled artifacts only after verification succeeds.

## zudo-doc (doc route stub)
- repo: zudolab/zudo-doc
- what: scaffold-derived host doc route with project preview-island reachability
- files: doc/pages/docs/[[...slug]].tsx
- source: packages/create-zudo-doc/templates/base/pages/docs/[[...slug]].tsx, packages/create-zudo-doc/src/features/doc-history.ts
- track: releases (create-zudo-doc / zudo-doc are released together)
- pinned: a88026b51227f65ff6c7c181c69215a23198cd95 (zudo-doc-v5.26.5)
- updated: 2026-09-24
- sync: generate an external create-zudo-doc@5.26.5 default scaffold with --yes --no-install --no-git, then reconcile this route
- notes: Preserve both static imports and void references for FootprintPreviewIsland and PackageModelViewerIsland; they keep client components reachable by zfb's island scanner. Preserve the scaffold docHistory feature's real DocHistory binding merged over the host chromeBindings. Never overwrite the project's typed MDX bindings or evidence/preview generators. See doc/SCAFFOLD.md for the complete default-feature and extension inventory.

## zudo-doc (link checker)
- repo: zudolab/zudo-doc
- what: default scaffold link diagnostic CLI, copied without modifications
- files: doc/scripts/check-links.js
- source: packages/create-zudo-doc/templates/base/scripts/check-links.js
- track: releases (create-zudo-doc / zudo-doc are released together)
- pinned: a88026b51227f65ff6c7c181c69215a23198cd95 (zudo-doc-v5.26.5)
- updated: 2026-09-24
- notes: Invoked by pnpm check:links; advisory by default. Keep existing strict generated-reference and CI link gates. Escaped-underscore TOC mismatch is tracked upstream in zudolab/zudo-doc issue 4380.
