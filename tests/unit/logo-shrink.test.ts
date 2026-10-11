import { describe, expect, it } from "vitest";
import { LogoUnreadableError, logoShrinkSize, LOGO_SHRINK_MAX_EDGE_PX, prepareLogoFile } from "../../lib/store-profile/logo";

describe("logoShrinkSize", () => {
  it("keeps images that already fit", () => {
    expect(logoShrinkSize(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it("scales a large phone photo down to the longest edge, keeping the ratio", () => {
    expect(logoShrinkSize(4032, 3024)).toEqual({ width: LOGO_SHRINK_MAX_EDGE_PX, height: 768 });
    expect(logoShrinkSize(3024, 4032)).toEqual({ width: 768, height: LOGO_SHRINK_MAX_EDGE_PX });
  });

  it("never enlarges", () => {
    expect(logoShrinkSize(300, 200, 1024)).toEqual({ width: 300, height: 200 });
  });
});

describe("prepareLogoFile", () => {
  it("reports an unreadable pick instead of returning a file the page cannot open", async () => {
    class Unreadable extends File {
      override arrayBuffer(): Promise<ArrayBuffer> {
        return Promise.reject(new DOMException("permission", "NotReadableError"));
      }
    }
    const picked = new Unreadable([new Uint8Array([1, 2, 3])], "foto.jpg", { type: "image/jpeg" });
    await expect(prepareLogoFile(picked)).rejects.toBeInstanceOf(LogoUnreadableError);
  });

  it("keeps a small accepted photo as it is, with the same name and type", async () => {
    const picked = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], "foto.jpg", { type: "image/jpeg" });
    const prepared = await prepareLogoFile(picked);
    expect(prepared.name).toBe("foto.jpg");
    expect(prepared.type).toBe("image/jpeg");
    expect(prepared.size).toBe(4);
  });
});
