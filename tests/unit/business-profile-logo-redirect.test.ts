import { NextRequest, type NextFetchEvent } from "next/server";
import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cachedAliasTarget, clearAliasCache, invalidateAliasCache } from "../../lib/business-profile/alias-cache";
import { LOGO_UPLOAD_MAX_BYTES } from "../../lib/contracts";
import { HttpError } from "../../lib/http";
import { assertLogoBytes, reencodeLogo } from "../../lib/business-profile/logo-image";
import { createFakeBlobStore, createVercelBlobStore, resolveBlobStore } from "../../lib/business-profile/logo-store";
import { aliasTarget, locationForMovedSlug, publicSlugFromPath, slugMovedResponse } from "../../lib/business-profile/public-slug";
import { rejectTakenSlug, slugTakenError } from "../../lib/business-profile/slug-conflict";
import { slugAvailability, takenSlugs } from "../../lib/slug-availability";
import { proxy } from "../../proxy";

/** O segundo argumento do proxy é o evento do Next. Função nesse lugar é a busca do teste. */
function asProxyEvent(lookup: (slug: string) => Promise<string | null>): NextFetchEvent {
  return lookup as unknown as NextFetchEvent;
}

const { putMock, delMock } = vi.hoisted(() => ({ putMock: vi.fn(), delMock: vi.fn() }));

vi.mock("@vercel/blob", () => ({
  put: putMock,
  del: delMock,
}));

const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function solid(width: number, height: number, format: "png" | "jpeg" | "webp") {
  return sharp({ create: { width, height, channels: 3, background: { r: 18, g: 52, b: 86 } } })[format]().toBuffer();
}

describe("logo bytes", () => {
  it("rejects SVG, XML and HTML by content, including a fake image extension", () => {
    for (const markup of [
      "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>",
      "<?xml version=\"1.0\"?><svg xmlns=\"http://www.w3.org/2000/svg\"/>",
      "<!DOCTYPE html><html></html>",
      "   <html><body>logo.png</body></html>",
    ]) {
      expect(() => assertLogoBytes(new TextEncoder().encode(markup))).toThrow(HttpError);
      try {
        assertLogoBytes(new TextEncoder().encode(markup));
      } catch (error) {
        expect(error).toMatchObject({ status: 400, code: "logo_invalid" });
      }
    }
  });

  it("rejects anything over 2 MB before decoding", () => {
    const bytes = new Uint8Array(LOGO_UPLOAD_MAX_BYTES + 1);
    bytes.set(pngSignature);
    expect(() => assertLogoBytes(bytes)).toThrow(HttpError);
    try {
      assertLogoBytes(bytes);
    } catch (error) {
      expect(error).toMatchObject({ status: 413, code: "logo_too_large" });
    }
  });

  it("accepts PNG, JPEG and WebP by magic bytes and re-encodes them as WebP", async () => {
    for (const format of ["png", "jpeg", "webp"] as const) {
      const source = await solid(24, 16, format);
      expect(() => assertLogoBytes(source)).not.toThrow();
      const encoded = await reencodeLogo(source);
      const meta = await sharp(encoded).metadata();
      expect(meta.format).toBe("webp");
      expect(meta.width).toBe(24);
      expect(meta.height).toBe(16);
    }
  });

  it("fits the long edge inside 512 px and does not enlarge a small image", async () => {
    const wide = await reencodeLogo(await solid(800, 400, "png"));
    const wideMeta = await sharp(wide).metadata();
    expect(wideMeta.width).toBe(512);
    expect(wideMeta.height).toBe(256);

    const small = await reencodeLogo(await solid(40, 20, "jpeg"));
    const smallMeta = await sharp(small).metadata();
    expect(smallMeta.width).toBe(40);
    expect(smallMeta.height).toBe(20);
  });

  it("strips EXIF when it re-encodes", async () => {
    const jpeg = await solid(640, 480, "jpeg");
    const tagged = await sharp(jpeg).withMetadata({
      exif: { IFD0: { ImageDescription: "secret-exif-marker" } },
    }).jpeg().toBuffer();
    const before = await sharp(tagged).metadata();
    expect(before.exif?.toString("utf8")).toContain("secret-exif-marker");

    const encoded = await reencodeLogo(tagged);
    const after = await sharp(encoded).metadata();
    expect(after.format).toBe("webp");
    expect(after.width).toBe(512);
    expect(after.height).toBe(384);
    expect(after.exif).toBeUndefined();
    expect(encoded.toString("utf8")).not.toContain("secret-exif-marker");
  });
});

