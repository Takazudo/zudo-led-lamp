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
  { kind: "passive", path: "/docs/components/records/c22807/" },
  { kind: "IC", path: RECORD },
  { kind: "connector", path: "/docs/components/records/type-c-31-m-17/" },
  { kind: "unavailable history", path: "/docs/components/records/c529334/", availability: "SOURCE UNAVAILABLE" },
];
const VIEWPORTS = [1440, 375];
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

      await setViewportAndMedia(cdp, 1440, "light", false);
      await navigate(cdp, origin, RECORD);
      await setDocumentTheme(cdp, "light");
      await revealReadyViewer(cdp);
      await exerciseViewerInteractions(cdp);

      // No continuous animation loop: after interaction/resize settles, the
      // diagnostic render count stays unchanged without input.
      await delay(300);
      const renders = await renderCount(cdp);
      await delay(500);
      assertEqual(await renderCount(cdp), renders, "render-on-demand remains idle");

      await setViewportAndMedia(cdp, 1440, "dark", true);
      assertEqual(await evaluate(cdp, `matchMedia('(prefers-reduced-motion: reduce)').matches`), true, "reduced-motion media active");
      const reducedDurations = await evaluate(cdp, `(() => {
        const target = document.querySelector('[data-model-viewer-viewport]');
        const style = getComputedStyle(target);
        return { animation: style.animationDuration, transition: style.transitionDuration };
      })()`);
      assertDurationAtMost(reducedDurations.animation, 0.001, "reduced-motion animation duration");
      assertDurationAtMost(reducedDurations.transition, 0.001, "reduced-motion transition duration");

      await evaluate(cdp, `
        window.__zldOldViewer = document.querySelector('[data-component-model-viewer-root]');
        window.__zldOldCanvas = window.__zldOldViewer.querySelector('canvas');
        document.querySelector('a[href=${JSON.stringify(AWAY)}]').click();
      `);
      await waitFor(cdp, `location.pathname === ${JSON.stringify(AWAY)}`);
      await waitFor(cdp, `window.__zldOldViewer?.dataset.viewerDisposed === 'true'`);
      assertEqual(await evaluate(cdp, `window.__zldOldCanvas?.isConnected`), false, "old canvas detached on SPA swap");

      await evaluate(cdp, "history.back()");
      await waitFor(cdp, `location.pathname === ${JSON.stringify(RECORD)}`);
      await revealReadyViewer(cdp);
      assertEqual(await evaluate(cdp, `document.querySelectorAll('[data-component-model-viewer-root]').length`), 1, "one viewer root after SPA back");
      assertEqual(await evaluate(cdp, `document.querySelectorAll('[data-model-viewer-viewport] canvas').length`), 1, "one canvas after SPA back");
      assertEqual(await evaluate(cdp, `document.querySelector('[data-component-model-viewer-root]') === window.__zldOldViewer`), false, "fresh viewer after SPA back");

      await navigate(cdp, origin, `${RECORD}?model-viewer-model=fail`);
      await revealViewer(cdp);
      await waitFor(cdp, `document.querySelector('[data-component-model-viewer-root]')?.dataset.viewerState === 'error'`);
      assertEqual(await evaluate(cdp, `document.querySelectorAll('[data-model-viewer-viewport] canvas').length`), 0, "no canvas after model load failure");
      assertEqual(await evaluate(cdp, `document.querySelector('[data-model-viewer-status]')?.textContent.includes('package reference')`), true, "meaningful model-load fallback");

      await navigate(cdp, origin, `${RECORD}?model-viewer-webgl=fail`);
      await revealViewer(cdp);
      await waitFor(cdp, `document.querySelector('[data-component-model-viewer-root]')?.dataset.viewerState === 'unavailable'`);
      assertEqual(await evaluate(cdp, `document.querySelectorAll('[data-model-viewer-viewport] canvas').length`), 0, "no canvas after forced WebGL failure");
      assertEqual(await evaluate(cdp, `document.querySelector('[data-model-viewer-status]')?.textContent.includes('WebGL is unavailable')`), true, "meaningful WebGL fallback");

      await cdp.send("Emulation.setScriptExecutionDisabled", { value: true });
      await navigate(cdp, origin, REPRESENTATIVES[0].path);
      await revealViewer(cdp);
      assertEqual(await evaluate(cdp, `document.querySelector('[data-component-model-viewer-root]')?.dataset.viewerState`), "no-js", "no-JS state retained");
      assertEqual(await evaluate(cdp, `document.querySelectorAll('[data-model-viewer-viewport] canvas').length`), 0, "no canvas without JavaScript");
      assertEqual(await evaluate(cdp, `document.querySelector('[data-model-viewer-status]')?.textContent.includes('requires JavaScript and WebGL')`), true, "no-JS explanation retained");
      await waitFor(cdp, `document.querySelector('.zld-component-references__footprint img')?.complete && document.querySelector('.zld-component-references__footprint img')?.naturalWidth > 0`);
      await cdp.send("Emulation.setScriptExecutionDisabled", { value: false });

      await setViewportAndMedia(cdp, 1440, "light", false);
      await navigate(cdp, origin, `${AWAY}/`);
      await delay(500); // wait-ok: this is an intentional absence-window assertion.
      const catalogState = await evaluate(cdp, `({
        viewers: document.querySelectorAll('[data-component-model-viewer-root]').length,
        canvases: document.querySelectorAll('canvas').length,
        modelResources: performance.getEntriesByType('resource').filter((entry) => entry.name.includes('/assets/component-previews/models/')).length,
        modelMarkers: document.documentElement.innerHTML.includes('data-model-url')
      })`);
      assertEqual(catalogState.viewers, 0, "catalog has no viewer root");
      assertEqual(catalogState.canvases, 0, "catalog has no canvas");
      assertEqual(catalogState.modelResources, 0, "catalog loads no model resource");
      assertEqual(catalogState.modelMarkers, false, "catalog has no model descriptor");

      process.stdout.write(`component reference browser smoke passed: ${inspected} responsive/theme cases, interactions, on-demand idle, SPA cleanup, fallbacks, no-JS, viewer-free catalog\n`);
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

