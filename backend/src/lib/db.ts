// lib/db.ts
// Ensure env is loaded before using process.env
import "./env"
import { Pool, QueryResultRow } from "pg"

const isTrue = (v?: string) => String(v).toLowerCase() === "true"

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

export async function query<T extends QueryResultRow = any>(text: string, params?: any[]) {
  const client = await pool.connect().catch((err) => {
    throw err;
  });

  try {
    return await client.query<T>(text, params);
  } catch (err) {
    throw err;
  } finally {
    client.release();
  }
}

// Helper function để chạy transaction với cùng một client
export async function withTransaction<T>(
  callback: (client: any) => Promise<T>
): Promise<T> {
  const client = await pool.connect().catch((err) => {
    throw err;
  });  
  try {
    await client.query("BEGIN");
    try {
      const result = await callback(client);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  } finally {
    client.release();
  }
}
