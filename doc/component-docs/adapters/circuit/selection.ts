/**
 * The committed instance-level publication selection for this circuit.
 *
 * Default-zero means this list, not a filter: a record or source that does not
 * appear here is never read into the view model, whatever the repository makes
 * visible. Every ID is spelled out so that adding a component to the project
 * does NOT silently add a public page — the build keeps working and the new
 * part stays unpublished until someone appends it here.
 *
 * The `expect` counts are the other half of that guarantee, in the opposite
 * direction: if the provider corpus shrinks or grows, generation fails instead
 * of quietly publishing a different set. They are the same corpus figures the
 * epic states (32 records, 81 sources), plus the six cross-component rules —
 * those are not instance-selected, but their number is asserted for the same
 * reason, because a rule appearing or vanishing changes what the integration
 * page claims about the whole design.
 *
 * `linkableSourceIds` is a SEPARATE, narrower opt-in: selecting a source
 * publishes its title, revision, locator and availability; it does not by
 * itself publish an outbound link. Every entry here was checked to be a
 * public `http:`/`https:` document URL.
 */

import type { InstanceSelection } from "../../core/publication.ts";

/**
 * Committed evidence that the selection below was based on content behavior,
 * not URL spelling. This is intentionally not consumed by generation: a docs
 * build must stay offline. Re-auditing means repeating the external retrieval
 * and updating both this artifact and the selection in one review.
 */
export const CIRCUIT_DOCUMENT_VERIFICATION = {
  checkedOn: "2026-08-03",
  expectedContent: "PDF",
  downloadedPdfSourceIds: [
    "src-type-c-primary-drawing", "src-stusb-ds12499", "src-pesd24vs1ub",
    "src-rd-uniroyal-smd-sp-001", "src-umw-ao3401a", "src-high-diode-primary",
    "src-c13585-page", "src-c14663-yageo", "src-c15849-page",
    "src-c25803-uniroyal", "src-c22807-uniroyal", "src-c23179-uniroyal",
    "src-c23162-uniroyal", "src-c21189-uniroyal", "src-c17414-uniroyal",
    "src-c4216-uniroyal", "src-c22775-uniroyal", "src-jst-xh",
    "src-bhfuse-1206", "src-al8860-ds39014", "src-rlp25-spec",
    "src-fxl-series-mirror", "src-ro-ss26-mirror", "src-ap6320x-ds41326",
    "src-fnr-series-mirror", "src-samsung-cl21-product", "src-c492404-drawing",
    "src-c2991196-spec", "src-c13564-current", "src-c210315-spec",
    "src-c2934070-spec",
  ],
  // The official ST URL was independently parsed as the STM32G031x4/x6/x8
  // PDF during the same live audit. It remains separate because curl from the
  // audit host repeatedly hit an HTTP/2 transport error; classifying it from
  // the historical SOURCE UNAVAILABLE label alone would be forbidden.
  officialPdfContentSourceIds: ["src-c529334-ds"],
} as const;

