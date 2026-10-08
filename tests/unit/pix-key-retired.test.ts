import { describe, expect, it } from "vitest";
import { DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT } from "../../app/api/businesses/[businessId]/pix-key/route";

describe("chave Pix aposentada", () => {
  it("qualquer método responde 410 sem a chave", async () => {
    for (const handler of [GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS]) {
      const response = await handler();
      expect(response.status).toBe(410);
      expect(response.headers.get("cache-control")).toBe("no-store");
      const payload = await response.json();
      expect(payload).toEqual({ error: { code: "pix_key_retired" } });
      const body = JSON.stringify(payload);
      expect(body).not.toContain("hint");
      expect(body).not.toContain("ciphertext");
    }
  });
});
