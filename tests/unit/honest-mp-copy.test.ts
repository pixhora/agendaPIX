import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MP_DISCONNECT_RETENTION_COPY, MP_MANUAL_REFUND_CHANNEL } from "../../lib/mercadopago/connect-copy";
import { openPixDisconnectNote, PERMISSIONS } from "../../lib/mercadopago/contract";

const COPY_ROOTS = ["app", "components", "lib", "content", "docs"];
const FORBIDDEN = ["45 minutos", "Devolver agora", "Devolver pelo AgendaPix"] as const;

function copyFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    const parts = path.split("/");
    if (parts.includes("node_modules") || parts.includes(".git")) return [];
    if (statSync(path).isDirectory()) return copyFiles(path);
    return path.endsWith(".ts") || path.endsWith(".tsx") || path.endsWith(".md") ? [path] : [];
  });
}

describe("cópia do Mercado Pago", () => {
  it("não promete apagar em 45 minutos nem Devolver agora ou Devolver pelo AgendaPix", () => {
    const hits = COPY_ROOTS.flatMap((root) =>
      copyFiles(root).flatMap((file) => {
        const source = readFileSync(file, "utf8");
        return FORBIDDEN.filter((phrase) => source.includes(phrase)).map((phrase) => `${file}: ${phrase}`);
      }),
    );
    expect(hits).toEqual([]);
  });

  it("a desconexão com Pix em aberto usa a frase atual da tela", () => {
    expect(openPixDisconnectNote(0)).toBeNull();
    const note = openPixDisconnectNote(1);
    expect(note).toContain("é apagado em até 24 horas");
    expect(note).not.toContain(MP_DISCONNECT_RETENTION_COPY);
    expect(note).not.toMatch(/45 minutos|48 horas|por mais 24 horas/);
  });

  it("a permissão de devolução manual aponta para o app do Mercado Pago", () => {
    const permission = PERMISSIONS.find((item) => item.strong.startsWith("devolver um sinal"));
    expect(`${permission?.strong ?? ""}${permission?.rest ?? ""}`).toContain(MP_MANUAL_REFUND_CHANNEL);
    expect(`${permission?.strong ?? ""}${permission?.rest ?? ""}`).not.toContain("Devolver pelo AgendaPix");
  });
});
