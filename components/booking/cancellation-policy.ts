/**
 * Texto da política de falta/cancelamento.
 * Se o serviço ou o snapshot da reserva não trouxer texto, o aviso não promete reembolso.
 */
export function cancellationNoticeText(policy: string | null | undefined, businessName: string): string {
  const custom = typeof policy === "string" ? policy.trim() : "";
  if (custom) return custom;
  const name = businessName.trim();
  if (!name) {
    return "Políticas de cancelamento são definidas pelo estabelecimento. Fale com o estabelecimento em caso de dúvida.";
  }
  return `Políticas de cancelamento são definidas por ${name}. Fale com o estabelecimento em caso de dúvida.`;
}
