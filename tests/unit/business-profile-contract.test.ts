import { afterEach, describe, expect, it } from "vitest";

const originalNodeEnv = process.env.NODE_ENV;
import {
  FAKE_BLOB_HOST,
  businessProfilePatchRequestSchema,
  businessProfileResponseSchema,
  businessProfileSchema,
  logoUploadResponseSchema,
  logoUrlRejection,
  slugAvailabilityResponseSchema,
} from "../../lib/contracts";
import { apiErrorBodySchema } from "../../lib/contracts/errors";
import { RESERVED_BUSINESS_SLUGS } from "../../lib/slug";

const vercelLogo = "https://ce0rcu23vrrdzqap.public.blob.vercel-storage.com/logos/loja-AbCdEf.webp";
const fakeLogo = `https://${FAKE_BLOB_HOST}/logos/loja.webp`;

afterEach(() => {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
});

describe("businessProfile", () => {
  it("exige nome, slug e logo sem preencher o que faltou", () => {
    expect(businessProfileSchema.safeParse({}).success).toBe(false);
    expect(businessProfileSchema.safeParse({ name: "Ana", slug: "ana-lash" }).success).toBe(false);
    expect(businessProfileSchema.safeParse({
      name: "  Ana  ",
      slug: "ana-lash",
      logoUrl: vercelLogo,
    }).data).toMatchObject({ name: "Ana", slug: "ana-lash", logoUrl: vercelLogo });
  });

  it("recusa nome fora de 2 a 60 e slug reservado ou fora do formato", () => {
    const base = { slug: "ana-lash", logoUrl: vercelLogo };
    expect(businessProfileSchema.safeParse({ ...base, name: "A" }).success).toBe(false);
    expect(businessProfileSchema.safeParse({ ...base, name: "A".repeat(61) }).success).toBe(false);
    expect(businessProfileSchema.safeParse({ ...base, name: "Ana", slug: "dashboard" }).success).toBe(false);
    expect(businessProfileSchema.safeParse({ ...base, name: "Ana", slug: "Studio Bella" }).success).toBe(false);
    expect(businessProfileSchema.safeParse({ ...base, name: "Ana", slug: "ab" }).success).toBe(false);
    expect(RESERVED_BUSINESS_SLUGS).toContain("studio-bella");
  });

  it("aceita o host público do Blob e o host falso só fora de produção", () => {
    process.env.NODE_ENV = "test";
    expect(logoUrlRejection(vercelLogo, "production")).toBeNull();
    expect(logoUrlRejection(fakeLogo, "test")).toBeNull();
    expect(logoUrlRejection(fakeLogo, "production")).toBe("logo_invalid");
    expect(logoUrlRejection("http://ce0rcu23vrrdzqap.public.blob.vercel-storage.com/logos/a.webp", "test")).toBe("logo_invalid");
    expect(logoUrlRejection("https://ce0rcu23vrrdzqap.private.blob.vercel-storage.com/logos/a.webp", "test")).toBe("logo_invalid");
    expect(businessProfileSchema.safeParse({ name: "Ana", slug: "ana-lash", logoUrl: fakeLogo }).success).toBe(true);
    process.env.NODE_ENV = "production";
    expect(businessProfileSchema.safeParse({ name: "Ana", slug: "ana-lash", logoUrl: fakeLogo }).success).toBe(false);
  });
});

describe("profile routes", () => {
  it("aceita PATCH parcial e recusa corpo vazio", () => {
    expect(businessProfilePatchRequestSchema.safeParse({}).success).toBe(false);
    expect(businessProfilePatchRequestSchema.safeParse({ name: "Ana Luz" }).success).toBe(true);
    expect(businessProfilePatchRequestSchema.safeParse({ logoUrl: null }).success).toBe(false);
  });

  it("descreve a resposta do perfil, do upload e do erro", () => {
    expect(businessProfileResponseSchema.parse({
      id: "6b0b4a2e-1c3d-4e5f-8a9b-0c1d2e3f4a5b",
      name: "Ana Luz",
      slug: "ana-luz",
      logoUrl: null,
      publicPath: "/ana-luz",
      publicUrl: null,
    }).publicPath).toBe("/ana-luz");
    process.env.NODE_ENV = "test";
    expect(logoUploadResponseSchema.parse({ logoUrl: fakeLogo }).logoUrl).toBe(fakeLogo);
    expect(apiErrorBodySchema.parse({
      error: { code: "slug_taken", message: "Esse endereço já está em uso.", details: { constraint: "businesses_slug_unique" } },
    }).error.code).toBe("slug_taken");
  });

  it("exige sugestões vazias quando o link está livre ou inválido", () => {
    expect(slugAvailabilityResponseSchema.parse({
      input: "ana",
      normalized: "ana",
      valid: true,
      available: true,
      reason: null,
      suggestions: [],
    }).suggestions).toEqual([]);
    expect(slugAvailabilityResponseSchema.safeParse({
      input: "ana",
      normalized: "ana",
      valid: true,
      available: true,
      reason: null,
      suggestions: ["ana-2"],
    }).success).toBe(false);
    expect(slugAvailabilityResponseSchema.parse({
      input: "dashboard",
      normalized: "dashboard",
      valid: false,
      available: false,
      reason: "reserved",
      suggestions: ["dashboard-2"],
    }).suggestions).toEqual(["dashboard-2"]);
  });
});
