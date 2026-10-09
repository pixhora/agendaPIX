import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readManualCheckoutConfig } from "../../lib/billing/config";
import { readSupportWhatsappNumber, supportWhatsappUrl } from "../../lib/support-contact";

const fallbackDigits = "5514997504655";

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return filesUnder(path);
    return path.endsWith(".ts") ? [path] : [];
  });
}

describe("WhatsApp de apoio", () => {
  it("lê SUPPORT_WHATSAPP_NUMBER com a mesma regra do checkout e usa o padrão só no link", () => {
    const env = { SUPPORT_WHATSAPP_NUMBER: "5511912345678" };
    expect(readSupportWhatsappNumber(env)).toBe("5511912345678");
    expect(supportWhatsappUrl(env)).toBe("https://wa.me/5511912345678");
    expect(readManualCheckoutConfig({ ...env, SUBSCRIPTION_MANUAL_ACTIVATION_HOURS: "1" })).toMatchObject({
      available: true,
      whatsappNumber: "5511912345678",
    });
    expect(readSupportWhatsappNumber({ SUPPORT_WHATSAPP_NUMBER: "5500000000000" })).toBeNull();
    expect(readSupportWhatsappNumber({ SUPPORT_WHATSAPP_NUMBER: fallbackDigits })).toBe(fallbackDigits);

    for (const missing of [{}, { SUPPORT_WHATSAPP_NUMBER: "" }, { SUPPORT_WHATSAPP_NUMBER: "+5500000000000" }, { SUPPORT_WHATSAPP_NUMBER: "123" }]) {
      expect(readSupportWhatsappNumber(missing)).toBeNull();
      expect(supportWhatsappUrl(missing)).toBe(`https://wa.me/${fallbackDigits}`);
      expect(readManualCheckoutConfig(missing)).toMatchObject({ available: false, whatsappNumber: null });
    }
  });

  it("guarda o número de apoio num lugar só", () => {
    const support = readFileSync(join(import.meta.dirname, "../../lib/support-contact.ts"), "utf8");
    expect(support.match(new RegExp(fallbackDigits, "g"))).toHaveLength(1);
    const billing = filesUnder(join(import.meta.dirname, "../../lib/billing"));
    for (const path of billing) {
      expect(readFileSync(path, "utf8"), path).not.toContain(fallbackDigits);
    }
  });
});
