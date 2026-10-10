import { put } from "@vercel/blob";
import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db";
import { businesses } from "../../db/schema";
import { FAKE_BLOB_HOST, LOGO_UPLOAD_FIELD, businessLogoUrlSchema, logoUploadResponseSchema } from "../contracts";
import { consumeAbuseBucket } from "../abuse-rate-limit";
import { HttpError } from "../http";
import { findOwnedBusiness } from "../tenancy";
import { reencodeLogo } from "./logo-image";

/**
 * Upload no servidor com `put`.
 * https://vercel.com/docs/vercel-blob/using-blob-sdk#put
 * `access: "public"` publica em `*.public.blob.vercel-storage.com`.
 * `addRandomSuffix` padrão do `put` é false; aqui vai true de propósito.
 */
export type LogoBlobStore = {
  put(pathname: string, body: Buffer, options: { access: "public"; addRandomSuffix: true; contentType: "image/webp" }): Promise<{ url: string }>;
};

type Env = Readonly<Record<string, string | undefined>>;

export function createFakeBlobStore(random: () => string = () => randomBytes(8).toString("hex")): LogoBlobStore {
  return {
    async put(pathname, _body, options) {
      if (options.access !== "public" || options.addRandomSuffix !== true || options.contentType !== "image/webp") {
        throw new HttpError(503, "blob_unavailable", "O envio da logo está indisponível.");
      }
      const base = pathname.replace(/\.[^.]+$/, "").replace(/^\/+/, "");
      return { url: `https://${FAKE_BLOB_HOST}/${base}-${random()}.webp` };
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

async function readLogoFile(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new HttpError(400, "logo_invalid", "Envie a imagem no campo logo.");
  }
  const file = form.get(LOGO_UPLOAD_FIELD);
  if (!(file instanceof File)) throw new HttpError(400, "logo_invalid", "Envie a imagem no campo logo.");
  return new Uint8Array(await file.arrayBuffer());
}

export async function saveBusinessLogo(
  businessId: string,
  ownerId: string,
  bytes: Uint8Array,
  database: ReturnType<typeof getDb> = getDb(),
  store: LogoBlobStore = resolveBlobStore(),
) {
  const id = z.uuid().safeParse(businessId);
  if (!id.success) throw new HttpError(404, "business_unavailable", "Este negócio não está disponível para sua conta.");
  const business = await findOwnedBusiness(id.data, ownerId, database);
  if (!business) throw new HttpError(404, "business_unavailable", "Este negócio não está disponível para sua conta.");
  await consumeAbuseBucket("logo-upload", ownerId, 10, "hour", database);
  const image = await reencodeLogo(bytes);
  const uploaded = await store.put(`logos/${business.id}.webp`, image, {
    access: "public",
    addRandomSuffix: true,
    contentType: "image/webp",
  });
  const logoUrl = businessLogoUrlSchema.parse(uploaded.url);
  const [updated] = await database.update(businesses).set({ logoUrl }).where(and(eq(businesses.id, business.id), eq(businesses.ownerId, ownerId))).returning({ logoUrl: businesses.logoUrl });
  if (!updated?.logoUrl) throw new HttpError(503, "blob_unavailable", "O envio da logo está indisponível.");
  return logoUploadResponseSchema.parse({ logoUrl: updated.logoUrl });
}

export async function uploadBusinessLogo(businessId: string, ownerId: string, request: Request, database?: ReturnType<typeof getDb>, store?: LogoBlobStore) {
  const bytes = await readLogoFile(request);
  return saveBusinessLogo(businessId, ownerId, bytes, database, store);
}
