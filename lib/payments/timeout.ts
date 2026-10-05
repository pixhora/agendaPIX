export class ProviderTimeoutError extends Error {
  constructor(timeoutMs: number) { super(`Gateway não respondeu em ${timeoutMs} ms.`); this.name = "ProviderTimeoutError"; }
}

/** Executa uma chamada ao gateway com prazo; ao vencer, aborta o AbortSignal entregue à chamada e rejeita. */
export async function callProvider<T>(timeoutMs: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = new ProviderTimeoutError(timeoutMs);
      controller.abort(error);
      reject(error);
    }, timeoutMs);
  });
  try { return await Promise.race([run(controller.signal), timeout]); }
  finally { clearTimeout(timer); }
}