describe("blob store", () => {
  beforeEach(() => {
    putMock.mockReset();
  });

  it("uses the fake host outside production and refuses it when the token is missing in production", async () => {
    expect(() => resolveBlobStore({ NODE_ENV: "production", BLOB_READ_WRITE_TOKEN: "  " })).toThrow(HttpError);
    try {
      resolveBlobStore({ NODE_ENV: "production" });
    } catch (error) {
      expect(error).toMatchObject({ status: 503, code: "blob_unavailable" });
    }

    const fake = resolveBlobStore({ NODE_ENV: "test" });
    const uploaded = await fake.put("logos/negocio.webp", Buffer.from("webp"), {
      access: "public",
      addRandomSuffix: true,
      contentType: "image/webp",
    });
    expect(uploaded.url).toMatch(/^https:\/\/blob\.fake\.local\/logos\/negocio-[a-f0-9]+\.webp$/);
    expect(putMock).not.toHaveBeenCalled();
  });

  it("passes the public access, random suffix and explicit token to put", async () => {
    putMock.mockResolvedValue({ url: "https://abc.public.blob.vercel-storage.com/logos/negocio-rand.webp" });
    const body = Buffer.from("webp");
    const uploaded = await createVercelBlobStore("token-test").put("logos/negocio.webp", body, {
      access: "public",
      addRandomSuffix: true,
      contentType: "image/webp",
    });
    expect(putMock).toHaveBeenCalledWith("logos/negocio.webp", body, {
      access: "public",
      addRandomSuffix: true,
      contentType: "image/webp",
      token: "token-test",
    });
    expect(uploaded.url).toBe("https://abc.public.blob.vercel-storage.com/logos/negocio-rand.webp");

    putMock.mockClear();
    const store = resolveBlobStore({ NODE_ENV: "production", BLOB_READ_WRITE_TOKEN: "token-prod" });
    putMock.mockResolvedValue({ url: "https://abc.public.blob.vercel-storage.com/logos/negocio-prod.webp" });
    await store.put("logos/negocio.webp", body, { access: "public", addRandomSuffix: true, contentType: "image/webp" });
    expect(putMock.mock.calls[0]?.[2]).toMatchObject({ token: "token-prod", addRandomSuffix: true, access: "public" });
  });

  it("rejects a fake store call that drops the random suffix", async () => {
    const store = createFakeBlobStore(() => "fixed");
    await expect(store.put("logos/negocio.webp", Buffer.from("x"), {
      access: "public",
      addRandomSuffix: false as unknown as true,
      contentType: "image/webp",
    })).rejects.toMatchObject({ status: 503, code: "blob_unavailable" });
  });
});

