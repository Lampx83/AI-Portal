#!/usr/bin/env node
/**
 * Chạy migration 005 - thêm cột thời gian cho agent_test_results
 * Dùng khi: Lỗi "column metadata_ms does not exist"
 * Chạy: node scripts/run-migration-005.mjs (từ thư mục backend)
 */
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, "../.env") })
dotenv.config({ path: path.resolve(__dirname, "../../.env") })
import pg from "pg"
import fs from "fs"
const sql = fs.readFileSync(path.join(__dirname, "../migrations/005_add_agent_test_timings.sql"), "utf-8")

const conn = process.env.DATABASE_URL ||
  `postgresql://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST || "localhost"}:${process.env.POSTGRES_PORT || "5432"}/${process.env.POSTGRES_DB}`
const client = new pg.Client({ connectionString: conn })
await client.connect()
try {
  await client.query(sql)
  console.log("✅ Migration 005: Đã thêm cột metadata_ms, data_documents_ms, ...")
} finally {
  await client.end()
}
