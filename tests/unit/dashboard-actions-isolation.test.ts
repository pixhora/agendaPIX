import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireOwner: vi.fn(),
  saveDashboardService: vi.fn(),
  saveDashboardHours: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("../../lib/dashboard/session", () => ({ requireOwner: mocks.requireOwner }));
vi.mock("../../lib/dashboard/data", () => ({
  saveDashboardService: mocks.saveDashboardService,
  saveDashboardHours: mocks.saveDashboardHours,
}));

import { saveHours, saveService } from "../../app/dashboard/(owner)/actions";
import { HttpError } from "../../lib/http";

describe("actions do painel isoladas por negócio", () => {
  beforeEach(() => {
    mocks.requireOwner.mockReset().mockResolvedValue({ id: "owner-a", name: "A", email: "a@example.com" });
    mocks.saveDashboardService.mockReset();
    mocks.saveDashboardHours.mockReset();
    mocks.revalidatePath.mockReset();
  });

  it("nega salvar serviço de negócio alheio", async () => {
    mocks.saveDashboardService.mockRejectedValue(new HttpError(404, "business_unavailable", "Este negócio não está disponível para sua conta."));
    const form = new FormData();
    form.set("businessId", "00000000-0000-4000-8000-0000000000bb");
    form.set("name", "Invadido");
    form.set("durationMinutes", "30");
    form.set("price", "50,00");
    form.set("deposit", "10,00");
    form.set("active", "on");
    const result = await saveService({}, form);
    expect(result.error).toMatch(/não está disponível|Não foi possível salvar/i);
    expect(mocks.saveDashboardService).toHaveBeenCalledWith("owner-a", expect.objectContaining({
      businessId: "00000000-0000-4000-8000-0000000000bb",
    }));
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("nega salvar horários de negócio alheio", async () => {
    mocks.saveDashboardHours.mockRejectedValue(new HttpError(404, "business_unavailable", "Este negócio não está disponível para sua conta."));
    const form = new FormData();
    form.set("businessId", "00000000-0000-4000-8000-0000000000bb");
    form.set("open-1", "on");
    form.set("start-1", "09:00");
    form.set("end-1", "18:00");
    const result = await saveHours({}, form);
    expect(result.error).toMatch(/não está disponível|Não foi possível salvar/i);
    expect(mocks.saveDashboardHours).toHaveBeenCalledWith(
      "owner-a",
      "00000000-0000-4000-8000-0000000000bb",
      expect.any(Array),
    );
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
