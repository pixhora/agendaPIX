import { expect, it } from "vitest";
import { buildSignInCodeEmail } from "../../lib/email";
import { buildLoginConfirmUrl } from "../../lib/magic-link-confirm";

it("coloca o código no corpo e só no fragmento do botão", () => {
  const message = buildSignInCodeEmail({
    otp: "481927",
    appOrigin: "https://agendapix.example",
    draftId: "11111111-1111-4111-8111-111111111111",
    businessName: "Studio Bella",
  });
  expect(message.subject).toBe("Seu código da AgendaPix: 481 927");
  expect(message.text).toContain("481 927");
  expect(message.text).toContain("vale por 30 minutos");
  expect(message.text).toContain("Studio Bella");
  const button = new URL(message.buttonUrl);
  expect(button.origin).toBe("https://agendapix.example");
  expect(button.pathname).toBe("/onboarding/confirmar");
  expect(button.searchParams.get("d")).toBe("11111111-1111-4111-8111-111111111111");
  expect(button.search).not.toContain("481927");
  expect(button.hash).toBe("#c=481927");
  expect(message.html).toContain("Entrar na AgendaPix");
  expect(message.html).not.toContain("<script");
});

it("omite o rascunho quando ainda não existe cadastro guardado", () => {
  const message = buildSignInCodeEmail({ otp: "123456", appOrigin: "http://localhost:3000" });
  const button = new URL(message.buttonUrl);
  expect(button.searchParams.has("d")).toBe(false);
  expect(button.hash).toBe("#c=123456");
  expect(message.text).not.toContain("da :");
});

it("o link do e-mail de acesso abre a página de confirmação", () => {
  const url = buildLoginConfirmUrl("http://localhost:3000/api/auth/magic-link/verify?token=abc&callbackURL=%2Fdashboard&errorCallbackURL=%2Flogin");
  const parsed = new URL(url);
  expect(parsed.pathname).toBe("/entrar/confirmar");
  expect(parsed.pathname).not.toContain("magic-link");
  expect(parsed.searchParams.get("token")).toBe("abc");
  expect(parsed.searchParams.get("callbackURL")).toBe("/dashboard");
  expect(parsed.searchParams.get("errorCallbackURL")).toBe("/login");
});
