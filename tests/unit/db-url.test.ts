import { describe, expect, it } from "vitest";
import { explicitSslMode } from "../../lib/db-url";

const base = "postgresql://user:p%40ss@ep-x-pooler.sa-east-1.aws.neon.tech/neondb";

describe("explicitSslMode", () => {
  it.each(["require", "prefer", "verify-ca"])("troca sslmode=%s por verify-full", (mode) => {
    expect(explicitSslMode(`${base}?sslmode=${mode}`)).toBe(`${base}?sslmode=verify-full`);
  });

  it("mantém os outros parâmetros e a ordem", () => {
    expect(explicitSslMode(`${base}?connect_timeout=5&sslmode=require&channel_binding=require`)).toBe(
      `${base}?connect_timeout=5&sslmode=verify-full&channel_binding=require`,
    );
  });

  it("não altera verify-full, disable nem a ausência de sslmode", () => {
    expect(explicitSslMode(`${base}?sslmode=verify-full`)).toBe(`${base}?sslmode=verify-full`);
    expect(explicitSslMode(`${base}?sslmode=disable`)).toBe(`${base}?sslmode=disable`);
    expect(explicitSslMode(base)).toBe(base);
    expect(explicitSslMode("postgresql://agenda@127.0.0.1:5433/agenda")).toBe("postgresql://agenda@127.0.0.1:5433/agenda");
  });

  it("respeita uselibpqcompat=true, que pede a semântica do libpq", () => {
    const url = `${base}?uselibpqcompat=true&sslmode=require`;
    expect(explicitSslMode(url)).toBe(url);
  });

  it("não reescreve usuário e senha, mesmo com caracteres especiais", () => {
    const url = "postgresql://us%23er:s%3Dsslmode%3Drequire@host/db?sslmode=require";
    expect(explicitSslMode(url)).toBe("postgresql://us%23er:s%3Dsslmode%3Drequire@host/db?sslmode=verify-full");
  });

  it("não confunde um parâmetro que só termina com sslmode", () => {
    const url = `${base}?mysslmode=require`;
    expect(explicitSslMode(url)).toBe(url);
  });
});
