import { expect, it, vi } from "vitest";

it("sendMagicLinkEmail rejeita MAGIC_LINK_CAPTURE_FILE em produção", async () => {
  const originalCapture = process.env.MAGIC_LINK_CAPTURE_FILE;
  try {
    process.env.MAGIC_LINK_CAPTURE_FILE = "/tmp/magic-link.txt";
    vi.stubEnv("NODE_ENV", "production");
    const { sendMagicLinkEmail } = await import("../../lib/email");
    await expect(sendMagicLinkEmail("test@example.com", "https://example.com/magic")).rejects.toThrow(
      "MAGIC_LINK_CAPTURE_FILE não pode estar definida em produção."
    );
  } finally {
    vi.unstubAllEnvs();
    process.env.MAGIC_LINK_CAPTURE_FILE = originalCapture;
  }
});

it("verifyEmailTransport rejeita MAGIC_LINK_CAPTURE_FILE em produção", async () => {
  const originalCapture = process.env.MAGIC_LINK_CAPTURE_FILE;
  try {
    process.env.MAGIC_LINK_CAPTURE_FILE = "/tmp/magic-link.txt";
    vi.stubEnv("NODE_ENV", "production");
    const { verifyEmailTransport } = await import("../../lib/email");
    await expect(verifyEmailTransport()).rejects.toThrow(
      "MAGIC_LINK_CAPTURE_FILE não pode estar definida em produção."
    );
  } finally {
    vi.unstubAllEnvs();
    process.env.MAGIC_LINK_CAPTURE_FILE = originalCapture;
  }
});

it("sendMagicLinkEmail permite MAGIC_LINK_CAPTURE_FILE fora de produção", async () => {
  const originalCapture = process.env.MAGIC_LINK_CAPTURE_FILE;
  try {
    process.env.MAGIC_LINK_CAPTURE_FILE = "/tmp/test-magic-link.txt";
    vi.stubEnv("NODE_ENV", "development");
    const { sendMagicLinkEmail } = await import("../../lib/email");
    await expect(sendMagicLinkEmail("test@example.com", "https://example.com/magic")).resolves.not.toThrow();
  } finally {
    vi.unstubAllEnvs();
    process.env.MAGIC_LINK_CAPTURE_FILE = originalCapture;
  }
});

it("verifyEmailTransport permite MAGIC_LINK_CAPTURE_FILE fora de produção", async () => {
  const originalCapture = process.env.MAGIC_LINK_CAPTURE_FILE;
  try {
    process.env.MAGIC_LINK_CAPTURE_FILE = "/tmp/test-magic-link.txt";
    vi.stubEnv("NODE_ENV", "test");
    const { verifyEmailTransport } = await import("../../lib/email");
    await expect(verifyEmailTransport()).resolves.not.toThrow();
  } finally {
    vi.unstubAllEnvs();
    process.env.MAGIC_LINK_CAPTURE_FILE = originalCapture;
  }
});