async function setViewportAndMedia(cdp, width, theme, reducedMotion) {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
    screenWidth: width,
    screenHeight: 900,
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
    const cards = [...section.querySelectorAll('.zld-component-references__card')];
    const footprintLink = section.querySelector('.zld-component-references__footprint > a');
    const footprintImage = footprintLink.querySelector('img');
    const modelViewport = section.querySelector('[data-model-viewer-viewport]');
    const modelRoot = section.querySelector('[data-component-model-viewer-root]');
    const documentLink = section.querySelector('.zld-component-references__document-title a');
    const label = section.querySelector('.zld-component-references__document-label');
    const metadata = [...section.querySelectorAll('.zld-component-references__metadata > div')];
    const availability = metadata.find((row) => row.querySelector('dt')?.textContent.trim() === 'Availability')?.querySelector('dd')?.textContent.trim();
    const evidence = document.querySelector('.zld-evidence-table');
    const rect = (element) => {
      const value = element.getBoundingClientRect();
      return { left: value.left, right: value.right, top: value.top, bottom: value.bottom, width: value.width, height: value.height };
    };
    const sectionRect = rect(section);
    const cardRects = cards.map(rect);
    const footprintRect = rect(footprintLink);
    const imageRect = rect(footprintImage);
    const modelRect = rect(modelViewport);
    const cardStyle = getComputedStyle(cards[0]);
    const status = section.querySelector('[data-model-viewer-status]');
    const statusStyle = getComputedStyle(status);
    return {
      viewport: { inner: innerWidth, client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth },
      sectionRect,
      cardRects,
      footprintRect,
      imageRect,
      modelRect,
      documentLabel: label?.textContent.trim(),
      documentHref: documentLink?.href,
      availability,
      footprintObjectFit: getComputedStyle(footprintImage).objectFit,
      footprintNatural: [footprintImage.naturalWidth, footprintImage.naturalHeight],
      modelUrl: modelRoot?.dataset.modelUrl,
      viewerRoots: section.querySelectorAll('[data-component-model-viewer-root]').length,
      statusVisible: statusStyle.display !== 'none' && statusStyle.visibility !== 'hidden' && Number(statusStyle.opacity) > 0,
      cardColorsDistinct: cardStyle.color !== cardStyle.backgroundColor,
      themeSignature: [getComputedStyle(document.body).color, getComputedStyle(document.body).backgroundColor, cardStyle.color, cardStyle.backgroundColor].join('|'),
      sectionBeforeEvidence: evidence !== null && Boolean(section.compareDocumentPosition(evidence) & Node.DOCUMENT_POSITION_FOLLOWING),
      sourcesPresent: document.getElementById('sources') !== null,
      theme: document.documentElement.dataset.theme,
    };
  })()`);

  assertEqual(report.viewport.inner, width, `${representative.kind} ${width}/${theme} viewport width`);
  assertEqual(report.viewport.scroll <= report.viewport.client + 1, true, `${representative.kind} ${width}/${theme} page overflow`);
  assertEqual(ALLOWED_PDF_LABELS.includes(report.documentLabel), true, `${representative.kind} PDF label`);
  assertEqual(/^https?:\/\//u.test(report.documentHref), true, `${representative.kind} PDF destination`);
  if (representative.availability !== undefined) {
    assertEqual(report.availability, representative.availability, `${representative.kind} availability`);
  }
  assertEqual(report.footprintObjectFit, "contain", `${representative.kind} footprint containment mode`);
  assertEqual(report.footprintNatural.every((value) => value > 0), true, `${representative.kind} footprint loaded`);
  assertEqual(report.viewerRoots, 1, `${representative.kind} viewer root count`);
  assertEqual(report.modelUrl?.endsWith(".wrl"), true, `${representative.kind} selected WRL`);
  assertEqual(report.modelUrl?.toLowerCase().endsWith(".step"), false, `${representative.kind} no STEP URL`);
  assertEqual(report.statusVisible, true, `${representative.kind} visible status`);
  assertEqual(report.cardColorsDistinct, true, `${representative.kind} readable card colors`);
  assertEqual(report.sectionBeforeEvidence, true, `${representative.kind} references before evidence`);
  assertEqual(report.sourcesPresent, true, `${representative.kind} Sources retained`);
  assertEqual(report.theme, theme, `${representative.kind} ${theme} theme retained`);

  for (const [index, card] of report.cardRects.entries()) {
    assertContained(card, report.sectionRect, `${representative.kind} card ${index + 1} at ${width}/${theme}`);
  }
  const footprintCard = report.cardRects[1];
  const modelCard = report.cardRects[2];
  assertContained(report.footprintRect, footprintCard, `${representative.kind} footprint at ${width}/${theme}`);
  assertContained(report.imageRect, report.footprintRect, `${representative.kind} footprint image at ${width}/${theme}`);
  assertContained(report.modelRect, modelCard, `${representative.kind} model viewport at ${width}/${theme}`);
  const columns = new Set(report.cardRects.map((rect) => Math.round(rect.left)));
  if (width === 375) assertEqual(columns.size, 1, `${representative.kind} cards stack at mobile width`);
  else assertEqual(columns.size >= 2, true, `${representative.kind} cards use desktop width`);

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

async function revealReadyViewer(cdp) {
  await revealViewer(cdp);
  await waitFor(cdp, `document.querySelector('[data-component-model-viewer-root]')?.dataset.viewerState === 'ready'`, 20_000);
  assertEqual(await evaluate(cdp, `document.querySelectorAll('[data-component-model-viewer-root]').length`), 1, "one viewer root after load");
  assertEqual(await evaluate(cdp, `document.querySelectorAll('[data-model-viewer-viewport] canvas').length`), 1, "one canvas after load");
}

async function exerciseViewerInteractions(cdp) {
  const canvas = await evaluate(cdp, `(() => {
    const rect = document.querySelector('[data-model-viewer-viewport] canvas').getBoundingClientRect();
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  })()`);
  const x = canvas.left + canvas.width / 2;
  const y = canvas.top + canvas.height / 2;

  await waitForRenderIdle(cdp, "before orbit input");
  let before = await renderCount(cdp);
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x + 48, y: y + 24, button: "left", buttons: 1 });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: x + 48, y: y + 24, button: "left", buttons: 0, clickCount: 1 });
  await waitFor(cdp, `Number(document.querySelector('[data-component-model-viewer-root]').dataset.renderCount) > ${before}`);

  await waitForRenderIdle(cdp, "before zoom input");
  before = await renderCount(cdp);
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseWheel", x, y, deltaX: 0, deltaY: -180 });
  await waitFor(cdp, `Number(document.querySelector('[data-component-model-viewer-root]').dataset.renderCount) > ${before}`);

  await waitForRenderIdle(cdp, "before keyboard input");
  await evaluate(cdp, `document.querySelector('[data-model-viewer-viewport]').focus()`);
  before = await renderCount(cdp);
  await cdp.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "ArrowLeft", code: "ArrowLeft", windowsVirtualKeyCode: 37, nativeVirtualKeyCode: 37 });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "ArrowLeft", code: "ArrowLeft", windowsVirtualKeyCode: 37, nativeVirtualKeyCode: 37 });
  await waitFor(cdp, `Number(document.querySelector('[data-component-model-viewer-root]').dataset.renderCount) > ${before}`);
  const focus = await evaluate(cdp, `(() => {
    const viewport = document.querySelector('[data-model-viewer-viewport]');
    const style = getComputedStyle(viewport);
    return { active: document.activeElement === viewport, outline: style.outlineStyle, width: parseFloat(style.outlineWidth) };
  })()`);
  assertEqual(focus.active, true, "viewer keyboard focus retained");
  assertEqual(focus.outline !== "none" && focus.width >= 2, true, "viewer focus state visible");

  await waitForRenderIdle(cdp, "before resize input");
  before = await renderCount(cdp);
  await setViewportAndMedia(cdp, 1200, "light", false);
  await waitFor(cdp, `Number(document.querySelector('[data-component-model-viewer-root]').dataset.renderCount) > ${before}`);
  const resized = await evaluate(cdp, `(() => {
    const canvas = document.querySelector('[data-model-viewer-viewport] canvas');
    const viewport = document.querySelector('[data-model-viewer-viewport]');
    return { cssWidth: canvas.clientWidth, viewportWidth: viewport.clientWidth, pixelWidth: canvas.width, ratio: devicePixelRatio };
  })()`);
  const expectedPixelWidth = resized.viewportWidth * resized.ratio;
  if (Math.abs(resized.pixelWidth - expectedPixelWidth) > Math.max(4, expectedPixelWidth * 0.01)) {
    throw new Error(`viewer canvas did not resize to viewport: ${JSON.stringify(resized)}`);
  }
  await setViewportAndMedia(cdp, 1440, "light", false);
}

async function renderCount(cdp) {
  return Number(await evaluate(cdp, `document.querySelector('[data-component-model-viewer-root]')?.dataset.renderCount ?? 0`));
}

async function waitForRenderIdle(cdp, label) {
  await delay(150);
  const count = await renderCount(cdp);
  await delay(250);
  assertEqual(await renderCount(cdp), count, label);
}

function assertContained(child, parent, label) {
  const epsilon = 1;
  if (
    child.left < parent.left - epsilon || child.right > parent.right + epsilon ||
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
