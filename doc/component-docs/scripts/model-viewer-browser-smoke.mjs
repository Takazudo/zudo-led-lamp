#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, normalize, resolve, sep } from "node:path";

const DIST = resolve("dist");
const RECORD = "/docs/components/records/al8860mp-13/";
const AWAY = "/docs/components/catalog";
const REPRESENTATIVES = [
  { kind: "passive", path: "/docs/components/records/c22807/", slug: "c22807", identity: "C22807" },
  { kind: "IC", path: RECORD, slug: "al8860mp-13", identity: "AL8860MP-13" },
  { kind: "connector", path: "/docs/components/records/type-c-31-m-17/", slug: "type-c-31-m-17", identity: "TYPE-C-31-M-17" },
  { kind: "unavailable history", path: "/docs/components/records/c529334/", slug: "c529334", identity: "STM32G031F8P6", availability: "SOURCE UNAVAILABLE" },
];
const VIEWPORTS = [1600, 1280, 1024, 390];
const THEMES = ["light", "dark"];
const ALLOWED_PDF_LABELS = ["Datasheet PDF", "Specification PDF", "Mechanical drawing PDF"];
const MIME = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".wrl", "model/vrml"],
  [".wasm", "application/wasm"],
]);

const delay = (milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));

async function main() {
  await stat(join(DIST, "docs", "components", "records", "al8860mp-13", "index.html"));
  await inspectPublishedSearchAndLlm();
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      const relative = normalize(decodeURIComponent(url.pathname)).replace(/^[/\\]+/u, "");
      let file = resolve(DIST, relative);
      if (file !== DIST && !file.startsWith(`${DIST}${sep}`)) throw new Error("path traversal");
      if (url.pathname.endsWith("/") || extname(file) === "") file = join(file, "index.html");
      const bytes = await readFile(file);
      response.writeHead(200, { "content-type": MIME.get(extname(file)) ?? "application/octet-stream" });
      response.end(bytes);
    } catch {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found");
    }
  });
  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("smoke server did not bind TCP");
  const origin = `http://127.0.0.1:${address.port}`;

  const profile = await mkdtemp(join(tmpdir(), "zld-model-viewer-chrome-"));
  const executable = process.env.CHROME_BIN ?? "google-chrome";
  const chrome = spawn(executable, [
    "--headless=new",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--disable-extensions",
    "--enable-unsafe-swiftshader",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });

  try {
    const debuggingPort = await readDebuggingPort(chrome);
    chrome.stderr.resume();
    const targets = await waitForJson(`http://127.0.0.1:${debuggingPort}/json/list`);
    const page = targets.find((target) => target.type === "page");
    if (page?.webSocketDebuggerUrl === undefined) throw new Error("Chrome page target was not available");
    const cdp = await connectCdp(page.webSocketDebuggerUrl);
    try {
      await cdp.send("Page.enable");
      await cdp.send("Runtime.enable");
      await cdp.send("Network.enable");

      let inspected = 0;
      const lightThemeSignatures = new Map();
      for (const width of VIEWPORTS) {
        for (const theme of THEMES) {
          await setViewportAndMedia(cdp, width, theme, false);
          for (const representative of REPRESENTATIVES) {
            await navigate(cdp, origin, representative.path);
            await setDocumentTheme(cdp, theme);
            const report = await inspectReferencePage(cdp, representative, width, theme);
            const signatureKey = `${width}:${representative.kind}`;
            if (theme === "light") lightThemeSignatures.set(signatureKey, report.themeSignature);
            else assertEqual(
              report.themeSignature !== lightThemeSignatures.get(signatureKey),
              true,
              `${representative.kind} ${width} light/dark computed colors differ`,
            );
            inspected += 1;
          }
        }
      }

      await setViewportAndMedia(cdp, 390, "dark", false, 844, 2);
      await navigate(cdp, origin, RECORD);
      await setDocumentTheme(cdp, "dark");
      await revealReadyViewer(cdp);
      await exerciseDialogGeometry(cdp, 390, 844);

      await setViewportAndMedia(cdp, 1600, "light", false);
      await navigate(cdp, origin, RECORD);
      await setDocumentTheme(cdp, "light");
      await revealReadyViewer(cdp);
      await exerciseFootprintDialog(cdp);
      await exerciseModelDialog(cdp);
      await exerciseViewerInteractions(cdp);

      // No continuous animation loop: after interaction/resize settles, the
      // diagnostic render count stays unchanged without input.
      await delay(300);
      const renders = await renderCount(cdp);
      await delay(500);
      assertEqual(await renderCount(cdp), renders, "render-on-demand remains idle");

      await setViewportAndMedia(cdp, 1600, "dark", true);
      assertEqual(await evaluate(cdp, `matchMedia('(prefers-reduced-motion: reduce)').matches`), true, "reduced-motion media active");
      const reducedDurations = await evaluate(cdp, `(() => {
        const target = document.querySelector('[data-model-viewer-viewport]');
        const style = getComputedStyle(target);
        return { animation: style.animationDuration, transition: style.transitionDuration };
      })()`);
      assertDurationAtMost(reducedDurations.animation, 0.001, "reduced-motion animation duration");
      assertDurationAtMost(reducedDurations.transition, 0.001, "reduced-motion transition duration");

      await evaluate(cdp, `document.querySelector('[data-component-preview-enlarge="model"]').click()`);
      await waitFor(cdp, `document.querySelector('[data-model-viewer-instance="dialog"]')?.dataset.viewerState === 'ready'`, 20_000);
      await evaluate(cdp, `
        window.__zldOldViewers = [...document.querySelectorAll('[data-component-model-viewer-root]')];
        window.__zldOldCanvases = window.__zldOldViewers.map((viewer) => viewer.querySelector('canvas'));
        document.querySelector('a[href=${JSON.stringify(AWAY)}]').click();
      `);
      await waitFor(cdp, `location.pathname === ${JSON.stringify(AWAY)}`);
      await waitFor(cdp, `window.__zldOldViewers?.every((viewer) => viewer.dataset.viewerDisposed === 'true')`);
      assertEqual(await evaluate(cdp, `window.__zldOldViewers?.length`), 2, "SPA navigation started with inline and dialog viewers");
      assertEqual(await evaluate(cdp, `window.__zldOldCanvases?.every((canvas) => !canvas?.isConnected)`), true, "inline and dialog canvases detached on SPA swap");

      await evaluate(cdp, "history.back()");
      await waitFor(cdp, `location.pathname === ${JSON.stringify(RECORD)}`);
      await revealReadyViewer(cdp);
      assertEqual(await evaluate(cdp, `document.querySelectorAll('[data-component-model-viewer-root]').length`), 1, "one viewer root after SPA back");
      assertEqual(await evaluate(cdp, `document.querySelectorAll('[data-model-viewer-viewport] canvas').length`), 1, "one canvas after SPA back");
      assertEqual(await evaluate(cdp, `window.__zldOldViewers?.includes(document.querySelector('[data-component-model-viewer-root]'))`), false, "fresh viewer after SPA back");

      await navigate(cdp, origin, `${RECORD}?model-viewer-model=fail`);
      await revealViewer(cdp);
      await waitFor(cdp, `document.querySelector('[data-component-model-viewer-root]')?.dataset.viewerState === 'error'`);
      assertEqual(await evaluate(cdp, `document.querySelectorAll('[data-model-viewer-viewport] canvas').length`), 0, "no canvas after model load failure");
      assertEqual(await evaluate(cdp, `document.querySelector('[data-model-viewer-status]')?.textContent.includes('package reference')`), true, "meaningful model-load fallback");
      assertEqual(await evaluate(cdp, `getComputedStyle(document.querySelector('[data-component-preview-enlarge="model"]')).display`), "none", "model enlarge hidden after model load failure");

      await navigate(cdp, origin, `${RECORD}?model-viewer-webgl=fail`);
      await revealViewer(cdp);
      await waitFor(cdp, `document.querySelector('[data-component-model-viewer-root]')?.dataset.viewerState === 'unavailable'`);
      assertEqual(await evaluate(cdp, `document.querySelectorAll('[data-model-viewer-viewport] canvas').length`), 0, "no canvas after forced WebGL failure");
      assertEqual(await evaluate(cdp, `document.querySelector('[data-model-viewer-status]')?.textContent.includes('WebGL is unavailable')`), true, "meaningful WebGL fallback");
      assertEqual(await evaluate(cdp, `getComputedStyle(document.querySelector('[data-component-preview-enlarge="model"]')).display`), "none", "model enlarge hidden without WebGL");

      await cdp.send("Emulation.setScriptExecutionDisabled", { value: true });
      await navigate(cdp, origin, REPRESENTATIVES[0].path);
      await revealViewer(cdp);
      assertEqual(await evaluate(cdp, `document.querySelector('[data-component-model-viewer-root]')?.dataset.viewerState`), "no-js", "no-JS state retained");
      assertEqual(await evaluate(cdp, `document.querySelectorAll('[data-model-viewer-viewport] canvas').length`), 0, "no canvas without JavaScript");
      assertEqual(await evaluate(cdp, `document.querySelector('[data-model-viewer-status]')?.textContent.includes('requires JavaScript and WebGL')`), true, "no-JS explanation retained");
      await waitFor(cdp, `document.querySelector('.zld-component-references__footprint img')?.complete && document.querySelector('.zld-component-references__footprint img')?.naturalWidth > 0`);
      const noJsPreviews = await evaluate(cdp, `({
        controlsHidden: [...document.querySelectorAll('[data-component-preview-enlarge]')].every((control) => getComputedStyle(control).display === 'none'),
        dialogsClosed: [...document.querySelectorAll('[data-component-preview-dialog]')].every((dialog) => !dialog.open),
        footprintLink: document.querySelector('.zld-component-references__footprint-frame > a')?.href.endsWith('.svg'),
        serverFacts: document.querySelectorAll('.zld-evidence-fact').length,
        serverSources: document.getElementById('sources') !== null,
        documentRow: document.querySelector('.zld-component-references__document') !== null,
        previewStages: document.querySelectorAll('.zld-component-references__preview').length
      })`);
      assertEqual(noJsPreviews.controlsHidden, true, "no-JS enlarge controls hidden");
      assertEqual(noJsPreviews.dialogsClosed, true, "no-JS dialogs closed");
      assertEqual(noJsPreviews.footprintLink, true, "no-JS footprint direct link retained");
      assertEqual(noJsPreviews.serverFacts > 0, true, "no-JS fact content is present in static HTML");
      assertEqual(noJsPreviews.serverSources, true, "no-JS Sources content is present in static HTML");
      assertEqual(noJsPreviews.documentRow, true, "no-JS document row is present in static HTML");
      assertEqual(noJsPreviews.previewStages, 2, "no-JS paired previews are present in static HTML");
      await cdp.send("Emulation.setScriptExecutionDisabled", { value: false });

      await setViewportAndMedia(cdp, 1600, "light", false);
      await navigate(cdp, origin, `${AWAY}/`);
      await delay(500); // wait-ok: this is an intentional absence-window assertion.
      const catalogState = await evaluate(cdp, `({
        viewers: document.querySelectorAll('[data-component-model-viewer-root]').length,
        canvases: document.querySelectorAll('canvas').length,
        previewDialogs: document.querySelectorAll('[data-component-preview-dialog]').length,
        previewTriggers: document.querySelectorAll('[data-component-preview-enlarge]').length,
        modelResources: performance.getEntriesByType('resource').filter((entry) => entry.name.includes('/assets/component-previews/models/')).length,
        modelMarkers: document.documentElement.innerHTML.includes('data-model-url')
      })`);
      assertEqual(catalogState.viewers, 0, "catalog has no viewer root");
      assertEqual(catalogState.canvases, 0, "catalog has no canvas");
      assertEqual(catalogState.previewDialogs, 0, "catalog has no preview dialogs");
      assertEqual(catalogState.previewTriggers, 0, "catalog has no preview triggers");
      assertEqual(catalogState.modelResources, 0, "catalog loads no model resource");
      assertEqual(catalogState.modelMarkers, false, "catalog has no model descriptor");

      process.stdout.write(`component reference browser smoke passed: ${inspected} responsive/theme cases, native shell and TOC, paired references, media-only dialogs, interactions, focus, on-demand idle, SPA cleanup, fallbacks, no-JS, viewer-free catalog\n`);
    } catch (error) {
      const diagnostics = await evaluate(cdp, `({
        href: location.href,
        state: document.querySelector('[data-component-model-viewer-root]')?.dataset.viewerState,
        status: document.querySelector('[data-model-viewer-status]')?.textContent,
        canvases: document.querySelectorAll('[data-model-viewer-viewport] canvas').length,
        readyState: document.readyState,
        marker: document.querySelector('[data-zfb-island="PackageModelViewerIsland"]')?.outerHTML.slice(0, 300),
        bounds: document.querySelector('[data-zfb-island="PackageModelViewerIsland"]')?.getBoundingClientRect().toJSON(),
        scripts: [...document.scripts].map((script) => script.src || 'inline').slice(-10),
        resources: performance.getEntriesByType('resource').map((entry) => entry.name).filter((name) => name.includes('island'))
      })`).catch(() => null);
      throw new Error(`${error.message}; browser diagnostics: ${JSON.stringify(diagnostics)}`, { cause: error });
    } finally {
      cdp.close();
    }
  } finally {
    chrome.kill("SIGTERM");
    await waitForExit(chrome);
    server.close();
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

async function inspectPublishedSearchAndLlm() {
  const entries = JSON.parse(await readFile(join(DIST, "search-index.json"), "utf8"));
  if (!Array.isArray(entries)) throw new Error("built search index is not an array");
  const llmsFull = await readFile(join(DIST, "llms-full.txt"), "utf8");

  for (const representative of REPRESENTATIVES) {
    const searchPath = representative.path.replace(/\/$/u, "");
    const searchEntry = entries.find((entry) => entry.url === searchPath);
    assertEqual(searchEntry !== undefined, true, `${representative.kind} route is in the built search index`);
    assertEqual(
      `${searchEntry.title} ${searchEntry.description}`.toLowerCase().includes(representative.identity.toLowerCase()),
      true,
      `${representative.kind} identity is searchable through title or description`,
    );
    assertEqual(searchEntry.body.length <= 300, true, `${representative.kind} search body respects the 300-character excerpt`);

    const markdown = await readFile(join("src", "content", "docs", "components", "records", representative.slug, "index.mdx"), "utf8");
    const factId = /\*\*Fact:\*\* `([^`]+)`/u.exec(markdown)?.[1];
    const sourceId = /\*\*Source ID:\*\* `([^`]+)`/u.exec(markdown)?.[1];
    const coverageId = /\*\*Coverage ID:\*\* `([^`]+)`/u.exec(markdown)?.[1];
    for (const [label, value] of [["native section heading", "## Documents and package"], ["fact identifier", factId], ["source identifier", sourceId], ["coverage identifier", coverageId]]) {
      assertEqual(typeof value === "string" && value.length > 0, true, `${representative.kind} generated Markdown has a ${label}`);
      assertEqual(llmsFull.includes(value), true, `${representative.kind} LLM export retains its ${label}`);
    }
  }
}

async function setViewportAndMedia(cdp, width, theme, reducedMotion, height = 900, deviceScaleFactor = 1) {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor,
    mobile: false,
    screenWidth: width,
    screenHeight: height,
  });
  await cdp.send("Emulation.setEmulatedMedia", {
    media: "screen",
    features: [
      { name: "prefers-color-scheme", value: theme },
      { name: "prefers-reduced-motion", value: reducedMotion ? "reduce" : "no-preference" },
    ],
  });
}

async function navigate(cdp, origin, path) {
  const target = new URL(path, origin);
  await cdp.send("Page.navigate", { url: target.href });
  await waitFor(cdp, `location.pathname === ${JSON.stringify(target.pathname)} && location.search === ${JSON.stringify(target.search)}`);
  await waitFor(cdp, `document.readyState === 'complete'`);
}

async function setDocumentTheme(cdp, theme) {
  await evaluate(cdp, `(() => {
    document.documentElement.dataset.theme = ${JSON.stringify(theme)};
    document.documentElement.style.colorScheme = ${JSON.stringify(theme)};
  })()`);
  assertEqual(await evaluate(cdp, `document.documentElement.dataset.theme`), theme, `${theme} theme marker`);
  assertEqual(
    await evaluate(cdp, `matchMedia('(prefers-color-scheme: ${theme})').matches`),
    true,
    `${theme} color-scheme media`,
  );
}

async function inspectReferencePage(cdp, representative, width, theme) {
  await waitFor(cdp, `document.querySelector('.zld-component-references') !== null`);
  await evaluate(cdp, `document.querySelector('.zld-component-references').scrollIntoView({ block: 'start' })`);
  await waitFor(cdp, `document.querySelector('.zld-component-references__footprint img')?.complete && document.querySelector('.zld-component-references__footprint img')?.naturalWidth > 0`);
  await revealReadyViewer(cdp);
  const report = await evaluate(cdp, `(() => {
    const section = document.querySelector('.zld-component-references');
    const documentRow = section.querySelector('.zld-component-references__document');
    const documentDetails = documentRow?.firstElementChild;
    const metadataList = documentRow?.querySelector('.zld-component-references__metadata');
    const previews = section.querySelector('.zld-component-references__previews');
    const stages = [...(previews?.querySelectorAll('.zld-component-references__preview') ?? [])];
    const footprintLink = section.querySelector('.zld-component-references__footprint-frame > a');
    const footprintImage = footprintLink.querySelector('img');
    const modelViewport = section.querySelector('[data-model-viewer-viewport]');
    const modelRoot = section.querySelector('[data-component-model-viewer-root]');
    const footprintTrigger = section.querySelector('[data-component-preview-enlarge="footprint"]');
    const modelTrigger = section.querySelector('[data-component-preview-enlarge="model"]');
    const documentLink = section.querySelector('.zld-component-references__document-title a');
    const label = section.querySelector('.zld-component-references__document-label');
    const metadata = [...(metadataList?.querySelectorAll(':scope > div') ?? [])];
    const authority = metadata.find((row) => row.querySelector('dt')?.textContent.trim() === 'Authority')?.querySelector('dd')?.textContent.trim();
    const availability = metadata.find((row) => row.querySelector('dt')?.textContent.trim() === 'Availability')?.querySelector('dd')?.textContent.trim();
    const evidence = document.querySelector('.zld-evidence-fact');
    const rect = (element) => {
      const value = element.getBoundingClientRect();
      return { left: value.left, right: value.right, top: value.top, bottom: value.bottom, width: value.width, height: value.height };
    };
    const sectionRect = rect(section);
    const documentRect = rect(documentRow);
    const documentDetailsRect = rect(documentDetails);
    const metadataRect = rect(metadataList);
    const previewsRect = rect(previews);
    const stageRects = stages.map(rect);
    const footprintRect = rect(footprintLink);
    const imageRect = rect(footprintImage);
    const modelRect = rect(modelViewport);
    const documentStyle = getComputedStyle(documentRow);
    const stageStyle = getComputedStyle(stages[0]);
    const status = section.querySelector('[data-model-viewer-status]');
    const statusStyle = getComputedStyle(status);
    return {
      viewport: { inner: innerWidth, client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth },
      stackedLayoutThreshold: Number.parseFloat(getComputedStyle(document.documentElement).fontSize) * 38,
      sectionRect,
      documentRect,
      documentDetailsRect,
      metadataRect,
      previewsRect,
      stageRects,
      footprintRect,
      imageRect,
      modelRect,
      footprintTrigger: {
        rect: rect(footprintTrigger),
        display: getComputedStyle(footprintTrigger).display,
        label: footprintTrigger.getAttribute('aria-label'),
      },
      modelTrigger: {
        rect: rect(modelTrigger),
        display: getComputedStyle(modelTrigger).display,
        label: modelTrigger.getAttribute('aria-label'),
      },
      dialogs: [...section.querySelectorAll('[data-component-preview-dialog]')].map((dialog) => ({
        kind: dialog.dataset.componentPreviewDialog,
        open: dialog.open,
        accessibleName: dialog.getAttribute('aria-label'),
        hasVisibleTitleReference: dialog.hasAttribute('aria-labelledby'),
      })),
      documentLabel: label?.textContent.trim(),
      documentHref: documentLink?.href,
      authority,
      availability,
      footprintObjectFit: getComputedStyle(footprintImage).objectFit,
      footprintNatural: [footprintImage.naturalWidth, footprintImage.naturalHeight],
      modelUrl: modelRoot?.dataset.modelUrl,
      viewerRoots: section.querySelectorAll('[data-component-model-viewer-root]').length,
      statusVisible: statusStyle.display !== 'none' && statusStyle.visibility !== 'hidden' && Number(statusStyle.opacity) > 0,
      surfaceColorsDistinct: documentStyle.color !== documentStyle.backgroundColor && stageStyle.color !== stageStyle.backgroundColor,
      themeSignature: [getComputedStyle(document.body).color, getComputedStyle(document.body).backgroundColor, documentStyle.color, documentStyle.backgroundColor, stageStyle.backgroundColor].join('|'),
      sectionBeforeEvidence: evidence !== null && Boolean(section.compareDocumentPosition(evidence) & Node.DOCUMENT_POSITION_FOLLOWING),
      sourcesPresent: document.getElementById('sources') !== null,
      theme: document.documentElement.dataset.theme,
      referenceHeadingId: [...document.querySelectorAll('h2')].find((heading) => heading.textContent.trim() === 'Documents and package')?.id,
    };
  })()`);

  assertEqual(report.viewport.inner, width, `${representative.kind} ${width}/${theme} viewport width`);
  assertEqual(report.viewport.scroll <= report.viewport.client + 1, true, `${representative.kind} ${width}/${theme} page overflow`);
  assertEqual(ALLOWED_PDF_LABELS.includes(report.documentLabel), true, `${representative.kind} PDF label`);
  assertEqual(/^https?:\/\//u.test(report.documentHref), true, `${representative.kind} PDF destination`);
  assertEqual(report.authority?.length > 0, true, `${representative.kind} document authority retained`);
  if (representative.availability !== undefined) {
    assertEqual(report.availability, representative.availability, `${representative.kind} availability`);
  }
  assertEqual(report.footprintObjectFit, "contain", `${representative.kind} footprint containment mode`);
  assertEqual(report.footprintNatural.every((value) => value > 0), true, `${representative.kind} footprint loaded`);
  assertEqual(report.viewerRoots, 1, `${representative.kind} viewer root count`);
  assertEqual(report.modelUrl?.endsWith(".wrl"), true, `${representative.kind} selected WRL`);
  assertEqual(report.modelUrl?.toLowerCase().endsWith(".step"), false, `${representative.kind} no STEP URL`);
  assertEqual(report.footprintTrigger.display !== "none", true, `${representative.kind} footprint enlarge visible after hydration`);
  assertEqual(report.modelTrigger.display !== "none", true, `${representative.kind} model enlarge visible when ready`);
  assertEqual(report.footprintTrigger.label.startsWith("Enlarge footprint preview"), true, `${representative.kind} footprint enlarge label`);
  assertEqual(report.modelTrigger.label.startsWith("Enlarge 3D preview"), true, `${representative.kind} model enlarge label`);
  assertEqual(report.dialogs.length, 2, `${representative.kind} closed dialog shell count`);
  assertEqual(report.dialogs.every((dialog) => !dialog.open && dialog.accessibleName?.length > 0 && !dialog.hasVisibleTitleReference), true, `${representative.kind} closed dialogs use media-specific aria-labels`);
  assertEqual(report.statusVisible, true, `${representative.kind} visible status`);
  assertEqual(report.surfaceColorsDistinct, true, `${representative.kind} readable document and preview surfaces`);
  assertEqual(report.sectionBeforeEvidence, true, `${representative.kind} references before evidence`);
  assertEqual(report.sourcesPresent, true, `${representative.kind} Sources retained`);
  assertEqual(report.theme, theme, `${representative.kind} ${theme} theme retained`);
  assertEqual(report.referenceHeadingId?.length > 0, true, `${representative.kind} Documents and package is a native heading`);
  assertContained(report.documentRect, report.sectionRect, `${representative.kind} document row at ${width}/${theme}`);
  assertContained(report.metadataRect, report.documentRect, `${representative.kind} document metadata at ${width}/${theme}`);
  assertContained(report.previewsRect, report.sectionRect, `${representative.kind} paired preview stages at ${width}/${theme}`);
  assertEqual(report.stageRects.length, 2, `${representative.kind} has paired preview stages`);
  for (const [index, stage] of report.stageRects.entries()) {
    assertContained(stage, report.previewsRect, `${representative.kind} preview stage ${index + 1} at ${width}/${theme}`);
  }
  const contentWidth = report.sectionRect.width;
  const stackAtContentWidth = contentWidth <= report.stackedLayoutThreshold;
  const [footprintStage, modelStage] = report.stageRects;
  if (footprintStage === undefined || modelStage === undefined) throw new Error(`${representative.kind} preview stage geometry is missing`);
  if (stackAtContentWidth) {
    assertEqual(Math.abs(footprintStage.left - modelStage.left) <= 1, true, `${representative.kind} preview stages stack at ${width}/${theme}`);
    assertEqual(modelStage.top >= footprintStage.bottom - 1, true, `${representative.kind} stacked stage order at ${width}/${theme}`);
    assertEqual(Math.abs(footprintStage.width - modelStage.width) <= 1, true, `${representative.kind} stacked stages align at ${width}/${theme}`);
  } else {
    assertEqual(Math.abs(footprintStage.top - modelStage.top) <= 1, true, `${representative.kind} preview stages align at ${width}/${theme}`);
    assertEqual(Math.abs(footprintStage.height - modelStage.height) <= 2, true, `${representative.kind} paired stages have equal height at ${width}/${theme}`);
    assertEqual(modelStage.left > footprintStage.left, true, `${representative.kind} previews pair left-to-right at ${width}/${theme}`);
  }
  if (stackAtContentWidth) {
    assertEqual(Math.abs(report.documentDetailsRect.left - report.metadataRect.left) <= 1, true, `${representative.kind} document metadata stacks at ${width}/${theme}`);
    assertEqual(report.metadataRect.top >= report.documentDetailsRect.bottom - 1, true, `${representative.kind} stacked document metadata order at ${width}/${theme}`);
  } else {
    assertEqual(Math.abs(report.documentDetailsRect.top - report.metadataRect.top) <= 1, true, `${representative.kind} document metadata aligns in row at ${width}/${theme}`);
    assertEqual(report.metadataRect.left > report.documentDetailsRect.left, true, `${representative.kind} document metadata occupies second column at ${width}/${theme}`);
  }
  assertContained(report.footprintRect, footprintStage, `${representative.kind} footprint at ${width}/${theme}`);
  assertContained(report.imageRect, report.footprintRect, `${representative.kind} footprint image at ${width}/${theme}`);
  assertContained(report.modelRect, modelStage, `${representative.kind} model viewport at ${width}/${theme}`);
  assertContained(report.footprintTrigger.rect, report.footprintRect, `${representative.kind} footprint enlarge at ${width}/${theme}`);
  assertContained(report.modelTrigger.rect, report.modelRect, `${representative.kind} model enlarge at ${width}/${theme}`);
  assertEqual(report.footprintTrigger.rect.width >= 44 && report.footprintTrigger.rect.height >= 44, true, `${representative.kind} footprint target size`);
  assertEqual(report.modelTrigger.rect.width >= 44 && report.modelTrigger.rect.height >= 44, true, `${representative.kind} model target size`);
  await inspectNativeShell(cdp, representative, width, report.referenceHeadingId);

  const loaded = await evaluate(cdp, `({
    canvases: document.querySelectorAll('[data-model-viewer-viewport] canvas').length,
    ready: document.querySelector('[data-model-viewer-status]')?.textContent.includes('ready'),
    modelResources: performance.getEntriesByType('resource').map((entry) => entry.name).filter((name) => name.includes('/assets/component-previews/models/'))
  })`);
  assertEqual(loaded.canvases, 1, `${representative.kind} canvas after load`);
  assertEqual(loaded.ready, true, `${representative.kind} ready status`);
  assertEqual(loaded.modelResources.length >= 1, true, `${representative.kind} model requested`);
  assertEqual(loaded.modelResources.every((url) => url.endsWith(".wrl")), true, `${representative.kind} only WRL requested`);
  return report;
}

async function inspectNativeShell(cdp, representative, width, headingId) {
  const shell = await evaluate(cdp, `(() => {
    const visible = (element) => element !== null && getComputedStyle(element).display !== 'none' && getComputedStyle(element).visibility !== 'hidden';
    const heading = document.getElementById(${JSON.stringify(headingId)});
    const desktopToc = document.querySelector('nav[data-zd-toc]');
    const mobileToc = document.querySelector('[data-zd-mobile-toc]');
    const tocLinks = [...document.querySelectorAll('nav[data-zd-toc] a, [data-zd-mobile-toc] a')];
    return {
      header: visible(document.querySelector('header[data-header]')),
      main: document.querySelector('main') !== null,
      heading: heading?.tagName === 'H2' && heading.textContent.trim() === 'Documents and package',
      tocTarget: heading !== null && tocLinks.some((link) => link.getAttribute('href') === '#' + heading.id),
      desktopSidebarVisible: visible(document.querySelector('#desktop-sidebar')),
      desktopTocVisible: visible(desktopToc),
      mobileTocVisible: visible(mobileToc),
      mobileTocLabel: mobileToc?.querySelector('button')?.textContent.trim(),
      mobileSidebarToggleVisible: visible(document.querySelector('header button[aria-label="Open sidebar"]')),
    };
  })()`);
  assertEqual(shell.header, true, `${representative.kind} package header at ${width}px`);
  assertEqual(shell.main, true, `${representative.kind} native main at ${width}px`);
  assertEqual(shell.heading, true, `${representative.kind} heading target is native h2 at ${width}px`);
  assertEqual(shell.tocTarget, true, `${representative.kind} native TOC links to Documents and package at ${width}px`);
  assertEqual(shell.desktopSidebarVisible, width >= 1024, `${representative.kind} desktop sidebar breakpoint at ${width}px`);
  assertEqual(shell.desktopTocVisible, width >= 1280, `${representative.kind} desktop TOC breakpoint at ${width}px`);
  assertEqual(shell.mobileTocVisible, width < 1280, `${representative.kind} mobile On this page breakpoint at ${width}px`);

  if (width < 1280) {
    assertEqual(shell.mobileTocLabel?.includes('On this page'), true, `${representative.kind} mobile TOC label at ${width}px`);
    const mobileTocButton = '[data-zd-mobile-toc] button';
    await evaluate(cdp, `document.querySelector(${JSON.stringify(mobileTocButton)}).click()`);
    await waitFor(cdp, `document.querySelector('[data-zd-mobile-toc] button')?.getAttribute('aria-expanded') === 'true'`);
    await waitFor(cdp, `document.querySelector('[data-zd-mobile-toc] ul')?.getAttribute('aria-hidden') === 'false'`);
    await evaluate(cdp, `document.querySelector(${JSON.stringify(mobileTocButton)}).click()`);
    await waitFor(cdp, `document.querySelector('[data-zd-mobile-toc] button')?.getAttribute('aria-expanded') === 'false'`);
  }

  if (width < 1024) {
    assertEqual(shell.mobileSidebarToggleVisible, true, `${representative.kind} mobile sidebar control at ${width}px`);
    await evaluate(cdp, `document.querySelector('header button[aria-label="Open sidebar"]').click()`);
    await waitFor(cdp, `document.querySelector('header button[aria-label="Close sidebar"]')?.getAttribute('aria-expanded') === 'true'`);
    await waitFor(cdp, `document.querySelector('[data-zd-mobile-sidebar]')?.getBoundingClientRect().right > 1`);
    await evaluate(cdp, `document.querySelector('header button[aria-label="Close sidebar"]').click()`);
    await waitFor(cdp, `document.querySelector('header button[aria-label="Open sidebar"]')?.getAttribute('aria-expanded') === 'false'`);
  }
}

async function revealReadyViewer(cdp) {
  await revealViewer(cdp);
  await waitFor(cdp, `document.querySelector('[data-component-model-viewer-root]')?.dataset.viewerState === 'ready'`, 20_000);
  assertEqual(await evaluate(cdp, `document.querySelectorAll('[data-component-model-viewer-root]').length`), 1, "one viewer root after load");
  assertEqual(await evaluate(cdp, `document.querySelectorAll('[data-model-viewer-viewport] canvas').length`), 1, "one canvas after load");
}

async function exerciseDialogGeometry(cdp, width, height) {
  for (const kind of ["footprint", "model"]) {
    const triggerSelector = `[data-component-preview-enlarge="${kind}"]`;
    const dialogSelector = `[data-component-preview-dialog="${kind}"]`;
    await waitFor(cdp, `getComputedStyle(document.querySelector(${JSON.stringify(triggerSelector)})).display !== 'none'`);
    if (kind === "model") {
      await evaluate(cdp, `(() => {
        window.__zldDialogReadyRenderCount = null;
        const observer = new MutationObserver(() => {
          const root = document.querySelector('[data-model-viewer-instance="dialog"]');
          if (root?.dataset.viewerState !== 'ready') return;
          window.__zldDialogReadyRenderCount = Number(root.dataset.renderCount ?? 0);
          observer.disconnect();
        });
        observer.observe(document.querySelector(${JSON.stringify(dialogSelector)}), {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: ['data-viewer-state'],
        });
      })()`);
    }
    await evaluate(cdp, `document.querySelector(${JSON.stringify(triggerSelector)}).click()`);
    await waitFor(cdp, `document.querySelector(${JSON.stringify(dialogSelector)})?.open`);
    if (kind === "model") {
      await waitFor(cdp, `document.querySelector('[data-model-viewer-instance="dialog"]')?.dataset.viewerState === 'ready'`, 20_000);
      await waitFor(cdp, `window.__zldDialogReadyRenderCount !== null`);
      assertEqual(await evaluate(cdp, `window.__zldDialogReadyRenderCount > 0`), true, "model ready state is published after its first render");
      await waitForCanvasSize(cdp, "dialog");
    }

    const report = await evaluate(cdp, `(() => {
      const dialog = document.querySelector(${JSON.stringify(dialogSelector)});
      const close = dialog.querySelector('.zld-preview-dialog__close');
      const content = dialog.querySelector('.zld-preview-dialog__content');
      const rect = (element) => {
        const value = element.getBoundingClientRect();
        return { left: value.left, right: value.right, top: value.top, bottom: value.bottom, width: value.width, height: value.height };
      };
      const image = dialog.querySelector('img');
      const modelViewport = dialog.querySelector('[data-model-viewer-viewport]');
      const canvas = modelViewport?.querySelector('canvas');
      const status = dialog.querySelector('.zld-model-viewer__status');
      const visibleCopy = [...dialog.querySelectorAll('h1,h2,h3,h4,h5,h6,p,figcaption,a,button')]
        .filter((element) => {
          const style = getComputedStyle(element);
          const bounds = element.getBoundingClientRect();
          const clippedVisually = style.position === 'absolute' && bounds.width <= 1 && bounds.height <= 1 && style.clipPath !== 'none';
          return element.textContent.trim() !== '' && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0 && !clippedVisually;
        })
        .map((element) => element.textContent.trim());
      return {
        modal: dialog.matches(':modal'),
        accessibleName: dialog.getAttribute('aria-label'),
        hasVisibleTitleReference: dialog.hasAttribute('aria-labelledby'),
        closeLabel: close.getAttribute('aria-label'),
        closeVisibleText: close.textContent.trim(),
        closeIconHidden: close.querySelector('svg')?.getAttribute('aria-hidden') === 'true',
        visibleCopy,
        forbiddenVisibleContent: dialog.querySelector('.zld-preview-dialog__title,.zld-model-viewer__caption,.zld-model-viewer__notice,[data-preview-instructions]') !== null,
        statusVisuallyHidden: status === null || (() => {
          const style = getComputedStyle(status);
          const bounds = status.getBoundingClientRect();
          return style.position === 'absolute' && bounds.width <= 1 && bounds.height <= 1 && style.clipPath !== 'none';
        })(),
        viewport: { width: innerWidth, height: innerHeight },
        pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        dialogOverflow: dialog.scrollWidth > dialog.clientWidth + 1,
        dialog: rect(dialog),
        close: rect(close),
        content: rect(content),
        image: image ? { rect: rect(image), objectFit: getComputedStyle(image).objectFit } : null,
        model: modelViewport && canvas ? {
          viewport: rect(modelViewport),
          clientWidth: modelViewport.clientWidth,
          clientHeight: modelViewport.clientHeight,
          canvas: rect(canvas),
          pixelWidth: canvas.width,
          pixelHeight: canvas.height,
          ratio: devicePixelRatio,
        } : null,
      };
    })()`);
    const viewportRect = { left: 0, top: 0, right: report.viewport.width, bottom: report.viewport.height, width: report.viewport.width, height: report.viewport.height };
    assertEqual(Math.round(report.viewport.width), width, `${kind} dialog visual viewport width`);
    assertEqual(Math.round(report.viewport.height), height, `${kind} dialog visual viewport height`);
    assertEqual(report.modal, true, `${kind} dialog is in the native modal top layer`);
    assertEqual(/^(?:Footprint preview for|Interactive 3D view of) /u.test(report.accessibleName ?? ""), true, `${kind} dialog has a media-specific aria-label`);
    assertEqual(report.hasVisibleTitleReference, false, `${kind} dialog does not reference a removed visible title`);
    assertEqual(report.closeLabel?.startsWith("Close enlarged "), true, `${kind} dialog icon close has an accessible name`);
    assertEqual(report.closeVisibleText, "", `${kind} dialog close control has no visible text`);
    assertEqual(report.closeIconHidden, true, `${kind} dialog close icon is decorative`);
    assertEqual(report.visibleCopy.length, 0, `${kind} dialog contains no visible captions, status, instructions, or caveats`);
    assertEqual(report.forbiddenVisibleContent, false, `${kind} dialog excludes visible titles, captions, and package notices`);
    assertEqual(report.statusVisuallyHidden, true, `${kind} dialog keeps model status nonvisual`);
    assertEqual(await evaluate(cdp, `document.querySelectorAll('dialog[open]').length`), 1, `${kind} dialog is the only active modal`);
    assertEqual(report.pageOverflow, false, `${kind} dialog causes no page overflow`);
    assertEqual(report.dialogOverflow, false, `${kind} dialog causes no internal horizontal overflow`);
    assertEqual(await evaluate(cdp, `getComputedStyle(document.documentElement).overflowY`), "hidden", `${kind} dialog locks background scrolling`);
    const scrollY = await evaluate(cdp, "window.scrollY");
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: 0, y: Math.round(height / 2), deltaX: 0, deltaY: 600 });
    await delay(100);
    assertEqual(Math.round(await evaluate(cdp, "window.scrollY")), Math.round(scrollY), `${kind} backdrop wheel leaves page scroll unchanged`);
    assertContained(report.dialog, viewportRect, `${kind} dialog at ${width}x${height}`);
    assertContained(report.close, viewportRect, `${kind} close control at ${width}x${height}`);
    assertContained(report.content, report.dialog, `${kind} dialog content at ${width}x${height}`);
    assertEqual(report.close.width >= 44 && report.close.height >= 44, true, `${kind} dialog close target is at least 44px`);
    if (kind === "footprint") {
      assertEqual(report.image?.objectFit, "contain", "enlarged footprint uses contain sizing");
      assertEqual(report.image?.rect.height > 0, true, "enlarged footprint media is present");
      assertContained(report.image.rect, report.content, `enlarged footprint at ${width}x${height}`);
    } else {
      assertEqual(report.model !== null, true, "enlarged model has a live canvas");
      assertContained(report.model.viewport, report.content, `enlarged model viewport at ${width}x${height}`);
      assertContained(report.model.canvas, report.model.viewport, `enlarged model canvas at ${width}x${height}`);
      if (height > width) {
        assertEqual(report.model.clientHeight > report.model.clientWidth, true, "portrait dialog gives the model a portrait viewport");
      }
      assertEqual(Math.abs(report.model.canvas.width / report.model.canvas.height - report.model.clientWidth / report.model.clientHeight) < 0.02, true, "enlarged model canvas aspect matches its viewport");
      const expectedWidth = report.model.clientWidth * report.model.ratio;
      const expectedHeight = report.model.clientHeight * report.model.ratio;
      assertEqual(Math.abs(report.model.pixelWidth - expectedWidth) <= Math.max(4, expectedWidth * 0.01), true, "enlarged model pixel width tracks DPR2 viewport");
      assertEqual(Math.abs(report.model.pixelHeight - expectedHeight) <= Math.max(4, expectedHeight * 0.01), true, "enlarged model pixel height tracks DPR2 viewport");
    }
    await evaluate(cdp, `document.querySelector(${JSON.stringify(dialogSelector)}).querySelector('.zld-preview-dialog__close').click()`);
    await waitFor(cdp, `!document.querySelector(${JSON.stringify(dialogSelector)})?.open`);
    if (kind === "model") {
      await waitFor(cdp, `document.querySelectorAll('[data-model-viewer-instance="dialog"]').length === 0`);
    }
    await waitFor(cdp, `document.activeElement === document.querySelector(${JSON.stringify(triggerSelector)})`);
  }
}

async function exerciseFootprintDialog(cdp) {
  const triggerSelector = '[data-component-preview-enlarge="footprint"]';
  const dialogSelector = '[data-component-preview-dialog="footprint"]';
  await waitFor(cdp, `getComputedStyle(document.querySelector(${JSON.stringify(triggerSelector)})).display !== 'none'`);
  const trigger = await evaluate(cdp, `(() => {
    const element = document.querySelector(${JSON.stringify(triggerSelector)});
    const rect = element.getBoundingClientRect();
    const dialog = document.querySelector(${JSON.stringify(dialogSelector)});
    return { tag: element.tagName, width: rect.width, height: rect.height, label: element.getAttribute('aria-label'), dialogLabel: dialog.getAttribute('aria-label'), labelledBy: dialog.hasAttribute('aria-labelledby') };
  })()`);
  assertEqual(trigger.tag, "BUTTON", "footprint enlarge uses a native button");
  assertEqual(trigger.width >= 44 && trigger.height >= 44, true, "footprint enlarge target is at least 44px");
  assertEqual(trigger.label.startsWith("Enlarge footprint preview"), true, "footprint enlarge has a specific accessible name");
  assertEqual(trigger.dialogLabel.startsWith("Footprint preview for "), true, "footprint dialog has an accessible media label");
  assertEqual(trigger.labelledBy, false, "footprint dialog does not reference a removed title");

  assertEqual(await evaluate(cdp, `document.activeElement !== document.querySelector(${JSON.stringify(triggerSelector)})`), true, "footprint pointer-style activation begins without trigger focus");
  await evaluate(cdp, `document.querySelector(${JSON.stringify(triggerSelector)}).click()`);
  await waitFor(cdp, `document.querySelector(${JSON.stringify(dialogSelector)})?.open`);
  assertEqual(await evaluate(cdp, `document.activeElement === document.querySelector(${JSON.stringify(dialogSelector)}).querySelector('.zld-preview-dialog__close')`), true, "footprint dialog moves focus to close");
  assertEqual(await evaluate(cdp, `document.querySelector(${JSON.stringify(dialogSelector)}).matches(':modal')`), true, "footprint dialog is modal");
  assertEqual(await evaluate(cdp, `document.querySelector(${JSON.stringify(dialogSelector)}).querySelector('img')?.alt === ''`), true, "enlarged footprint avoids a duplicate visible label");
  const layout = await evaluate(cdp, `(() => {
    const content = document.querySelector(${JSON.stringify(dialogSelector)}).querySelector('.zld-preview-dialog__content');
    const image = content.querySelector(':scope > img');
    const rect = (element) => {
      const value = element.getBoundingClientRect();
      return { left: value.left, right: value.right, top: value.top, bottom: value.bottom, width: value.width, height: value.height };
    };
    return {
      content: rect(content),
      image: rect(image),
      overflow: content.scrollWidth > content.clientWidth + 1 || content.scrollHeight > content.clientHeight + 1,
    };
  })()`);
  assertContained(layout.image, layout.content, "desktop enlarged footprint");
  assertEqual(layout.overflow, false, "desktop enlarged footprint has no internal overflow");

  await pressKey(cdp, "Tab", "Tab", 9);
  assertEqual(await evaluate(cdp, `document.querySelector(${JSON.stringify(dialogSelector)}).contains(document.activeElement)`), true, "forward Tab remains in footprint dialog");
  await pressKey(cdp, "Tab", "Tab", 9, 8);
  assertEqual(await evaluate(cdp, `document.querySelector(${JSON.stringify(dialogSelector)}).contains(document.activeElement)`), true, "reverse Tab remains in footprint dialog");

  await pressKey(cdp, "Escape", "Escape", 27);
  await waitFor(cdp, `!document.querySelector(${JSON.stringify(dialogSelector)})?.open && !document.querySelector(${JSON.stringify(dialogSelector)})?.querySelector('img')`);
  assertEqual(await evaluate(cdp, `document.activeElement === document.querySelector(${JSON.stringify(triggerSelector)})`), true, "Escape restores footprint trigger focus");

  await evaluate(cdp, `document.querySelector(${JSON.stringify(triggerSelector)}).click()`);
  await waitFor(cdp, `document.querySelector(${JSON.stringify(dialogSelector)})?.open`);
  await clickAt(cdp, 0, 0);
  await waitFor(cdp, `!document.querySelector(${JSON.stringify(dialogSelector)})?.open && !document.querySelector(${JSON.stringify(dialogSelector)})?.querySelector('img')`);
  assertEqual(await evaluate(cdp, `document.activeElement === document.querySelector(${JSON.stringify(triggerSelector)})`), true, "backdrop close restores footprint trigger focus");

  await evaluate(cdp, `document.querySelector(${JSON.stringify(triggerSelector)}).click()`);
  await waitFor(cdp, `document.querySelector(${JSON.stringify(dialogSelector)})?.open`);
  await evaluate(cdp, `document.querySelector(${JSON.stringify(dialogSelector)}).querySelector('.zld-preview-dialog__close').click()`);
  await waitFor(cdp, `!document.querySelector(${JSON.stringify(dialogSelector)})?.open && !document.querySelector(${JSON.stringify(dialogSelector)})?.querySelector('img')`);
  assertEqual(await evaluate(cdp, `document.activeElement === document.querySelector(${JSON.stringify(triggerSelector)})`), true, "close button restores footprint trigger focus");
  assertEqual(await evaluate(cdp, `location.pathname === ${JSON.stringify(RECORD)}`), true, "footprint enlarge never navigates to the raw SVG");
}

async function exerciseModelDialog(cdp) {
  const triggerSelector = '[data-component-preview-enlarge="model"]';
  const dialogSelector = '[data-component-preview-dialog="model"]';
  await waitFor(cdp, `getComputedStyle(document.querySelector(${JSON.stringify(triggerSelector)})).display !== 'none'`);
  const trigger = await evaluate(cdp, `(() => {
    const element = document.querySelector(${JSON.stringify(triggerSelector)});
    const rect = element.getBoundingClientRect();
    const dialog = document.querySelector(${JSON.stringify(dialogSelector)});
    return { tag: element.tagName, width: rect.width, height: rect.height, label: element.getAttribute('aria-label'), dialogLabel: dialog.getAttribute('aria-label'), labelledBy: dialog.hasAttribute('aria-labelledby') };
  })()`);
  assertEqual(trigger.tag, "BUTTON", "model enlarge uses a native button");
  assertEqual(trigger.width >= 44 && trigger.height >= 44, true, "model enlarge target is at least 44px");
  assertEqual(trigger.label.startsWith("Enlarge 3D preview"), true, "model enlarge has a specific accessible name");
  assertEqual(trigger.dialogLabel.startsWith("Interactive 3D view of "), true, "model dialog has an accessible media label");
  assertEqual(trigger.labelledBy, false, "model dialog does not reference a removed title");

  assertEqual(await evaluate(cdp, `document.activeElement !== document.querySelector(${JSON.stringify(triggerSelector)})`), true, "model pointer-style activation begins without trigger focus");
  await evaluate(cdp, `document.querySelector(${JSON.stringify(triggerSelector)}).click()`);
  await waitFor(cdp, `document.querySelector(${JSON.stringify(dialogSelector)})?.open`);
  await waitFor(cdp, `document.querySelector('[data-model-viewer-instance="dialog"]')?.dataset.viewerState === 'ready'`, 20_000);
  assertEqual(await evaluate(cdp, `document.querySelectorAll('[data-component-model-viewer-root]').length`), 2, "model dialog mounts one temporary viewer");
  assertEqual(await evaluate(cdp, `document.querySelectorAll('[data-model-viewer-viewport] canvas').length`), 2, "model dialog mounts one temporary canvas");
  assertEqual(await evaluate(cdp, `document.activeElement === document.querySelector(${JSON.stringify(dialogSelector)}).querySelector('.zld-preview-dialog__close')`), true, "model dialog moves focus to close");

  await exerciseViewerInteractions(cdp, "dialog", false);
  await waitForRenderIdle(cdp, "enlarged model remains render-on-demand idle", "dialog");

  const beforeThemeRender = await renderCount(cdp, "dialog");
  await evaluate(cdp, `document.documentElement.dataset.theme = 'dark'`);
  await waitFor(cdp, `Number(document.querySelector('[data-model-viewer-instance="dialog"]').dataset.renderCount) > ${beforeThemeRender}`);
  await evaluate(cdp, `document.documentElement.dataset.theme = 'light'`);

  await evaluate(cdp, `
    window.__zldClosedDialogViewer = document.querySelector('[data-model-viewer-instance="dialog"]');
    window.__zldClosedDialogCanvas = window.__zldClosedDialogViewer.querySelector('canvas');
    document.querySelector(${JSON.stringify(dialogSelector)}).querySelector('.zld-preview-dialog__close').click();
  `);
  await waitFor(cdp, `!document.querySelector(${JSON.stringify(dialogSelector)})?.open`);
  await waitFor(cdp, `window.__zldClosedDialogViewer?.dataset.viewerDisposed === 'true'`);
  assertEqual(await evaluate(cdp, `document.querySelectorAll('[data-component-model-viewer-root]').length`), 1, "closing model dialog removes temporary viewer");
  assertEqual(await evaluate(cdp, `document.querySelectorAll('[data-model-viewer-viewport] canvas').length`), 1, "closing model dialog removes temporary canvas");
  assertEqual(await evaluate(cdp, `window.__zldClosedDialogCanvas?.isConnected`), false, "closing model dialog detaches temporary canvas");
  assertEqual(await evaluate(cdp, `document.activeElement === document.querySelector(${JSON.stringify(triggerSelector)})`), true, "closing model dialog restores trigger focus");

  for (let cycle = 1; cycle <= 2; cycle += 1) {
    await evaluate(cdp, `document.querySelector(${JSON.stringify(triggerSelector)}).click()`);
    await waitFor(cdp, `document.querySelector('[data-model-viewer-instance="dialog"]')?.dataset.viewerState === 'ready'`, 20_000);
    await evaluate(cdp, `
      window.__zldCycleViewer = document.querySelector('[data-model-viewer-instance="dialog"]');
      document.querySelector(${JSON.stringify(dialogSelector)}).querySelector('.zld-preview-dialog__close').click();
    `);
    await waitFor(cdp, `window.__zldCycleViewer?.dataset.viewerDisposed === 'true'`);
    assertEqual(await evaluate(cdp, `document.querySelectorAll('[data-component-model-viewer-root]').length`), 1, `model dialog reopen cycle ${cycle} leaves one viewer`);
    assertEqual(await evaluate(cdp, `document.querySelectorAll('[data-model-viewer-viewport] canvas').length`), 1, `model dialog reopen cycle ${cycle} leaves one canvas`);
  }
}

async function exerciseViewerInteractions(cdp, instance = "inline", testResize = true) {
  const rootSelector = `[data-model-viewer-instance="${instance}"]`;
  const canvas = await evaluate(cdp, `(() => {
    const rect = document.querySelector(${JSON.stringify(`${rootSelector} [data-model-viewer-viewport] canvas`)}).getBoundingClientRect();
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  })()`);
  const x = canvas.left + canvas.width / 2;
  const y = canvas.top + canvas.height / 2;

  await waitForRenderIdle(cdp, `before ${instance} orbit input`, instance);
  let before = await renderCount(cdp, instance);
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x + 48, y: y + 24, button: "left", buttons: 1 });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: x + 48, y: y + 24, button: "left", buttons: 0, clickCount: 1 });
  await waitFor(cdp, `Number(document.querySelector(${JSON.stringify(rootSelector)}).dataset.renderCount) > ${before}`);

  await waitForRenderIdle(cdp, `before ${instance} zoom input`, instance);
  before = await renderCount(cdp, instance);
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseWheel", x, y, deltaX: 0, deltaY: -180 });
  await waitFor(cdp, `Number(document.querySelector(${JSON.stringify(rootSelector)}).dataset.renderCount) > ${before}`);

  await waitForRenderIdle(cdp, `before ${instance} keyboard input`, instance);
  await evaluate(cdp, `document.querySelector(${JSON.stringify(`${rootSelector} [data-model-viewer-viewport]`)}).focus()`);
  before = await renderCount(cdp, instance);
  await cdp.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "ArrowLeft", code: "ArrowLeft", windowsVirtualKeyCode: 37, nativeVirtualKeyCode: 37 });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "ArrowLeft", code: "ArrowLeft", windowsVirtualKeyCode: 37, nativeVirtualKeyCode: 37 });
  await waitFor(cdp, `Number(document.querySelector(${JSON.stringify(rootSelector)}).dataset.renderCount) > ${before}`);
  const focus = await evaluate(cdp, `(() => {
    const viewport = document.querySelector(${JSON.stringify(`${rootSelector} [data-model-viewer-viewport]`)});
    const style = getComputedStyle(viewport);
    return { active: document.activeElement === viewport, outline: style.outlineStyle, width: parseFloat(style.outlineWidth) };
  })()`);
  assertEqual(focus.active, true, `${instance} viewer keyboard focus retained`);
  assertEqual(focus.outline !== "none" && focus.width >= 2, true, `${instance} viewer focus state visible`);

  if (!testResize) return;
  await waitForRenderIdle(cdp, `before ${instance} resize input`, instance);
  before = await renderCount(cdp, instance);
  await setViewportAndMedia(cdp, 1200, "light", false);
  await waitFor(cdp, `Number(document.querySelector(${JSON.stringify(rootSelector)}).dataset.renderCount) > ${before}`);
  await waitForCanvasSize(cdp, instance);
  await waitForRenderSettled(cdp, instance);
  await waitForCanvasSize(cdp, instance);
  const resized = await evaluate(cdp, `(() => {
    const canvas = document.querySelector(${JSON.stringify(`${rootSelector} [data-model-viewer-viewport] canvas`)});
    const viewport = document.querySelector(${JSON.stringify(`${rootSelector} [data-model-viewer-viewport]`)});
    return { cssWidth: canvas.clientWidth, viewportWidth: viewport.clientWidth, pixelWidth: canvas.width, ratio: devicePixelRatio };
  })()`);
  const expectedPixelWidth = resized.viewportWidth * resized.ratio;
  if (Math.abs(resized.pixelWidth - expectedPixelWidth) > Math.max(4, expectedPixelWidth * 0.01)) {
    throw new Error(`viewer canvas did not resize to viewport: ${JSON.stringify(resized)}`);
  }
  await setViewportAndMedia(cdp, 1600, "light", false);
}

async function renderCount(cdp, instance = "inline") {
  return Number(await evaluate(cdp, `document.querySelector('[data-model-viewer-instance=${JSON.stringify(instance)}]')?.dataset.renderCount ?? 0`));
}

async function waitForCanvasSize(cdp, instance) {
  const rootSelector = `[data-model-viewer-instance="${instance}"]`;
  await waitFor(cdp, `(() => {
    const viewport = document.querySelector(${JSON.stringify(`${rootSelector} [data-model-viewer-viewport]`)});
    const canvas = viewport?.querySelector('canvas');
    if (!viewport || !canvas) return false;
    const ratio = Math.min(devicePixelRatio, 2);
    const expectedWidth = Math.max(1, viewport.clientWidth) * ratio;
    const expectedHeight = Math.max(1, viewport.clientHeight) * ratio;
    return Math.abs(canvas.width - expectedWidth) <= Math.max(4, expectedWidth * 0.01)
      && Math.abs(canvas.height - expectedHeight) <= Math.max(4, expectedHeight * 0.01);
  })()`);
}

async function waitForRenderIdle(cdp, label, instance = "inline") {
  await delay(150);
  const count = await renderCount(cdp, instance);
  await delay(250);
  assertEqual(await renderCount(cdp, instance), count, label);
}

async function waitForRenderSettled(cdp, instance = "inline", timeout = 10_000) {
  const deadline = Date.now() + timeout;
  let previous = await renderCount(cdp, instance);
  let stableSince = Date.now();
  while (Date.now() < deadline) {
    await delay(100);
    const current = await renderCount(cdp, instance);
    if (current !== previous) {
      previous = current;
      stableSince = Date.now();
      continue;
    }
    if (Date.now() - stableSince >= 750) return;
  }
  throw new Error(`${instance} viewer did not settle after resize`);
}

async function pressKey(cdp, key, code, keyCode, modifiers = 0) {
  await cdp.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key, code, modifiers, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key, code, modifiers, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode });
}

async function clickAt(cdp, x, y) {
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1 });
}

function assertContained(child, parent, label) {
  const epsilon = 1;
  if (
    child.left < parent.left - epsilon || child.right > parent.right + epsilon ||
    child.top < parent.top - epsilon || child.bottom > parent.bottom + epsilon ||
    child.width <= 0 || child.height <= 0
  ) {
    throw new Error(`${label} is not contained: child=${JSON.stringify(child)} parent=${JSON.stringify(parent)}`);
  }
}

function assertDurationAtMost(value, maximumSeconds, label) {
  const durations = value.split(",").map((part) => {
    const trimmed = part.trim();
    if (trimmed.endsWith("ms")) return Number.parseFloat(trimmed) / 1000;
    if (trimmed.endsWith("s")) return Number.parseFloat(trimmed);
    return Number.NaN;
  });
  if (durations.length === 0 || durations.some((duration) => !Number.isFinite(duration) || duration > maximumSeconds)) {
    throw new Error(`${label}: expected <= ${maximumSeconds}s, got ${JSON.stringify(value)}`);
  }
}

async function waitForExit(process) {
  if (process.exitCode !== null || process.signalCode !== null) return;
  await new Promise((resolveExit) => {
    const timer = setTimeout(() => process.kill("SIGKILL"), 2_000);
    process.once("exit", () => {
      clearTimeout(timer);
      resolveExit();
    });
  });
}

async function readDebuggingPort(chrome) {
  let stderr = "";
  for await (const chunk of chrome.stderr) {
    stderr += chunk.toString();
    const match = /DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//u.exec(stderr);
    if (match !== null) return Number(match[1]);
    if (stderr.length > 20_000) stderr = stderr.slice(-10_000);
  }
  throw new Error(`Chrome exited before opening DevTools: ${stderr.slice(-2000)}`);
}

async function waitForJson(url) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch {}
    await delay(50);
  }
  throw new Error(`Timed out fetching ${url}`);
}

async function connectCdp(url) {
  const socket = new WebSocket(url);
  await new Promise((resolveOpen, rejectOpen) => {
    socket.addEventListener("open", resolveOpen, { once: true });
    socket.addEventListener("error", rejectOpen, { once: true });
  });
  let nextId = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id === undefined) return;
    const callbacks = pending.get(message.id);
    if (callbacks === undefined) return;
    pending.delete(message.id);
    if (message.error) callbacks.reject(new Error(`${callbacks.method}: ${message.error.message}`));
    else callbacks.resolve(message.result);
  });
  return {
    send(method, params = {}) {
      const id = ++nextId;
      return new Promise((resolveSend, rejectSend) => {
        pending.set(id, { resolve: resolveSend, reject: rejectSend, method });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close() { socket.close(); },
  };
}

async function evaluate(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails !== undefined) {
    throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  }
  return result.result.value;
}

async function waitFor(cdp, expression, timeout = 10_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await evaluate(cdp, `Boolean(${expression})`)) return;
    await delay(50);
  }
  throw new Error(`Timed out waiting for: ${expression}`);
}

async function revealViewer(cdp) {
  await waitFor(cdp, `(() => {
    const marker = document.querySelector('[data-zfb-island="PackageModelViewerIsland"]');
    if (!marker) return false;
    marker.scrollIntoView({ block: 'center' });
    const bounds = marker.getBoundingClientRect();
    return bounds.bottom > 0 && bounds.top < innerHeight;
  })()`);
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

await main();
