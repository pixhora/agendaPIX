import { describe, expect, it } from "vitest";
import { logoShrinkSize, LOGO_SHRINK_MAX_EDGE_PX } from "../../lib/store-profile/logo";

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