describe("slug redirect", () => {
  beforeEach(() => {
    clearAliasCache();
  });

  it("maps a unique violation to slug_taken and ignores other codes", () => {
    expect(slugTakenError({ code: "23505" })).toMatchObject({
      status: 409,
      code: "slug_taken",
      details: { details: { constraint: "slug" } },
    });
    expect(slugTakenError(new Error("wrapped", { cause: { code: "23505" } }))).toMatchObject({ status: 409, code: "slug_taken" });
    expect(slugTakenError({ code: "23503" })).toBeNull();
  });

  it("keeps the suffix and the query when the slug moves", () => {
    expect(locationForMovedSlug("https://agenda.example/antiga/opengraph-image?ref=wa", "antiga", "nova")).toBe("/nova/opengraph-image?ref=wa");
    expect(locationForMovedSlug(
      "https://agenda.example/api/public/antiga/bookings/11111111-1111-4111-8111-111111111111/payment?x=1",
      "antiga",
      "nova",
    )).toBe("/api/public/nova/bookings/11111111-1111-4111-8111-111111111111/payment?x=1");
    const response = slugMovedResponse("https://agenda.example/antiga?ref=wa", "antiga", "nova");
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("/nova?ref=wa");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("does not treat the slug checker or config as a business page", () => {
    expect(publicSlugFromPath("/api/public/slugs/availability")).toBeNull();
    expect(publicSlugFromPath("/api/public/config")).toBeNull();
    expect(publicSlugFromPath("/dashboard")).toBeNull();
    expect(publicSlugFromPath("/api/health")).toBeNull();
    expect(publicSlugFromPath("/salao/opengraph-image")).toBe("salao");
    expect(publicSlugFromPath("/api/public/salao/services")).toBe("salao");
    expect(publicSlugFromPath("/api/public/salao/bookings/abc/payment")).toBe("salao");
  });

  it("answers 308 from the proxy for the page and the public API", async () => {
    const page = await proxy(new NextRequest("https://agenda.example/antiga/opengraph-image?ref=wa"), asProxyEvent(async () => "nova"));
    expect(page.status).toBe(308);
    expect(page.headers.get("location")).toBe("https://agenda.example/nova/opengraph-image?ref=wa");
    expect(page.headers.get("cache-control")).toBe("no-store");
    expect(page.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");

    const payment = await proxy(
      new NextRequest("https://agenda.example/api/public/antiga/bookings/11111111-1111-4111-8111-111111111111/payment?x=1"),
      asProxyEvent(async () => "nova"),
    );
    expect(payment.status).toBe(308);
    expect(payment.headers.get("location")).toBe(
      "https://agenda.example/api/public/nova/bookings/11111111-1111-4111-8111-111111111111/payment?x=1",
    );
    expect(payment.headers.get("cache-control")).toBe("no-store");

    let lookedUp = false;
    const checker = await proxy(new NextRequest("https://agenda.example/api/public/slugs/availability?slug=loja"), asProxyEvent(async () => {
      lookedUp = true;
      return "nova";
    }));
    expect(lookedUp).toBe(false);
    expect(checker.status).not.toBe(308);

    let skipped = 0;
    await proxy(new NextRequest("https://agenda.example/dashboard"), asProxyEvent(async () => {
      skipped += 1;
      return "nova";
    }));
    await proxy(new NextRequest("https://agenda.example/onboarding"), asProxyEvent(async () => {
      skipped += 1;
      return "nova";
    }));
    await proxy(new NextRequest("https://agenda.example/login"), asProxyEvent(async () => {
      skipped += 1;
      return "nova";
    }));
    expect(skipped).toBe(0);
  });

  it("returns a retryable slug_taken with up to three free suggestions", async () => {
    await expect(rejectTakenSlug({
      async execute() {
        return { rows: [] };
      },
    } as never, "loja", "slug")).rejects.toMatchObject({
      status: 409,
      code: "slug_taken",
      details: { details: { constraint: "slug", suggestions: ["loja-2", "loja-3", "loja-4"] } },
    });

    await expect(rejectTakenSlug({
      async execute() {
        throw new Error("db down");
      },
    } as never, "loja", "businesses_slug_unique")).rejects.toMatchObject({
      status: 409,
      code: "slug_taken",
      details: { details: { constraint: "businesses_slug_unique", suggestions: [] } },
    });

    await expect(rejectTakenSlug({
      async execute() {
        return { rows: [] };
      },
    } as never, "loja", "slug", "slug_conflict_retry")).rejects.toMatchObject({
      status: 409,
      code: "slug_conflict_retry",
      message: "Esse link acabou de ser escolhido por outra pessoa. Escolha uma das sugestões.",
      details: { details: { constraint: "slug", suggestions: ["loja-2", "loja-3", "loja-4"] } },
    });
  });

  it("remembers a released alias as a miss and looks again after the slug changes", async () => {
    let hits = 0;
    const lookup = async () => {
      hits += 1;
      return null;
    };
    const first = await proxy(new NextRequest("https://agenda.example/antiga"), asProxyEvent(lookup));
    const second = await proxy(new NextRequest("https://agenda.example/antiga/opengraph-image"), asProxyEvent(lookup));
    expect(first.status).not.toBe(308);
    expect(second.status).not.toBe(308);
    expect(hits).toBe(1);

    invalidateAliasCache("antiga");
    await proxy(new NextRequest("https://agenda.example/antiga"), asProxyEvent(lookup));
    expect(hits).toBe(2);

    clearAliasCache();
    let selects = 0;
    const database = {
      select() {
        selects += 1;
        const chain = {
          from: () => chain,
          innerJoin: () => chain,
          where: () => chain,
          limit: async () => [],
        };
        return chain;
      },
    };
    expect(await aliasTarget("antiga", database as never)).toBeNull();
    expect(await aliasTarget("antiga", database as never)).toBeNull();
    expect(selects).toBe(1);
    invalidateAliasCache("antiga");
    expect(await aliasTarget("antiga", database as never)).toBeNull();
    expect(selects).toBe(2);
  });

  it("remembers an alias lookup for a minute and does not remember a database error", async () => {
    let hits = 0;
    const lookup = async () => {
      hits += 1;
      return "nova";
    };
    await proxy(new NextRequest("https://agenda.example/antiga?ref=wa"), asProxyEvent(lookup));
    await proxy(new NextRequest("https://agenda.example/antiga/opengraph-image?ref=wa"), asProxyEvent(lookup));
    expect(hits).toBe(1);

    clearAliasCache();
    let failures = 0;
    const failing = async () => {
      failures += 1;
      throw new Error("db down");
    };
    await proxy(new NextRequest("https://agenda.example/antiga"), asProxyEvent(failing));
    await proxy(new NextRequest("https://agenda.example/antiga"), asProxyEvent(failing));
    expect(failures).toBe(2);
  });

  it("keeps the alias cache on globalThis so a slug change in this process drops the miss", async () => {
    clearAliasCache();
    await cachedAliasTarget("antiga", async () => null);
    const map = (globalThis as { __agendapixAliasCache?: Map<string, unknown> }).__agendapixAliasCache;
    expect(map?.has("antiga")).toBe(true);
    invalidateAliasCache("antiga");
    expect(map?.has("antiga")).toBe(false);
    expect(await cachedAliasTarget("antiga", async () => "nova")).toBe("nova");
    expect(map?.get("antiga")).toMatchObject({ target: "nova" });
  });

  it("checks current slugs and aliases in one query and drops an alias from the suggestions", async () => {
    let calls = 0;
    const taken = await takenSlugs(["loja", "loja-lash", "loja-2"], {
      async execute() {
        calls += 1;
        return { rows: [{ slug: "loja-lash" }] };
      },
    } as never);
    expect(calls).toBe(1);
    expect(taken.has("loja-lash")).toBe(true);

    const result = await slugAvailability("loja", { segment: "cilios" }, {
      async execute() {
        return { rows: [{ slug: "loja" }, { slug: "loja-lash" }] };
      },
    } as never);
    expect(result).toMatchObject({ available: false, reason: "taken", valid: true });
    expect(result.suggestions).not.toContain("loja-lash");
    expect(result.suggestions[0]).toBe("loja-2");
    expect(result.suggestions.length).toBeLessThanOrEqual(3);
  });
});
