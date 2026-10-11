import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";
import * as schema from "../../db/schema";
import { abuseBucketExhausted, consumeAbuseBucket } from "../../lib/abuse-rate-limit";
import { databaseEnvSchema } from "../../lib/env";

const scope = "abuse-bucket-exhausted-test";
const pool = new Pool({ connectionString: databaseEnvSchema.parse(process.env).DATABASE_URL, max: 2, connectionTimeoutMillis: 5000 });
const database = drizzle(pool, { schema });

afterAll(async () => {
  await database.delete(schema.abuseRateLimits).where(eq(schema.abuseRateLimits.scope, scope));
  await pool.end();
});

describe("abuseBucketExhausted", () => {
  it("lê o balde real sem incrementar e libera quando a janela passa", async () => {
    const identity = `peer:${randomUUID()}`;
    expect(await abuseBucketExhausted(scope, identity, 2, "minute", database)).toBe(false);
    await consumeAbuseBucket(scope, identity, 2, "minute", database);
    expect(await abuseBucketExhausted(scope, identity, 2, "minute", database)).toBe(false);
    await consumeAbuseBucket(scope, identity, 2, "minute", database);
    expect(await abuseBucketExhausted(scope, identity, 2, "minute", database)).toBe(true);
    const [before] = await database.select({ attempts: schema.abuseRateLimits.attempts }).from(schema.abuseRateLimits).where(eq(schema.abuseRateLimits.scope, scope));
    expect(await abuseBucketExhausted(scope, identity, 2, "minute", database)).toBe(true);
    const [after] = await database.select({ attempts: schema.abuseRateLimits.attempts }).from(schema.abuseRateLimits).where(eq(schema.abuseRateLimits.scope, scope));
    expect(after?.attempts).toBe(before?.attempts);
    await database.execute(sql`update abuse_rate_limits set window_started_at = now() - interval '2 minutes' where scope = ${scope}`);
    expect(await abuseBucketExhausted(scope, identity, 2, "minute", database)).toBe(false);
    await database.delete(schema.abuseRateLimits).where(eq(schema.abuseRateLimits.scope, scope));
  });
});
