import { del as deleteBlob, put } from "@vercel/blob";
import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db";
import { businesses } from "../../db/schema";
import { FAKE_BLOB_HOST, LOGO_UPLOAD_FIELD, LOGO_UPLOAD_MAX_BYTES, businessLogoUrlSchema, logoUploadResponseSchema, logoUrlRejection } from "../contracts";
import { consumeAbuseBucket } from "../abuse-rate-limit";
import { HttpError } from "../http";
import { invalidatePublicCatalog } from "../bookings/public-cache";
import { findOwnedBusiness } from "../tenancy";
import { reencodeLogo } from "./logo-image";

/** Multipart boundary and headers on top of the 2 MB file. */
export const LOGO_REQUEST_OVERHEAD_BYTES = 16 * 1024;
export const LOGO_REQUEST_MAX_BYTES = LOGO_UPLOAD_MAX_BYTES + LOGO_REQUEST_OVERHEAD_BYTES;

/**
 * Upload no servidor com `put`.
 * https://vercel.com/docs/vercel-blob/using-blob-sdk#put
 * `access: "public"` publica em `*.public.blob.vercel-storage.com`.
 * `addRandomSuffix` padrão do `put` é false; aqui vai true de propósito.
 */
export type LogoBlobStore = {
  put(pathname: string, body: Buffer, options: { access: "public"; addRandomSuffix: true; contentType: "image/webp" }): Promise<{ url: string }>;
  del(url: string): Promise<void>;
};

type Env = Readonly<Record<string, string | undefined>>;
export type Database = ReturnType<typeof getDb>;

export function isOwnLogoUrl(url: string, businessId: string): boolean {
  if (logoUrlRejection(url) !== null) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const prefix = `/logos/${businessId}`;
  return parsed.pathname === prefix
    || parsed.pathname.startsWith(`${prefix}-`)
    || parsed.pathname.startsWith(`${prefix}.`)
    || parsed.pathname.startsWith(`${prefix}/`);
}

export function createFakeBlobStore(random: () => string = () => randomBytes(8).toString("hex")): LogoBlobStore {
  return {
    async put(pathname, _body, options) {
      if (options.access !== "public" || options.addRandomSuffix !== true || options.contentType !== "image/webp") {
        throw new HttpError(503, "blob_unavailable", "O envio da logo está indisponível.");
      }
      const base = pathname.replace(/\.[^.]+$/, "").replace(/^\/+/, "");
      return { url: `https://${FAKE_BLOB_HOST}/${base}-${random()}.webp` };
    },
    async del() {
      return undefined;
    },
  };
}

export function createVercelBlobStore(token: string): LogoBlobStore {
  return {
    async put(pathname, body, options) {
      const blob = await put(pathname, body, {
        access: "public",
        addRandomSuffix: true,
        contentType: options.contentType,
        token,
      });
      return { url: blob.url };
    },
    async del(url) {
      await deleteBlob(url, { token });
    },
  };
}

/** Sem token: adaptador falso fora de produção. Em produção, 503. Nunca cai no falso. */
export function resolveBlobStore(env: Env = process.env): LogoBlobStore {
  const token = env.BLOB_READ_WRITE_TOKEN?.trim();
  if (token) return createVercelBlobStore(token);
  if (env.NODE_ENV === "production") {
    throw new HttpError(503, "blob_unavailable", "O envio da logo está indisponível.");
  }
  return createFakeBlobStore();
}

export async function ownedBusiness(businessId: string, ownerId: string, database: Pick<Database, "select">) {
  const id = z.uuid().safeParse(businessId);
  if (!id.success) throw new HttpError(404, "business_unavailable", "Este negócio não está disponível para sua conta.");
  const business = await findOwnedBusiness(id.data, ownerId, database);
  if (!business) throw new HttpError(404, "business_unavailable", "Este negócio não está disponível para sua conta.");
  return business;
}

export async function readLogoFile(request: Request) {
  const declared = request.headers.get("content-length");
  if (declared !== null) {
    const length = Number(declared);
    if (!Number.isInteger(length) || length < 0 || length > LOGO_REQUEST_MAX_BYTES) {
      throw new HttpError(413, "logo_too_large", "A imagem passa de 2 MB. Envie um arquivo menor.");
    }
  }
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "logo_invalid", "Envie a imagem no campo logo.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > LOGO_REQUEST_MAX_BYTES) {
        await reader.cancel();
        throw new HttpError(413, "logo_too_large", "A imagem passa de 2 MB. Envie um arquivo menor.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const contentType = request.headers.get("content-type");
  if (!contentType) throw new HttpError(400, "logo_invalid", "Envie a imagem no campo logo.");
  let form: FormData;
  try {
    form = await new Request(request.url, {
      method: "POST",
      headers: { "content-type": contentType },
      body: Buffer.concat(chunks),
    }).formData();
  } catch {
    throw new HttpError(400, "logo_invalid", "Envie a imagem no campo logo.");
  }
  const file = form.get(LOGO_UPLOAD_FIELD);
  if (!(file instanceof File)) throw new HttpError(400, "logo_invalid", "Envie a imagem no campo logo.");
  return new Uint8Array(await file.arrayBuffer());
}

async function writeLogo(
  business: { id: string; slug: string; logoUrl: string | null },
  ownerId: string,
  bytes: Uint8Array,
  database: Database,
  store: LogoBlobStore,
) {
  const image = await reencodeLogo(bytes);
  const previous = business.logoUrl;
  const uploaded = await store.put(`logos/${business.id}.webp`, image, {
    access: "public",
    addRandomSuffix: true,
    contentType: "image/webp",
  });
  const logoUrl = businessLogoUrlSchema.parse(uploaded.url);
  const [updated] = await database.update(businesses).set({ logoUrl }).where(and(eq(businesses.id, business.id), eq(businesses.ownerId, ownerId))).returning({ logoUrl: businesses.logoUrl });
  if (!updated?.logoUrl) throw new HttpError(503, "blob_unavailable", "O envio da logo está indisponível.");
  if (previous && previous !== updated.logoUrl && isOwnLogoUrl(previous, business.id)) {
    try {
      await store.del(previous);
    } catch (error) {
      console.error("[logo] delete_failed", error instanceof Error ? error.message : "unknown");
    }
  }
  await invalidatePublicCatalog(business.slug);
  return logoUploadResponseSchema.parse({ logoUrl: updated.logoUrl });
}

export async function saveBusinessLogo(
  businessId: string,
  ownerId: string,
  bytes: Uint8Array,
  database: Database = getDb(),
  store: LogoBlobStore = resolveBlobStore(),
) {
  const business = await ownedBusiness(businessId, ownerId, database);
  await consumeAbuseBucket("logo-upload", ownerId, 10, "hour", database);
  return writeLogo(business, ownerId, bytes, database, store);
}

export async function uploadBusinessLogo(
  businessId: string,
  ownerId: string,
  request: Request,
  database: Database = getDb(),
  store: LogoBlobStore = resolveBlobStore(),
) {
  const business = await ownedBusiness(businessId, ownerId, database);
  await consumeAbuseBucket("logo-upload", ownerId, 10, "hour", database);
  const bytes = await readLogoFile(request);
  return writeLogo(business, ownerId, bytes, database, store);
}
