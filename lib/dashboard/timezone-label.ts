/** Nomes amigáveis em português para IANA timezones usados no painel do dono. */
const FRIENDLY_TIMEZONE_LABELS: Record<string, string> = {
  "America/Sao_Paulo": "Horário de Brasília",
  "America/Fortaleza": "Horário de Brasília",
  "America/Recife": "Horário de Brasília",
  "America/Bahia": "Horário de Brasília",
  "America/Belem": "Horário de Brasília",
  "America/Maceio": "Horário de Brasília",
  "America/Araguaina": "Horário de Brasília",
  "America/Santarem": "Horário de Brasília",
  "America/Campo_Grande": "Horário de Brasília",
  "America/Cuiaba": "Horário de Brasília",
  "America/Manaus": "Horário do Amazonas",
  "America/Porto_Velho": "Horário do Amazonas",
  "America/Boa_Vista": "Horário do Amazonas",
  "America/Rio_Branco": "Horário do Acre",
  "America/Eirunepe": "Horário do Acre",
  "America/Noronha": "Horário de Fernando de Noronha",
  "Etc/UTC": "Horário UTC",
  UTC: "Horário UTC",
};

/**
 * Converte um ID IANA em rótulo amigável para a UI do dono.
 * Não altera o fuso usado nos cálculos — só a apresentação.
 */
export function friendlyTimezoneLabel(timezone: string): string {
  const known = FRIENDLY_TIMEZONE_LABELS[timezone];
  if (known) return known;

  try {
    const parts = new Intl.DateTimeFormat("pt-BR", {
      timeZone: timezone,
      timeZoneName: "long",
    }).formatToParts(new Date());
    const name = parts.find((part) => part.type === "timeZoneName")?.value;
    if (name) {
      return name
        .replace(/^Horário Padrão de /, "Horário de ")
        .replace(/^Horário Padrão do /, "Horário do ")
        .replace(/^Horário de Verão de /, "Horário de ")
        .replace(/^Horário de Verão do /, "Horário do ");
    }
  } catch {
    // ID inválido ou não suportado pelo runtime
  }

  return "Horário local";
}
