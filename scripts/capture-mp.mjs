import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

process.env.LANG = "pt_BR.UTF-8";
process.env.LC_ALL = "pt_BR.UTF-8";

const base = process.env.MP_CAPTURE_URL ?? "http://127.0.0.1:3399";
const outDir = process.env.MP_CAPTURE_DIR ?? "/opt/cursor/artifacts/mp-v2";
const only = new Set((process.env.MP_CAPTURE_ONLY ?? "").split(",").map((name) => name.trim()).filter(Boolean));
const shots = new Set((process.env.MP_CAPTURE_SHOTS ?? "").split(",").map((name) => name.trim()).filter(Boolean));
const captureDismiss = process.env.MP_CAPTURE_DISMISS === "1";

const scenes = [
  { name: "onboarding-unchecked", scene: "onboarding", long: true },
  { name: "onboarding-ack-error", scene: "onboarding", long: true, click: "Continuar para o Mercado Pago" },
  { name: "onboarding-connected", scene: "onboarding-connected" },
  { name: "onboarding-account-email", scene: "onboarding-account-email" },
  { name: "onboarding-account-fallback", scene: "onboarding-account-fallback" },
  { name: "onboarding-error", scene: "onboarding-error", long: true },
  { name: "settings-connected", scene: "settings-connected" },
  { name: "settings-account-email", scene: "settings-account-email" },
  { name: "settings-account-fallback", scene: "settings-account-fallback" },
  { name: "settings-legacy", scene: "settings-legacy" },
  { name: "settings-not-connected", scene: "settings-not-connected", long: true },
  { name: "settings-needs-reconnect", scene: "settings-needs-reconnect", long: true },
  { name: "settings-reconnect-ack", scene: "settings-reconnect-ack", long: true },
  { name: "settings-test-mode", scene: "settings-test" },
  { name: "disconnect-dialog", scene: "disconnect" },
  { name: "banner-reauth", scene: "banner" },
  { name: "public-deposit-unavailable", scene: "public" },
  { name: "cadastro", path: "/onboarding", widths: [390] },
  { name: "rodape-aro", scene: "public", footer: true, widths: [390] },
];

const viewports = [
  { label: "390-light", width: 390, height: 844, theme: "light" },
  { label: "390-dark", width: 390, height: 844, theme: "dark" },
  { label: "1440-light", width: 1440, height: 900, theme: "light" },
];

const browser = await chromium.launch({ args: ["--lang=pt-BR"] });
await mkdir(outDir, { recursive: true });

for (const scene of scenes) {
  if (only.size > 0 && !only.has(scene.name)) continue;
  for (const viewport of viewports) {
    if (scene.widths && !scene.widths.includes(viewport.width)) continue;
    if (shots.size > 0 && !shots.has(`${scene.name}:${viewport.label}`)) continue;
    const context = await browser.newContext({
      locale: "pt-BR",
      timezoneId: "America/Sao_Paulo",
      viewport: { width: viewport.width, height: viewport.height },
      reducedMotion: "reduce",
      colorScheme: viewport.theme,
    });
    await context.addInitScript((theme) => {
      localStorage.setItem("agenda-theme", theme);
    }, viewport.theme);
    const page = await context.newPage();
    const path = scene.path ?? `/dev/mp-fixtures?scene=${scene.scene}`;
    await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
    await page.addStyleTag({
      content: `nextjs-portal,[data-nextjs-dev-tools-button],[data-next-badge],[data-nextjs-toast],[aria-label="Controles do Modo Preview"]{display:none!important}`,
    });
    if (scene.click) {
      await page.getByRole("button", { name: scene.click }).click();
      await page.getByText("Marque a autorização da devolução automática para continuar.").waitFor();
    }
    if (scene.footer) {
      await page.locator("footer").scrollIntoViewIfNeeded();
    }
    const file = `${outDir}/${scene.name}-${viewport.label}.png`;
    await page.screenshot({ path: file });
    if (captureDismiss && scene.name === "settings-legacy" && viewport.label === "390-light") {
      await page.route("**/notices/pix_key_retired/dismiss", (route) => route.fulfill({ status: 204, body: "" }));
      await page.getByRole("button", { name: "Entendi" }).click();
      await page.getByText("A chave Pix que você cadastrou antes não é mais usada.").waitFor({ state: "hidden" });
      await page.screenshot({ path: `${outDir}/${scene.name}-${viewport.label}-dismissed.png` });
    }
    if (viewport.width === 390 && !scene.footer && only.size === 0 && shots.size === 0) {
      await page.evaluate(() => {
        const nodes = [...document.querySelectorAll(".overflow-y-auto")];
        if (nodes.length > 0) {
          for (const node of nodes) node.scrollTop = node.scrollHeight;
          return;
        }
        window.scrollTo(0, document.documentElement.scrollHeight);
      });
      await page.screenshot({ path: `${outDir}/${scene.name}-${viewport.label}-bottom.png` });
    }
    await context.close();
  }
}

await browser.close();
console.log(`saved screenshots in ${outDir}`);
