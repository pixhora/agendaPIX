import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import * as schema from "../../db/schema";
import { databaseEnvSchema } from "../../lib/env";
import { DatabaseChargeReferenceStore } from "../../lib/payments/reference-store";

const pool = new Pool({ connectionString: databaseEnvSchema.parse(process.env).DATABASE_URL, max: 4, connectionTimeoutMillis: 5000 });
const database = drizzle(pool, { schema });
const provider = `test-${randomUUID()}`;

afterEach(async () => {
  await database.delete(schema.providerChargeReferences).where(eq(schema.providerChargeReferences.provider, provider));
});
afterAll(async () => { await pool.end(); });

describe("DatabaseChargeReferenceStore", () => {
  it("persiste reference → externalId e é visível para outra instância (outro store/pool)", async () => {
    const reference = randomUUID();
    await new DatabaseChargeReferenceStore(provider, () => database).save(reference, "ordtst0001");
    const otherPool = new Pool({ connectionString: databaseEnvSchema.parse(process.env).DATABASE_URL, max: 1 });
    try {
      const other = new DatabaseChargeReferenceStore(provider, () => drizzle(otherPool, { schema }));
      expect(await other.get(reference)).toBe("ordtst0001");
      expect(await other.get(randomUUID())).toBeNull();
      expect(await other.get("not-a-uuid")).toBeNull();
    } finally {
      await otherPool.end();
    }
  });

  it("save é idempotente e não sobrescreve o mapeamento original", async () => {
    const store = new DatabaseChargeReferenceStore(provider, () => database);
    const reference = randomUUID();
    await store.save(reference, "ordtst0002");
    await store.save(reference, "ordtst0002");
    await store.save(reference, "ordtst9999");
    expect(await store.get(reference)).toBe("ordtst0002");
  });

  it("isola por provider", async () => {
    const reference = randomUUID();
    await new DatabaseChargeReferenceStore(provider, () => database).save(reference, "ordtst0003");
    expect(await new DatabaseChargeReferenceStore(`${provider}-other`, () => database).get(reference)).toBeNull();
  });
});
