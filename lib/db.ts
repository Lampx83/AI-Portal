// lib/db.ts
import { Pool } from "pg"

const isTrue = (v?: string) => String(v).toLowerCase() === "true"

// ✅ Log thông tin ENV DATABASE ngay khi file được load
console.log("🔍 DB ENV CHECK:", {
  POSTGRES_HOST: process.env.POSTGRES_HOST,
  POSTGRES_PORT: process.env.POSTGRES_PORT,
  POSTGRES_DB: process.env.POSTGRES_DB,
  POSTGRES_USER: process.env.POSTGRES_USER,
  POSTGRES_SSL: process.env.POSTGRES_SSL,
})

export const pool = new Pool({
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    ssl: isTrue(process.env.POSTGRES_SSL) ? { rejectUnauthorized: false } : undefined,
    max: 10,              // số connection tối đa
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
})

pool.on("error", (err) => {
  console.error("🔥 PG POOL ERROR:", err);
});

export async function query<T = any>(text: string, params?: any[]) {
  const start = Date.now();
  const client = await pool.connect().catch(err => {
    console.error("❌ Error acquiring client:", err);
    throw err;
  });

  try {
    const res = await client.query<T>(text, params);
    const duration = Date.now() - start;
    console.log(`✅ Executed query in ${duration}ms`);
    return res;
  } catch (err) {
    console.error("❌ Query error:", err);
    throw err;
  } finally {
    client.release();
  }
}

