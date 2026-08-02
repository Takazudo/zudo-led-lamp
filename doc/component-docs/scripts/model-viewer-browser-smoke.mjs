#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, normalize, resolve, sep } from "node:path";

const DIST = resolve("dist");
const RECORD = "/docs/components/records/al8860mp-13/";
const AWAY = "/docs/components/catalog";
const MIME = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
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
      await cdp.send("Page.navigate", { url: `${origin}${RECORD}` });
      await waitFor(cdp, `location.pathname === ${JSON.stringify(RECORD)}`);
      await waitFor(cdp, `document.readyState === 'complete'`);
      await revealViewer(cdp);
      await waitFor(cdp, `document.querySelector('[data-component-model-viewer-root]')?.dataset.viewerState === 'ready'`, 20_000);
      assertEqual(await evaluate(cdp, `document.querySelectorAll('[data-component-model-viewer-root]').length`), 1, "one viewer root after load");
      assertEqual(await evaluate(cdp, `document.querySelectorAll('[data-model-viewer-viewport] canvas').length`), 1, "one canvas after load");
      assertEqual(await evaluate(cdp, `document.querySelector('[data-model-viewer-status]')?.textContent.includes('ready')`), true, "ready status");

      // No continuous animation loop: after resize/initialization settles, the
      // diagnostic render count stays unchanged without input.
      await delay(300);
      const renders = await evaluate(cdp, `document.querySelector('[data-component-model-viewer-root]')?.dataset.renderCount`);
      await delay(500);
      assertEqual(await evaluate(cdp, `document.querySelector('[data-component-model-viewer-root]')?.dataset.renderCount`), renders, "render-on-demand remains idle");

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
      await revealViewer(cdp);
      await waitFor(cdp, `document.querySelector('[data-component-model-viewer-root]')?.dataset.viewerState === 'ready'`, 20_000);
      assertEqual(await evaluate(cdp, `document.querySelectorAll('[data-component-model-viewer-root]').length`), 1, "one viewer root after SPA back");
      assertEqual(await evaluate(cdp, `document.querySelectorAll('[data-model-viewer-viewport] canvas').length`), 1, "one canvas after SPA back");
      assertEqual(await evaluate(cdp, `document.querySelector('[data-component-model-viewer-root]') === window.__zldOldViewer`), false, "fresh viewer after SPA back");

      await cdp.send("Page.navigate", { url: `${origin}${RECORD}?model-viewer-model=fail` });
      await waitFor(cdp, `location.search === '?model-viewer-model=fail'`);
      await waitFor(cdp, `document.readyState === 'complete'`);
      await revealViewer(cdp);
      await waitFor(cdp, `document.querySelector('[data-component-model-viewer-root]')?.dataset.viewerState === 'error'`);
      assertEqual(await evaluate(cdp, `document.querySelectorAll('[data-model-viewer-viewport] canvas').length`), 0, "no canvas after model load failure");
      assertEqual(await evaluate(cdp, `document.querySelector('[data-model-viewer-status]')?.textContent.includes('package reference')`), true, "meaningful model-load fallback");

      await cdp.send("Page.navigate", { url: `${origin}${RECORD}?model-viewer-webgl=fail` });
      await waitFor(cdp, `location.search === '?model-viewer-webgl=fail'`);
      await waitFor(cdp, `document.readyState === 'complete'`);
      await revealViewer(cdp);
      await waitFor(cdp, `document.querySelector('[data-component-model-viewer-root]')?.dataset.viewerState === 'unavailable'`);
      assertEqual(await evaluate(cdp, `document.querySelectorAll('[data-model-viewer-viewport] canvas').length`), 0, "no canvas after forced WebGL failure");
      assertEqual(await evaluate(cdp, `document.querySelector('[data-model-viewer-status]')?.textContent.includes('WebGL is unavailable')`), true, "meaningful WebGL fallback");
      process.stdout.write("model viewer browser smoke passed: load, on-demand idle, SPA cleanup/back, model/WebGL fallbacks\n");
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
