import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const script = join(process.cwd(), "scripts/migrate.mjs");

function runMigrate(args: string[] = []) {
  const cwd = mkdtempSync(join(tmpdir(), "migrate-notty-"));
  const env = { ...process.env };
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
    }, 2000);
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
});
