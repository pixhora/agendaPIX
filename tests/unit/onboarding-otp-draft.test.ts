import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { verification } from "../../db/schema";
import { updateOnboardingDraft } from "../../lib/onboarding/drafts";

vi.mock("../../db", () => ({ getDb: () => ({}) }));

function draftRow(id: string, email: string) {
  const now = new Date();
  return {
    id,
    email,
    segment: "barbearia",
    plan: "base",
    data: {},
    consumedAt: null,
    businessId: null,
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date(now.getTime() + 60_000),
  };
}

/** Banco mínimo: só registra quais tabelas receberam DELETE e devolve o rascunho atualizado. */
function fakeDatabase(row: ReturnType<typeof draftRow>) {
  const deletedTables: unknown[] = [];
  const updates: unknown[] = [];
  const database = {
    select() {
      const chain = { from: () => chain, where: () => chain, limit: async () => [row] };
      return chain;
    },
    delete(table: unknown) {
      deletedTables.push(table);
      return { where: async () => undefined };
    },
    update() {
      return {
        set: (values: unknown) => {
          updates.push(values);
          return {
            where: () => ({ returning: async () => [{ ...row, ...(values as object) }] }),
          };
        },
      };
    },
  };
  return { database: database as never, deletedTables, updates };
}

describe("troca de e-mail no rascunho", () => {
  it("não apaga o OTP do e-mail anterior", async () => {
    const id = randomUUID();
    const oldEmail = "dona-antiga@example.com";
    const { database, deletedTables, updates } = fakeDatabase(draftRow(id, oldEmail));

    const updated = await updateOnboardingDraft(
      id,
      { email: "dona-nova@example.com" },
      { cookieId: id, sessionEmail: null },
      database,
    );

    // Nenhum DELETE na tabela verification: o OTP com identifier `sign-in-otp-<email antigo>` continua.
    expect(deletedTables).not.toContain(verification);
    expect(deletedTables).toHaveLength(0);
    expect(updates).toEqual([expect.objectContaining({ email: "dona-nova@example.com" })]);
    expect(updated.draftId).toBe(id);
  });
});
