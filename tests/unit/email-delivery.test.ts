import { afterEach, describe, expect, it, vi } from "vitest";

const sendMail = vi.hoisted(() => vi.fn());
const close = vi.hoisted(() => vi.fn());

vi.mock("nodemailer", () => ({
  default: {
    createTransport: () => ({ sendMail, close }),
  },
}));

import { logMailFailure, sendMagicLinkEmail, sendOwnerEmail } from "../../lib/email";

const smtp = {
  SMTP_HOST: "localhost",
  SMTP_PORT: "1025",
  SMTP_SECURE: "false",
  SMTP_FROM: "AgendaPix <acesso@agendapix.dev.br>",
  SMTP_USER: "",
  SMTP_PASSWORD: "",
  SMTP_REPLY_TO: "",
  MAGIC_LINK_CAPTURE_FILE: "",
};

describe("envio de e-mail", () => {
  afterEach(() => {
    sendMail.mockReset();
    close.mockReset();
    vi.unstubAllEnvs();
  });

  function stubSmtp(extra: Record<string, string> = {}) {
    for (const [key, value] of Object.entries({ ...smtp, ...extra })) vi.stubEnv(key, value);
  }

  it("omite reply-to vazio, achata quebra de linha no assunto e fecha o transporte", async () => {
    stubSmtp();
    sendMail.mockResolvedValue({ messageId: "1" });
    await sendOwnerEmail("dono@example.com", "Aviso\r\nextra", "texto");
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      from: smtp.SMTP_FROM,
      to: "dono@example.com",
      subject: "Aviso extra",
      text: "texto",
    }));
    expect(sendMail.mock.calls[0]?.[0]).not.toHaveProperty("replyTo");
    expect(sendMail.mock.calls[0]?.[0].subject).not.toMatch(/[\r\n]/);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("usa SMTP_REPLY_TO quando existe e fecha o transporte mesmo se o envio falhar", async () => {
    stubSmtp({ SMTP_REPLY_TO: "AgendaPix <oi@agendapix.dev.br>" });
    sendMail.mockRejectedValueOnce(new Error("smtp down"));
    await expect(sendMagicLinkEmail("dono@example.com", "https://agendapix.dev.br/entrar")).rejects.toThrow("smtp down");
    expect(sendMail.mock.calls[0]?.[0].replyTo).toBe("AgendaPix <oi@agendapix.dev.br>");
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("o log de falha não leva destinatário nem nome", () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    logMailFailure("owner_notice");
    const logged = errorLog.mock.calls.map((call) => call.map(String).join(" ")).join("\n");
    expect(logged).toBe("[mail] scope=owner_notice code=send_failed");
    expect(logged).not.toContain("@");
    errorLog.mockRestore();
  });
});
