import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { services } from "../../db/schema";
import { logoUploadResponseSchema, logoUrlRejection } from "../contracts";
import { consumeAbuseBucket } from "../abuse-rate-limit";
import { invalidatePublicCatalog } from "../bookings/public-cache";
import { HttpError } from "../http";
import { reencodeLogo } from "./logo-image";
import { type Database, type LogoBlobStore, ownedBusiness, readLogoFile, resolveBlobStore } from "./logo-store";

/** Foto de serviço cabe em 800 px: aparece na lista de serviços da página pública, sem pesar o carregamento. */
export const SERVICE_IMAGE_MAX_EDGE_PX = 800;

/** Só fotos enviadas por este caminho: `services/{serviceId}-…`. Host e HTTPS vêm de `logoUrlRejection`. */
export function isOwnServiceImageUrl(url: string, serviceId: string): boolean {
  if (logoUrlRejection(url) !== null) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const prefix = `/services/${serviceId}`;
  return parsed.pathname.startsWith(`${prefix}-`) || parsed.pathname.startsWith(`${prefix}.`);
}

export async function uploadServiceImage(
  businessId: string,
  serviceId: string,
  ownerId: string,
  request: Request,
  database: Database,
  store: LogoBlobStore = resolveBlobStore(),
) {
  const id = z.uuid().safeParse(serviceId);
  if (!id.success) throw new HttpError(404, "service_not_found", "Serviço não encontrado.");
  const business = await ownedBusiness(businessId, ownerId, database);
  const [service] = await database
    .select({ id: services.id, imageUrl: services.imageUrl })
    .from(services)
    .where(and(eq(services.id, id.data), eq(services.businessId, business.id)))
    .limit(1);
  if (!service) throw new HttpError(404, "service_not_found", "Serviço não encontrado.");
  await consumeAbuseBucket("service-image-upload", ownerId, 30, "hour", database);

  const bytes = await readLogoFile(request);
  const image = await reencodeLogo(bytes, SERVICE_IMAGE_MAX_EDGE_PX);
  const previous = service.imageUrl;
  const uploaded = await store.put(`services/${service.id}.webp`, image, {
    access: "public",
    addRandomSuffix: true,
    contentType: "image/webp",
  });
  const imageUrl = uploaded.url;
  if (logoUrlRejection(imageUrl) !== null) throw new HttpError(503, "blob_unavailable", "O envio da foto está indisponível.");
  const [updated] = await database
    .update(services)
    .set({ imageUrl })
    .where(and(eq(services.id, service.id), eq(services.businessId, business.id)))
    .returning({ imageUrl: services.imageUrl });
  if (!updated?.imageUrl) throw new HttpError(503, "blob_unavailable", "O envio da foto está indisponível.");
  if (previous && previous !== updated.imageUrl && isOwnServiceImageUrl(previous, service.id)) {
    try {
      await store.del(previous);
    } catch (error) {
      console.error("[service-image] delete_failed", error instanceof Error ? error.message : "unknown");
    }
  }
  await invalidatePublicCatalog(business.slug);
  return logoUploadResponseSchema.parse({ logoUrl: updated.imageUrl });
}
