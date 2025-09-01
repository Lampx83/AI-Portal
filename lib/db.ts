// lib/db.ts
import { Pool } from "pg"

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

export async function query<T = any>(text: string, params?: any[]) {
    const client = await pool.connect()
    try {
        const res = await client.query<T>(text, params)
        return res
    } finally {
        client.release()
    }
}
