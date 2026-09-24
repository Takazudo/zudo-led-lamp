import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { build } from "esbuild";
import { h } from "preact";
import renderToString from "preact-render-to-string";

const compiled = await build({
  entryPoints: [new URL("../ui/evidence-fact.tsx", import.meta.url).pathname],
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
});
const source = compiled.outputFiles[0]?.text;
assert.ok(source);
const { EvidenceFact } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`) as typeof import("../ui/evidence-fact.tsx");

describe("EvidenceFact SSR", () => {
  it("renders all child claims as ordinary visible HTML without interactive markup", () => {
    const html = renderToString(
      h(EvidenceFact, {}, [
        h("p", {}, "Fact: fact-example"),
        h("p", {}, "Conditions: VIN < 40 V"),
        h("p", {}, h("a", { href: "#src-example" }, "src-example: page 1")),
      ]),
    );

    assert.match(html, /^<div class="zld-evidence-fact">/u);
    assert.match(html, /Fact: fact-example/u);
    assert.match(html, /Conditions: VIN &lt; 40 V/u);
    assert.match(html, /<a href="#src-example">src-example: page 1<\/a>/u);
    assert.doesNotMatch(html, /\b(?:tabindex|role|aria-hidden|hidden|onClick)=/iu);
  });
});
