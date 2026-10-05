import { getDb } from "../db";
import { verifyEmailTransport } from "./email";

export async function isReady() {
  // pg aceita query_timeout por consulta; @types/pg ainda não declara esse campo.
  const probe = { text: "SELECT 1", query_timeout: 3000 };
  const results = await Promise.allSettled([
    Promise.resolve().then(() => getDb().$client.query(probe)),
    Promise.resolve().then(() => verifyEmailTransport()),
  ]);
  return results.every((result) => result.status === "fulfilled");
}
