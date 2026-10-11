import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { consumeHiddenChunk, redactDatabaseMessage } from "../../scripts/migrate-input.mjs";

const script = join(process.cwd(), "scripts/migrate.mjs");
const secretUrl = "postgresql://agenda:super-secret-password@127.0.0.1:1/agenda";

function runMigrate(args: string[] = [], options: { files?: Record<string, string>; env?: Record<string, string>; timeoutMs?: number } = {}) {
  const cwd = mkdtempSync(join(tmpdir(), "migrate-notty-"));
  for (const [name, contents] of Object.entries(options.files ?? {})) {
    writeFileSync(join(cwd, name), contents);
  }
  const env = { ...process.env, ...options.env };
  delete env.DATABASE_URL;
  const child = spawn(process.execPath, [script, ...args], {
    cwd,
    env,
    stdio: ["pipe", "pipe", "pipe"],
  });
  return new Promise<{ code: number | null; stdout: string; stderr: string; elapsed: number }>((resolve, reject) => {
    const started = Date.now();
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("migrate ficou esperando entrada"));
    }, options.timeoutMs ?? 2000);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, elapsed: Date.now() - started });
    });
  });
}

describe("migrate sem TTY", () => {
  it("sai na hora sem DATABASE_URL em vez de esperar input", async () => {
    const result = await runMigrate();
    expect(result.elapsed).toBeLessThan(2000);
    expect(result.code).not.toBe(0);
    const output = `${result.stdout}\n${result.stderr}`;
    expect(output).toMatch(/DATABASE_URL/);
    expect(output).toMatch(/terminal interativo/);
    expect(output).not.toMatch(/postgres(ql)?:\/\//);
  });

  it("com --yes e sem URL também não espera input", async () => {
    const result = await runMigrate(["--yes"]);
    expect(result.elapsed).toBeLessThan(2000);
    expect(result.code).not.toBe(0);
    const output = `${result.stdout}\n${result.stderr}`;
    expect(output).toMatch(/DATABASE_URL/);
    expect(output).not.toMatch(/postgres(ql)?:\/\//);
  });

  it(".env.migrate sem TTY e sem --yes sai com erro e não imprime a senha", async () => {
    const result = await runMigrate([], {
      files: { ".env.migrate": `DATABASE_URL=${secretUrl}\n` },
    });
    expect(result.elapsed).toBeLessThan(2000);
    expect(result.code).not.toBe(0);
    const output = `${result.stdout}\n${result.stderr}`;
    expect(output).toContain("Origem da URL: .env.migrate");
    expect(output).toMatch(/Passe --yes/);
    expect(output).not.toContain("super-secret-password");
    expect(output).not.toContain(secretUrl);
  });

  it("--yes com .env.migrate segue e a senha não aparece no erro", async () => {
    const result = await runMigrate(["--yes"], {
      files: { ".env.migrate": `DATABASE_URL=${secretUrl}\n` },
      env: { MIGRATIONS_DIR: join(process.cwd(), "db/migrations") },
      timeoutMs: 8000,
    });
    expect(result.code).not.toBe(0);
    const output = `${result.stdout}\n${result.stderr}`;
    expect(output).toContain("Origem da URL: .env.migrate");
    expect(output).not.toMatch(/Passe --yes/);
    expect(output).toMatch(/Falha ao aplicar migrations/);
    expect(output).not.toContain("super-secret-password");
    expect(output).not.toContain(secretUrl);
  });
});

describe("entrada oculta e redação da URL", () => {
  it("colar a URL e o Enter no mesmo bloco encerra de uma vez", () => {
    const pasted = `${secretUrl}\r\n`;
    const result = consumeHiddenChunk("", pasted);
    expect(result.done).toBe(true);
    expect(result.abort).toBe(false);
    expect(result.value).toBe(secretUrl);
  });

  it("redige senha e URL numa mensagem de erro", () => {
    const message = `connect failed ${secretUrl} password super-secret-password user agenda`;
    const out = redactDatabaseMessage(message, secretUrl);
    expect(out).not.toContain("super-secret-password");
    expect(out).not.toContain(secretUrl);
    expect(out).not.toContain("agenda");
    expect(out).toContain("[DATABASE_URL]");
    expect(out).toContain("[redacted]");
  });
});