export const CIRCUIT_SELECTION: InstanceSelection = {
  recordIds: [
    // component-type-c-31-m-17
    "rec-type-c-31-m-17", // standalone: TYPE-C-31-M-17
    // component-stusb4500qtr
    "rec-stusb4500qtr", // standalone: STUSB4500QTR
    "rec-pesd24vs1ub", // subordinate: PESD24VS1UB,115
    "rec-rd-0603waf5101t5e", // subordinate: 0603WAF5101T5E
    // component-umw-ao3401a-c347476
    "rec-umw-ao3401a", // standalone: AO3401A
    // component-high-diode-smaj20a-c571370
    "rec-high-diode-smaj20a", // standalone: SMAJ20A
    // component-project-passives
    "rec-c13585", // standalone: CL31A106KBHNNNE
    "rec-c14663", // standalone: CC0603KRX7R9BB104
    "rec-c15849", // standalone: CL10A105KB8NNNC
    "rec-c25803", // standalone: 0603WAF1003T5E
    "rec-c22807", // standalone: 0603WAF1503T5E
    "rec-c23179", // standalone: 0603WAF4700T5E
    "rec-c23162", // standalone: 0603WAF4701T5E
    "rec-c21189", // standalone: 0603WAF0000T5E
    "rec-c17414", // standalone: 0805W8F1002T5E
    "rec-c4216", // standalone: 0603WAF3302T5E
    "rec-c22775", // standalone: 0603WAF1000T5E
    // component-jst-b6b-xh-a
    "rec-jst-b6b-xh-a", // standalone: B6B-XH-A(LF)(SN)
    // component-bhfuse-bsmd1206-075-30v
    "rec-bsmd1206-075-30v", // standalone: BSMD1206-075-30V
    // component-al8860mp-13
    "rec-al8860mp-13", // standalone: AL8860MP-13
    "rec-rlp25feer200", // subordinate: RLP25FEER200
    "rec-fxl0630-330-m", // subordinate: FXL0630-330-M
    "rec-ro-ss26", // subordinate: SS26
    // component-ap63203wu-7
    "rec-ap63203wu-7", // standalone: AP63203WU-7
    "rec-fnr4030s4r7mt", // subordinate: FNR4030S4R7MT
    "rec-cl21a226maqnnne", // subordinate: CL21A226MAQNNNE
    // component-stm32g031f8p6
    "rec-c529334", // standalone: STM32G031F8P6
    "rec-c492404", // subordinate: PZ254V-11-05P
    // component-alps-ec11l1525g01
    "rec-c2991196", // standalone: EC11L1525G01
    // component-murata-ncp18xh103f03rb
    "rec-c13564", // standalone: NCP18XH103F03RB
    // component-honglitronic-hl-am-2835h421w-s1-08-hr3
    "rec-c210315", // standalone: HL-AM-2835H421W-S1-08-HR3
    "rec-c2934070", // subordinate: FRC2512F33R0TS
  ],

  sourceIds: [
    // component-type-c-31-m-17
    "src-type-c-c283540", // rec-type-c-31-m-17
    "src-type-c-primary-page", // rec-type-c-31-m-17
    "src-type-c-primary-drawing", // rec-type-c-31-m-17
    "src-type-c-board-p-generator", // rec-type-c-31-m-17
    // component-stusb4500qtr
    "src-stusb-ds12499", // rec-stusb4500qtr
    "src-stusb-ds12499-ratings", // rec-stusb4500qtr
    "src-stusb-um2650", // rec-stusb4500qtr
    "src-stusb-um2398", // rec-stusb4500qtr  (SOURCE UNAVAILABLE)
    "src-stusb-stsw004", // rec-stusb4500qtr  (SOURCE UNAVAILABLE)
    "src-stusb-ds12499-primary-attempt", // rec-stusb4500qtr  (SOURCE UNAVAILABLE)
    "src-stusb-um2650-primary-attempt", // rec-stusb4500qtr  (SOURCE UNAVAILABLE)
    "src-stusb-board-p-generator", // rec-stusb4500qtr
    "src-pesd24vs1ub", // rec-pesd24vs1ub
    "src-rd-uniroyal-smd-sp-001", // rec-rd-0603waf5101t5e
    "src-rd-board-p-generator", // rec-rd-0603waf5101t5e
    "src-rd-c23186", // rec-rd-0603waf5101t5e  (SOURCE UNAVAILABLE)
    // component-umw-ao3401a-c347476
    "src-umw-ao3401a", // rec-umw-ao3401a
    "src-umw-ao3401a-board-p-generator", // rec-umw-ao3401a
    // component-high-diode-smaj20a-c571370
    "src-high-diode-c571370", // rec-high-diode-smaj20a
    "src-high-diode-primary", // rec-high-diode-smaj20a
    // component-project-passives
    "src-c13585-page", // rec-c13585
    "src-c13585-catalog", // rec-c13585
    "src-c14663-yageo", // rec-c14663
    "src-c14663-generator", // rec-c14663
    "src-c15849-page", // rec-c15849
    "src-c15849-catalog", // rec-c15849
    "src-c25803-uniroyal", // rec-c25803
    "src-c22807-uniroyal", // rec-c22807
    "src-c22807-generator", // rec-c22807
    "src-c23179-uniroyal", // rec-c23179
    "src-c23179-generator", // rec-c23179
    "src-c23162-uniroyal", // rec-c23162
    "src-c21189-uniroyal", // rec-c21189
    "src-c21189-generator", // rec-c21189
    "src-c17414-uniroyal", // rec-c17414
    "src-c17414-generator", // rec-c17414
    "src-c4216-uniroyal", // rec-c4216
    "src-c4216-generator", // rec-c4216
    "src-c22775-uniroyal", // rec-c22775
    "src-c22775-generator", // rec-c22775
    // component-jst-b6b-xh-a
    "src-jst-xh", // rec-jst-b6b-xh-a
    "src-jst-xh-header", // rec-jst-b6b-xh-a
    // component-bhfuse-bsmd1206-075-30v
    "src-bhfuse-1206", // rec-bsmd1206-075-30v
    "src-bhfuse-generator", // rec-bsmd1206-075-30v
    // component-al8860mp-13
    "src-al8860-ds39014", // rec-al8860mp-13
    "src-al8860-generator", // rec-al8860mp-13
    "src-rlp25-spec", // rec-rlp25feer200
    "src-rlp25-generator", // rec-rlp25feer200
    "src-fxl-series-mirror", // rec-fxl0630-330-m
    "src-fxl-generator", // rec-fxl0630-330-m
    "src-fxl-series-official", // rec-fxl0630-330-m
    "src-ro-ss26-mirror", // rec-ro-ss26
    "src-ss26-primary-attempt", // rec-ro-ss26  (SOURCE UNAVAILABLE)
    "src-ss26-generator", // rec-ro-ss26
    // component-ap63203wu-7
    "src-ap6320x-ds41326", // rec-ap63203wu-7
    "src-ap63203-generator", // rec-ap63203wu-7
    "src-fnr-series-mirror", // rec-fnr4030s4r7mt
    "src-fnr-generator", // rec-fnr4030s4r7mt
    "src-fnr-series-official", // rec-fnr4030s4r7mt
    "src-samsung-cl21-product", // rec-cl21a226maqnnne
    "src-cl21-generator", // rec-cl21a226maqnnne
    // component-stm32g031f8p6
    "src-c529334-ds", // rec-c529334  (SOURCE UNAVAILABLE)
    "src-c529334-rm", // rec-c529334  (SOURCE UNAVAILABLE)
    "src-c529334-es", // rec-c529334  (SOURCE UNAVAILABLE)
    "src-c529334-generator", // rec-c529334
    "src-c492404-page", // rec-c492404  (SOURCE UNAVAILABLE)
    "src-c492404-drawing", // rec-c492404
    "src-c492404-generator", // rec-c492404
    // component-alps-ec11l1525g01
    "src-c2991196-spec", // rec-c2991196
    "src-c2991196-page", // rec-c2991196  (SOURCE UNAVAILABLE)
    "src-c2991196-generator", // rec-c2991196
    "src-c2991196-primary-retry", // rec-c2991196  (SOURCE UNAVAILABLE)
    "src-c2991196-encoder-rc", // rec-c2991196
    // component-murata-ncp18xh103f03rb
    "src-c13564-current", // rec-c13564
    "src-c13564-catalog", // rec-c13564
    "src-c13564-generator", // rec-c13564
    // component-honglitronic-hl-am-2835h421w-s1-08-hr3
    "src-c210315-spec", // rec-c210315
    "src-c210315-lcsc", // rec-c210315
    "src-c210315-generator", // rec-c210315
    "src-c2934070-spec", // rec-c2934070
    "src-c2934070-generator", // rec-c2934070
  ],

  // Every selected source is a public http(s) document URL, so all are linkable.
  linkableSourceIds: [
    "src-type-c-c283540",
    "src-type-c-primary-page",
    "src-type-c-primary-drawing",
    "src-type-c-board-p-generator",
    "src-stusb-ds12499",
    "src-stusb-ds12499-ratings",
    "src-stusb-um2650",
    "src-stusb-um2398",
    "src-stusb-stsw004",
    "src-stusb-ds12499-primary-attempt",
    "src-stusb-um2650-primary-attempt",
    "src-stusb-board-p-generator",
    "src-pesd24vs1ub",
    "src-rd-uniroyal-smd-sp-001",
    "src-rd-board-p-generator",
    "src-rd-c23186",
    "src-umw-ao3401a",
    "src-umw-ao3401a-board-p-generator",
    "src-high-diode-c571370",
    "src-high-diode-primary",
    "src-c13585-page",
    "src-c13585-catalog",
    "src-c14663-yageo",
    "src-c14663-generator",
    "src-c15849-page",
    "src-c15849-catalog",
    "src-c25803-uniroyal",
    "src-c22807-uniroyal",
    "src-c22807-generator",
    "src-c23179-uniroyal",
    "src-c23179-generator",
    "src-c23162-uniroyal",
    "src-c21189-uniroyal",
    "src-c21189-generator",
    "src-c17414-uniroyal",
    "src-c17414-generator",
    "src-c4216-uniroyal",
    "src-c4216-generator",
    "src-c22775-uniroyal",
    "src-c22775-generator",
    "src-jst-xh",
    "src-jst-xh-header",
    "src-bhfuse-1206",
    "src-bhfuse-generator",
    "src-al8860-ds39014",
    "src-al8860-generator",
    "src-rlp25-spec",
    "src-rlp25-generator",
    "src-fxl-series-mirror",
    "src-fxl-generator",
    "src-fxl-series-official",
    "src-ro-ss26-mirror",
    "src-ss26-primary-attempt",
    "src-ss26-generator",
    "src-ap6320x-ds41326",
    "src-ap63203-generator",
    "src-fnr-series-mirror",
    "src-fnr-generator",
    "src-fnr-series-official",
    "src-samsung-cl21-product",
    "src-cl21-generator",
    "src-c529334-ds",
    "src-c529334-rm",
    "src-c529334-es",
    "src-c529334-generator",
    "src-c492404-page",
    "src-c492404-drawing",
    "src-c492404-generator",
    "src-c2991196-spec",
    "src-c2991196-page",
    "src-c2991196-generator",
    "src-c2991196-primary-retry",
    "src-c2991196-encoder-rc",
    "src-c13564-current",
    "src-c13564-catalog",
    "src-c13564-generator",
    "src-c210315-spec",
    "src-c210315-lcsc",
    "src-c210315-generator",
    "src-c2934070-spec",
    "src-c2934070-generator",
  ],

  // Audited 2026-08-03 by following each endpoint and inspecting response
  // behavior plus PDF content. URL suffixes and source order were not used as
  // classification: several valid downloads are query/ASHX endpoints, while
  // several .pdf endpoints require redirects or browser-compatible requests.
  // The STM32 entry deliberately retains its evidence availability string;
  // current retrieval reached the PDF even though the historical audit said
  // SOURCE UNAVAILABLE. Normal generation is offline and trusts this committed
  // review decision; it never re-fetches these URLs.
  documentSelections: [
    { recordId: "rec-type-c-31-m-17", sourceId: "src-type-c-primary-drawing", documentKind: "drawing" },
    { recordId: "rec-stusb4500qtr", sourceId: "src-stusb-ds12499", documentKind: "datasheet" },
    { recordId: "rec-pesd24vs1ub", sourceId: "src-pesd24vs1ub", documentKind: "datasheet" },
    { recordId: "rec-rd-0603waf5101t5e", sourceId: "src-rd-uniroyal-smd-sp-001", documentKind: "specification" },
    { recordId: "rec-umw-ao3401a", sourceId: "src-umw-ao3401a", documentKind: "datasheet" },
    { recordId: "rec-high-diode-smaj20a", sourceId: "src-high-diode-primary", documentKind: "datasheet" },
    { recordId: "rec-c13585", sourceId: "src-c13585-page", documentKind: "specification" },
    { recordId: "rec-c14663", sourceId: "src-c14663-yageo", documentKind: "specification" },
    { recordId: "rec-c15849", sourceId: "src-c15849-page", documentKind: "specification" },
    { recordId: "rec-c25803", sourceId: "src-c25803-uniroyal", documentKind: "specification" },
    { recordId: "rec-c22807", sourceId: "src-c22807-uniroyal", documentKind: "specification" },
    { recordId: "rec-c23179", sourceId: "src-c23179-uniroyal", documentKind: "specification" },
    { recordId: "rec-c23162", sourceId: "src-c23162-uniroyal", documentKind: "specification" },
    { recordId: "rec-c21189", sourceId: "src-c21189-uniroyal", documentKind: "specification" },
    { recordId: "rec-c17414", sourceId: "src-c17414-uniroyal", documentKind: "specification" },
    { recordId: "rec-c4216", sourceId: "src-c4216-uniroyal", documentKind: "specification" },
    { recordId: "rec-c22775", sourceId: "src-c22775-uniroyal", documentKind: "specification" },
    { recordId: "rec-jst-b6b-xh-a", sourceId: "src-jst-xh", documentKind: "specification" },
    { recordId: "rec-bsmd1206-075-30v", sourceId: "src-bhfuse-1206", documentKind: "datasheet" },
    { recordId: "rec-al8860mp-13", sourceId: "src-al8860-ds39014", documentKind: "datasheet" },
    { recordId: "rec-rlp25feer200", sourceId: "src-rlp25-spec", documentKind: "specification" },
    { recordId: "rec-fxl0630-330-m", sourceId: "src-fxl-series-mirror", documentKind: "specification" },
    { recordId: "rec-ro-ss26", sourceId: "src-ro-ss26-mirror", documentKind: "datasheet" },
    { recordId: "rec-ap63203wu-7", sourceId: "src-ap6320x-ds41326", documentKind: "datasheet" },
    { recordId: "rec-fnr4030s4r7mt", sourceId: "src-fnr-series-mirror", documentKind: "specification" },
    { recordId: "rec-cl21a226maqnnne", sourceId: "src-samsung-cl21-product", documentKind: "specification" },
    { recordId: "rec-c529334", sourceId: "src-c529334-ds", documentKind: "datasheet" },
    { recordId: "rec-c492404", sourceId: "src-c492404-drawing", documentKind: "drawing" },
    { recordId: "rec-c2991196", sourceId: "src-c2991196-spec", documentKind: "specification" },
    { recordId: "rec-c13564", sourceId: "src-c13564-current", documentKind: "specification" },
    { recordId: "rec-c210315", sourceId: "src-c210315-spec", documentKind: "specification" },
    { recordId: "rec-c2934070", sourceId: "src-c2934070-spec", documentKind: "specification" },
  ],

  expect: {
    records: 32,
    sources: 81,
    integrationRules: 6,
  },
};
