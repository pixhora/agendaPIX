import { describe, expect, it } from "vitest";
import { isOwnServiceImageUrl } from "../../lib/business-profile/service-image";

const id = "3f0c1e2a-1111-4b2c-9d3e-000000000001";

describe("isOwnServiceImageUrl", () => {
  it("accepts our own service photo paths on the blob host", () => {
    expect(isOwnServiceImageUrl(`https://blob.fake.local/services/${id}-abc.webp`, id)).toBe(true);
  });

  it("refuses another service's photo, a logo, or a non-https URL", () => {
    expect(isOwnServiceImageUrl("https://blob.fake.local/services/outro-abc.webp", id)).toBe(false);
    expect(isOwnServiceImageUrl(`https://blob.fake.local/logos/${id}-abc.webp`, id)).toBe(false);
    expect(isOwnServiceImageUrl(`http://blob.fake.local/services/${id}-abc.webp`, id)).toBe(false);
    expect(isOwnServiceImageUrl("https://example.com/foto.jpg", id)).toBe(false);
  });
});
