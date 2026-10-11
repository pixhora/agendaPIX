import { HttpError } from "../http";

/**
 * Códigos públicos da página de falha do connect, antes do redirect.
 * A lista é fechada: a tela só mostra um destes valores, nunca a mensagem da exceção.
 */
export enum MpConnectFailureCode {
  Origin = "MP-ORIGIN",
  Config = "MP-CONFIG",
  State = "MP-STATE",
  Database = "MP-DB",
  Unknown = "MP-UNKNOWN",
}

export const MP_CONNECT_FAILURE_CODES = [
  MpConnectFailureCode.Origin,
  MpConnectFailureCode.Config,
  MpConnectFailureCode.State,
  MpConnectFailureCode.Database,
  MpConnectFailureCode.Unknown,
] as const;

const FAILURE_CODE_LIST = new Set<string>(MP_CONNECT_FAILURE_CODES);

export function isMpConnectFailureCode(value: unknown): value is MpConnectFailureCode {
  return typeof value === "string" && FAILURE_CODE_LIST.has(value);
}

/** Erro já classificado. `source` guarda a causa original para o status HTTP e o log, sem ir para o HTML. */
export class MpConnectFailure extends Error {
  readonly failureCode: MpConnectFailureCode;
  readonly source: unknown;

  constructor(failureCode: MpConnectFailureCode, source?: unknown) {
    super(failureCode);
    this.name = "MpConnectFailure";
    this.failureCode = failureCode;
    this.source = source;
  }
}

const CONFIG_CODES = new Set(["mp_oauth_unconfigured", "mp_oauth_pkce_invalid"]);
const SAFE_CAUSE = /^[a-z0-9_]{1,64}$/;
const SECRET_CAUSE = new Set(["client_secret", "access_token", "refresh_token", "code", "state", "token"]);

function publicCode(code: MpConnectFailureCode): MpConnectFailureCode {
  return isMpConnectFailureCode(code) ? code : MpConnectFailureCode.Unknown;
}

/** Causa original, quando o connect etiquetou o passo que falhou. */
export function exposedConnectError(error: unknown): unknown {
  if (error instanceof MpConnectFailure && error.source !== undefined) return error.source;
  return error;
}

function unwrap(error: unknown): unknown {
  return error instanceof MpConnectFailure ? error.source : error;
}

/** SQLSTATE de 5 caracteres. A mensagem do driver fica de fora: ela pode trazer a URL do banco. */
function postgresSqlState(error: unknown): string | null {
  let current: unknown = error;
  for (let depth = 0; depth < 5; depth += 1) {
    if (!current || typeof current !== "object") return null;
    if ("code" in current && typeof current.code === "string" && /^[0-9A-Z]{5}$/.test(current.code)) return current.code;
    current = "cause" in current ? current.cause : undefined;
  }
  return null;
}

function readErrorCode(error: unknown): string | null {
  if (error instanceof HttpError) return error.code;
  if (!error || typeof error !== "object" || !("error" in error)) return null;
  const body = error.error;
  if (!body || typeof body !== "object" || !("code" in body)) return null;
  return typeof body.code === "string" ? body.code : null;
}

function safeToken(value: string | null): string | null {
  if (!value || !SAFE_CAUSE.test(value) || SECRET_CAUSE.has(value)) return null;
  return value;
}

/**
 * Mapeia a causa para um código da lista fixa.
 * Falha etiquetada no passo (state ou banco) ganha do SQLSTATE genérico.
 */
export function classifyConnectFailure(error: unknown): MpConnectFailureCode {
  if (error instanceof MpConnectFailure) return error.failureCode;
  const code = error instanceof HttpError ? error.code : null;
  if (code === "forbidden_origin") return MpConnectFailureCode.Origin;
  if (code && CONFIG_CODES.has(code)) return MpConnectFailureCode.Config;
  if (postgresSqlState(error)) return MpConnectFailureCode.Database;
  return MpConnectFailureCode.Unknown;
}

/** Resposta já montada (403 de origem, 503 de configuração). `null` quando o corpo não é uma dessas causas. */
export function classifyConnectResult(status: number, payload: unknown): MpConnectFailureCode | null {
  const code = readErrorCode(payload);
  if (status === 403 && code === "forbidden_origin") return MpConnectFailureCode.Origin;
  if (code && CONFIG_CODES.has(code)) return MpConnectFailureCode.Config;
  return null;
}

function safeCause(code: MpConnectFailureCode, error: unknown): string {
  if (code === MpConnectFailureCode.Origin) return "forbidden_origin";
  if (code === MpConnectFailureCode.State) return "oauth_state_write";
  if (code === MpConnectFailureCode.Database) return "database";
  const token = safeToken(readErrorCode(unwrap(error)));
  if (token && (code === MpConnectFailureCode.Config || code === MpConnectFailureCode.Unknown)) return token;
  if (code === MpConnectFailureCode.Config) return "oauth_config";
  return "unexpected";
}

/** Linha de log só com código, causa curta e SQLSTATE. Sem mensagem, URL, state, code OAuth ou segredo. */
export function formatConnectFailureLog(code: MpConnectFailureCode, error: unknown): string {
  const listed = publicCode(code);
  const sqlstate = postgresSqlState(unwrap(error));
  const suffix = sqlstate ? ` sqlstate=${sqlstate}` : "";
  return `[mp-connect] code=${listed} cause=${safeCause(listed, error)}${suffix}`;
}

export function logConnectFailure(code: MpConnectFailureCode, error: unknown) {
  console.error(formatConnectFailureLog(code, error));
}
