// Mensagens e erros do provedor podem conter tokens, SQL ou dados pessoais.
export const logAuthEvent: (level: string, ...details: unknown[]) => void = (level) => {
  if (level === "error") console.error("[AgendaPix auth] Authentication operation failed");
  else if (level === "warn") console.warn("[AgendaPix auth] Authentication warning");
};
