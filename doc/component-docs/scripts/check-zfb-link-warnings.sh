#!/usr/bin/env bash
set -euo pipefail

# Gate a captured `zfb build` log on link warnings.
#
# ## Why this exists instead of `failOnBroken: true`
#
# zfb's `linkValidation` resolves `#fragment` targets against HEADING-derived
# anchors only. Every anchor the component-docs generator emits is an
# `<EvidenceAnchor>` component id, and all three markup forms were probed
# directly: a heading anchor validates, a raw-HTML `id` warns, an MDX component
# id warns. No markup this generator can emit satisfies the checker, so every
# one of those warnings is false — the links do resolve in the built HTML.
#
# That leaves two obvious options, and both are wrong:
#
#   `failOnBroken: true`   fails every build on thousands of false positives;
#   ignore the log         means a genuinely broken HAND-AUTHORED link never
#                          surfaces, which is the failure mode that matters.
#
# What already covers the generated pages is `assertLinkIntegrity`, which runs
# on the VIEW MODEL inside the pipeline and is fatal there — it does not care
# what markup the renderers emit. That independence is also why the warning
# COUNT carries no signal: wrapping the evidence tables in a component dropped
# it from 4324 to 2536 with no change in link health, because zfb does not
# descend into JSX flow elements. Nothing here gates on a count, or on any
# expected number.
#
# ## What this suppresses, and what it refuses to
#
# Two classes are suppressed:
#
# 1. A same-page `#fragment` reported against a file in the generated tree.
#
# 2. The three progress messages printed by `doc-history-server` through the
#    plugin host: resolved content directory, processing count, and generated
#    history count/timing. zfb labels all plugin stdout as warnings even though
#    these lines are informational. Match only those complete message shapes;
#    any other plugin stdout remains unexpected and fails this gate.
#
# Everything else fails — including a `zfb warn:` line whose SHAPE is not
# recognised. That last part is deliberate: if zfb changes its warning format,
# an unrecognised line has to turn CI red rather than silently switch this gate
# off.
#
# Usage: bash check-zfb-link-warnings.sh <build-log>
#   Locally:  pnpm build 2>&1 | tee /tmp/doc-build.log
#             bash component-docs/scripts/check-zfb-link-warnings.sh /tmp/doc-build.log

LOG="${1:-}"
if [ -z "$LOG" ] || [ ! -f "$LOG" ]; then
  echo "usage: check-zfb-link-warnings.sh <build-log>" >&2
  exit 2
fi

# The generated tree, as it appears in zfb's absolute warning paths.
GENERATED_TREE='/src/content/docs/components/'

WORK="$(mktemp -d "${TMPDIR:-/tmp}/zfb-link-warnings-XXXXXX")"
cleanup() {
  case "$WORK" in
    */zfb-link-warnings-*) rm -rf "$WORK" ;;
    *) echo "refusing to clean an unexpected work path: $WORK" >&2 ;;
  esac
}
trap cleanup EXIT

KNOWN="$WORK/known-false.txt"
KNOWN_PLUGIN_INFO="$WORK/known-false-plugin-info.txt"
UNEXPECTED="$WORK/unexpected.txt"
: >"$KNOWN"
: >"$KNOWN_PLUGIN_INFO"
: >"$UNEXPECTED"

awk -v known="$KNOWN" -v known_plugin_info="$KNOWN_PLUGIN_INFO" \
    -v unexpected="$UNEXPECTED" -v tree="$GENERATED_TREE" '
  BEGIN { prefix = "zfb warn: "; sep = ": broken link: " }
  index($0, prefix) != 1 { next }
  {
    rest = substr($0, length(prefix) + 1)
    at = index(rest, sep)
    if (at > 0) {
      path = substr(rest, 1, at - 1)
      target = substr(rest, at + length(sep))
      if (index(path, tree) > 0 && substr(target, 1, 1) == "#") {
        print > known
        next
      }
    }

    plugin_info = \
      rest ~ /^\[plugin-host stdout\] doc-history-server: content-dir resolved to \/.*\/src\/content\/docs$/ || \
      rest ~ /^\[plugin-host stdout\] Processing default: [0-9]+ files in \/.*\/src\/content\/docs$/ || \
      rest ~ /^\[plugin-host stdout\] Generated [0-9]+ history files in [0-9]+([.][0-9]+)?s$/
    if (plugin_info) {
      print > known_plugin_info
      next
    }

    print > unexpected
  }
' "$LOG"

known_count=$(wc -l <"$KNOWN")
known_plugin_info_count=$(wc -l <"$KNOWN_PLUGIN_INFO")
unexpected_count=$(wc -l <"$UNEXPECTED")

if [ "$unexpected_count" -ne 0 ]; then
  echo "$unexpected_count zfb warning(s) outside the known-false class:" >&2
  cat "$UNEXPECTED" >&2
  if [ -n "${GITHUB_ACTIONS:-}" ]; then
    echo "::error::${unexpected_count} zfb warning(s) are not a known-false class (generated-anchor link or doc-history progress) — a hand-authored link is broken, plugin output changed, or zfb changed its warning format."
  fi
  exit 1
fi

echo "link check: no zfb warning outside the known-false generated-anchor class"
echo "  suppressed  $known_count same-page fragment warning(s) in $GENERATED_TREE"
echo "              (false by construction — zfb resolves fragments against heading"
echo "               anchors only; assertLinkIntegrity proves these fatally on the"
echo "               view model. The count tracks markup choices, not link health.)"
echo "  suppressed  $known_plugin_info_count doc-history progress warning(s)"
echo "              (informational plugin stdout that zfb labels as warnings; only"
echo "               the three complete known message shapes are accepted.)"
if [ "$known_count" -gt 0 ]; then
  echo "  sample:"
  head -5 "$KNOWN" | sed 's/^/    /'
fi
if [ "$known_plugin_info_count" -gt 0 ]; then
  echo "  plugin info sample:"
  head -5 "$KNOWN_PLUGIN_INFO" | sed 's/^/    /'
fi
