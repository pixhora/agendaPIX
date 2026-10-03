import { z } from "zod";

export const slugSchema = z.string().min(1).max(100).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
export const availabilitySchema = z.object({ serviceId: z.uuid(), date: z.iso.date() }).strict();
export const bookingInputSchema = z.object({
  serviceId: z.uuid(),
  startsAt: z.iso.datetime({ offset: true }).transform((value) => new Date(value).toISOString()),
  customer: z.object({ name: z.string().trim().min(1).max(120), phone: z.string().regex(/^\+[1-9][0-9]{7,14}$/) }).strict(),
}).strict();
export const requestKeySchema = z.uuid({ version: "v4" });
