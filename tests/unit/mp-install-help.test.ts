import { describe, expect, it } from "vitest";
import { mpStoreLink, mpStorePlatform, MP_APP_STORE_URL, MP_PLAY_STORE_SEARCH_URL } from "../../lib/mercadopago/install-help";

const ANDROID = "Mozilla/5.0 (Linux; Android 14; SM-G990B) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";
const IPAD_DESKTOP_MODE = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15";

describe("mpStorePlatform", () => {
  it("recognizes Android and iPhone", () => {
    expect(mpStorePlatform(ANDROID)).toBe("android");
    expect(mpStorePlatform(IPHONE)).toBe("ios");
  });

  it("treats an iPad in desktop mode as iOS when it has touch", () => {
    expect(mpStorePlatform(IPAD_DESKTOP_MODE, 5)).toBe("ios");
    expect(mpStorePlatform(IPAD_DESKTOP_MODE, 0)).toBe("other");
  });

  it("falls back to other for desktop browsers", () => {
    expect(mpStorePlatform("Mozilla/5.0 (X11; Linux x86_64) Firefox/130")).toBe("other");
  });
});

describe("mpStoreLink", () => {
  it("points each platform to its own store", () => {
    expect(mpStoreLink("android")?.url).toBe(MP_PLAY_STORE_SEARCH_URL);
    expect(mpStoreLink("ios")?.url).toBe(MP_APP_STORE_URL);
    expect(mpStoreLink("other")).toBeNull();
  });
});
