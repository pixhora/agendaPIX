"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwner } from "@/lib/dashboard/session";
import { saveDashboardHours, saveDashboardService } from "@/lib/dashboard/data";
import { parseMoney, type FormState } from "@/lib/dashboard/validation";
import { HttpError } from "@/lib/http";

function message(error: unknown) {
  if (error instanceof z.ZodError) return "Confira os campos: nome, duração, valores e horários válidos. O sinal não pode superar o preço.";
  if (error instanceof HttpError) return error.message;
  return "Não foi possível salvar. Confira os dados e tente novamente.";
}
export async function saveService(_: FormState, form: FormData): Promise<FormState> {
  const owner = await requireOwner();
  try {
    await saveDashboardService(owner.id, {
      businessId: form.get("businessId"), id: form.get("id") || undefined,
      name: form.get("name"), durationMinutes: form.get("durationMinutes"),
      priceCents: parseMoney(form.get("price")), depositCents: parseMoney(form.get("deposit")),
      active: form.get("active") === "on",
    });
    revalidatePath("/dashboard", "layout");
    return { success: "Serviço salvo." };
  } catch (error) { return { error: message(error) }; }
}
export async function saveHours(_: FormState, form: FormData): Promise<FormState> {
  const owner = await requireOwner();
  try {
    const businessId = z.uuid().parse(form.get("businessId"));
    const days = Array.from({ length: 7 }, (_, weekday) => weekday).filter((day) => form.get(`open-${day}`) === "on")
      .map((weekday) => ({ weekday, opensAt: form.get(`start-${weekday}`), closesAt: form.get(`end-${weekday}`) }));
    await saveDashboardHours(owner.id, businessId, days);
    revalidatePath("/dashboard", "layout");
    return { success: "Horários de funcionamento salvos." };
  } catch (error) { return { error: message(error) }; }
}
