import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const baseURL = process.env.QA_PERF_URL ?? "http://127.0.0.1:3001";
const output = process.env.QA_PERF_OUTPUT ?? "dogfood-output/mobile-dev-baseline.json";
const routes = (process.env.QA_PERF_ROUTES ?? "/preview,/preview/landing,/").split(",");
const samples = Number(process.env.QA_PERF_SAMPLES ?? 3);
const profile = { width: 375, height: 812, latencyMs: 150, downloadBitsPerSecond: 1600000, uploadBitsPerSecond: 750000, cpuThrottle: 1 };
const browser = await chromium.launch();
const results = [];
try {
  for (const route of routes) {
    for (let sample = 1; sample <= samples; sample++) {
      const context = await browser.newContext({ viewport: { width: profile.width, height: profile.height }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send("Network.enable");
      await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
      await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: profile.latencyMs, downloadThroughput: profile.downloadBitsPerSecond / 8, uploadThroughput: profile.uploadBitsPerSecond / 8 });
      await page.addInitScript(() => {
        globalThis.qaLcp = null;
        new PerformanceObserver(list => { globalThis.qaLcp = list.getEntries().at(-1)?.startTime ?? null; }).observe({ type: "largest-contentful-paint", buffered: true });
      });
      const network = new Map();
      let websocketCount = 0;
      const errors = { console: [], page: [], http: [], failedRequests: [] };
      cdp.on("Network.requestWillBeSent", event => {
        if (!event.request.url.startsWith("http")) return;
        const url = new URL(event.request.url);
        network.set(event.requestId, { path: url.pathname, external: url.origin !== new URL(baseURL).origin, type: event.type, bytes: 0, finished: false });
      });
      cdp.on("Network.responseReceived", event => {
        const entry = network.get(event.requestId);
        if (entry) { entry.type = event.type; entry.status = event.response.status; }
        if (event.response.status >= 400) errors.http.push({ path: new URL(event.response.url).pathname, status: event.response.status });
      });
      cdp.on("Network.loadingFinished", event => { const entry = network.get(event.requestId); if (entry) { entry.bytes = event.encodedDataLength; entry.finished = true; } });
      cdp.on("Network.loadingFailed", event => { const entry = network.get(event.requestId); errors.failedRequests.push({ path: entry?.path ?? "unknown", error: event.errorText }); });
      cdp.on("Network.webSocketCreated", () => websocketCount++);
      page.on("pageerror", error => errors.page.push(error.message.slice(0, 300)));
      page.on("console", message => { if (message.type() === "error") errors.console.push(message.text().slice(0, 300)); });
      let navigationError = null, status = null;
      try {
        const response = await page.goto(new URL(route, baseURL).href, { waitUntil: "load", timeout: 120000 });
        status = response?.status() ?? null;
        // Janela fixa após load evita esperar indefinidamente pelo HMR do dev.
        await page.waitForTimeout(3000);
      } catch (error) { navigationError = error.message.slice(0, 300); }
      const timing = await page.evaluate(() => {
        const nav = performance.getEntriesByType("navigation")[0];
        const fcp = performance.getEntriesByName("first-contentful-paint")[0];
        return nav ? { ttfbMs: nav.responseStart - nav.requestStart, firstByteFromNavigationMs: nav.responseStart, domContentLoadedMs: nav.domContentLoadedEventEnd, loadMs: nav.loadEventEnd, fcpMs: fcp?.startTime ?? null, lcpObservedMs: globalThis.qaLcp, documentTransferBytes: nav.transferSize } : null;
      }).catch(() => null);
      const entries = [...network.values()];
      const javascript = entries.filter(entry => entry.type === "Script");
      const result = { route, sample, status, timing, requests: entries.length, transferBytes: entries.reduce((sum, entry) => sum + entry.bytes, 0), javascriptRequests: javascript.length, javascriptTransferBytes: javascript.reduce((sum, entry) => sum + entry.bytes, 0), unfinishedRequests: entries.filter(entry => !entry.finished).length, externalRequests: entries.filter(entry => entry.external).length, websocketCount, navigationError, errors, resources: entries };
      results.push(result);
      await page.screenshot({ path: output.replace(/\.json$/, `-${route.replaceAll("/", "_") || "root"}-${sample}.png`) });
      await context.close();
      console.log(JSON.stringify({ route, sample, status, ...timing, requests: result.requests, transferBytes: result.transferBytes, javascriptTransferBytes: result.javascriptTransferBytes, errors: Object.values(errors).reduce((sum, list) => sum + list.length, 0) }));
      await mkdir(dirname(output), { recursive: true });
      await writeFile(output, JSON.stringify({ baseURL, commit: process.env.QA_PERF_COMMIT ?? "unconfirmed", profile, observationWindow: "load + 3000ms; cache disabled; fresh browser context; HTTP encoded transfer, WebSocket payload excluded", results }, null, 2));
    }
  }
} finally { await browser.close(); }
