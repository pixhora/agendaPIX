export function consumeHiddenChunk(value: string, chunk: string): {
  value: string;
  done: boolean;
  abort: boolean;
};

export function redactDatabaseMessage(message: string, url: string): string;

export function formatDatabaseClientError(error: unknown, url: string): string;

export const databaseUrlSourceLabel: {
  env: "env";
  file: ".env.migrate";
  dotenv: ".env";
  prompt: "prompt";
};
