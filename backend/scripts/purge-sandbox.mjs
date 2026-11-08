#!/usr/bin/env node
/**
 * Dọn dữ liệu của danh tính «môi trường thực hành» không hoạt động quá N ngày (mặc định 7), ở mọi schema công cụ và MinIO.
 * Xem backend/src/lib/sandbox.ts.
 *
 * Cách dùng (mặc định chỉ đếm, không xoá gì):
 *   node scripts/purge-sandbox.mjs                 # chạy thử, in số dòng sẽ xoá
 *   node scripts/purge-sandbox.mjs --apply         # xoá thật
 *   node scripts/purge-sandbox.mjs --days=14       # đổi ngưỡng
 *
 * Chỉ đụng tới id thoả CẢ BA điều kiện: có trong ai_portal.sandbox_users, là UUID v5, và (nếu có dòng ai_portal.users)
 * email kết thúc bằng @sandbox.local. Id không thoả bị bỏ qua và in cảnh báo.
 *
 * Env: POSTGRES_HOST, POSTGRES_PORT, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_SSL; tên CSDL lấy từ data/setup-db.json
 * hoặc POSTGRES_DB. Cấu hình MinIO lấy từ env MINIO_*, thiếu thì đọc ai_portal.app_settings.
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import pg from "pg"
import { DeleteObjectsCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BACKEND_ROOT = process.env.BACKEND_ROOT?.trim() ? path.resolve(process.env.BACKEND_ROOT.trim()) : path.resolve(__dirname, "..")
const BATCH = 500

const args = process.argv.slice(2)
const apply = args.includes("--apply")
const daysArg = args.find((a) => a.startsWith("--days="))
const days = daysArg ? Number(daysArg.slice("--days=".length)) : 7
if (!Number.isFinite(days) || days < 1) {
  console.error("--days phải là số ngày >= 1")
  process.exit(2)
}

/** Cùng thứ tự với backend (lib/db.ts): setup-db.json là nguồn thật, POSTGRES_DB chỉ dùng khi chạy ngoài container. */
function databaseName() {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(BACKEND_ROOT, "data", "setup-db.json"), "utf8"))
    if (typeof data.databaseName === "string" && data.databaseName.trim()) return data.databaseName.trim()
  } catch {
    /* không có tệp: dùng biến môi trường */
  }
  if (process.env.POSTGRES_DB?.trim()) return process.env.POSTGRES_DB.trim()
  throw new Error("Không xác định được tên CSDL: kiểm tra data/setup-db.json hoặc đặt POSTGRES_DB")
}

/** Thứ tự: bảng con trước bảng cha. ids = uuid[] tại $1. Bảng của Annota, Writium và ai_portal.* đi theo CASCADE khi xoá ai_portal.users; vẫn đếm riêng để báo cáo. */
const BIBLIO_PROJECTS = `(SELECT id FROM bibliomap.projects WHERE user_id = ANY($1::uuid[]))`
const SURVEYS = `(SELECT id FROM surveylab.surveys WHERE user_id = ANY($1::uuid[]))`
const STEPS = [
  { table: "surveylab.responses", where: `survey_id IN ${SURVEYS}` },
  { table: "surveylab.share_links", where: `survey_id IN ${SURVEYS}` },
  { table: "surveylab.surveys", where: `user_id = ANY($1::uuid[])` },
  { table: "surveylab.users", where: `id = ANY($1::uuid[])` },
  { table: "quantis.workspaces", where: `user_id = ANY($1::uuid[])` },
  { table: "quantis.users", where: `id = ANY($1::uuid[])` },
  { table: "bibliomap.map_data", where: `map_id IN (SELECT id FROM bibliomap.maps WHERE project_id IN ${BIBLIO_PROJECTS})` },
  { table: "bibliomap.maps", where: `project_id IN ${BIBLIO_PROJECTS}` },
  { table: "bibliomap.papers", where: `project_id IN ${BIBLIO_PROJECTS}` },
  { table: "bibliomap.projects", where: `user_id = ANY($1::uuid[])` },
  { table: "bibliomap.users", where: `id = ANY($1::uuid[])` },
  { table: "regulations.form_profiles", where: `user_id = ANY($1::uuid[])` },
  { table: "annota.annota_folders", where: `user_id = ANY($1::uuid[])`, cascade: true },
  { table: "annota.annota_sources", where: `user_id = ANY($1::uuid[])`, cascade: true },
  { table: "annota.annota_nodes", where: `user_id = ANY($1::uuid[])`, cascade: true },
  { table: "annota.annota_codes", where: `user_id = ANY($1::uuid[])`, cascade: true },
  { table: "writium.write_articles", where: `user_id = ANY($1::uuid[])`, cascade: true },
  { table: "ai_portal.projects", where: `user_id = ANY($1::uuid[])`, cascade: true },
  { table: "ai_portal.chat_sessions", where: `user_id = ANY($1::uuid[])`, cascade: true },
  { table: "ai_portal.users", where: `id = ANY($1::uuid[]) AND email ILIKE '%@sandbox.local'` },
  { table: "ai_portal.sandbox_users", where: `id = ANY($1::uuid[])` },
]

const chunk = (list, size) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size))

async function tableExists(client, table) {
  const r = await client.query(`SELECT to_regclass($1) AS t`, [table])
  return r.rows[0]?.t != null
}

async function runSteps(client, ids, totals) {
  for (const step of STEPS) {
    if (!(await tableExists(client, step.table))) continue
    const r = await client.query(
      apply && !step.cascade
        ? `WITH d AS (DELETE FROM ${step.table} WHERE ${step.where} RETURNING 1) SELECT count(*)::int AS n FROM d`
        : `SELECT count(*)::int AS n FROM ${step.table} WHERE ${step.where}`,
      [ids]
    )
    totals[step.table] = (totals[step.table] ?? 0) + r.rows[0].n
  }
}

async function s3Config(client) {
  const cfg = {}
  for (const k of ["MINIO_ENDPOINT", "MINIO_PORT", "MINIO_ACCESS_KEY", "MINIO_SECRET_KEY", "MINIO_BUCKET_NAME", "AWS_REGION"]) {
    if (process.env[k]?.trim()) cfg[k] = process.env[k].trim()
  }
  if (await tableExists(client, "ai_portal.app_settings")) {
    const r = await client.query(`SELECT key, value FROM ai_portal.app_settings WHERE key LIKE 'MINIO\\_%'`)
    for (const row of r.rows) if (!cfg[row.key] && row.value) cfg[row.key] = String(row.value).trim()
  }
  if (!cfg.MINIO_ENDPOINT || !cfg.MINIO_ACCESS_KEY || !cfg.MINIO_SECRET_KEY) return null
  const proto = cfg.MINIO_ENDPOINT.startsWith("http") ? "" : "http://"
  return {
    bucket: cfg.MINIO_BUCKET_NAME || "portal",
    client: new S3Client({
      endpoint: `${proto}${cfg.MINIO_ENDPOINT}:${cfg.MINIO_PORT || "9000"}`,
      region: cfg.AWS_REGION || "us-east-1",
      credentials: { accessKeyId: cfg.MINIO_ACCESS_KEY, secretAccessKey: cfg.MINIO_SECRET_KEY },
      forcePathStyle: true,
    }),
  }
}

async function purgePrefix(s3, prefix) {
  let token
  let count = 0
  do {
    const page = await s3.client.send(new ListObjectsV2Command({ Bucket: s3.bucket, Prefix: prefix, ContinuationToken: token }))
    const keys = (page.Contents ?? []).map((o) => ({ Key: o.Key }))
    count += keys.length
    if (apply && keys.length) await s3.client.send(new DeleteObjectsCommand({ Bucket: s3.bucket, Delete: { Objects: keys, Quiet: true } }))
    token = page.IsTruncated ? page.NextContinuationToken : undefined
  } while (token)
  return count
}

async function main() {
  const client = new pg.Client({
    host: process.env.POSTGRES_HOST?.trim() || "localhost",
    port: Number(process.env.POSTGRES_PORT || 5432),
    user: process.env.POSTGRES_USER?.trim() || "postgres",
    password: process.env.POSTGRES_PASSWORD ?? "postgres",
    database: databaseName(),
    ssl: String(process.env.POSTGRES_SSL).toLowerCase() === "true" ? { rejectUnauthorized: false } : undefined,
  })
  await client.connect()
  try {
    if (!(await tableExists(client, "ai_portal.sandbox_users"))) {
      console.log("Chưa có bảng ai_portal.sandbox_users: không có gì để dọn.")
      return
    }
    const rows = (
      await client.query(
        `SELECT su.id, u.email
         FROM ai_portal.sandbox_users su LEFT JOIN ai_portal.users u ON u.id = su.id
         WHERE su.last_seen < now() - make_interval(days => $1::int)`,
        [days]
      )
    ).rows
    const ids = []
    for (const r of rows) {
      const isV5 = String(r.id).charAt(14) === "5"
      if (isV5 && (r.email == null || /@sandbox\.local$/i.test(r.email))) ids.push(r.id)
      else console.warn(`BỎ QUA ${r.id}: không phải danh tính thực hành hợp lệ (cần kiểm tra tay).`)
    }
    console.log(`${apply ? "XOÁ THẬT" : "CHẠY THỬ (không xoá)"}: ${ids.length} danh tính thực hành không hoạt động quá ${days} ngày.`)
    if (ids.length === 0) return

    const totals = {}
    let objects = 0
    const s3 = await s3Config(client)
    if (s3) {
      // Xoá tệp trước CSDL: nếu lỗi giữa chừng, dòng trong sổ còn đó và lần chạy sau làm tiếp.
      for (const id of ids) {
        objects += await purgePrefix(s3, `annota/${id}/`)
        objects += await purgePrefix(s3, `uploads/sandbox/${id}/`)
      }
    } else {
      console.warn("Không có cấu hình MinIO: bỏ qua tệp trong kho đối tượng.")
    }

    await client.query(apply ? "BEGIN" : "BEGIN READ ONLY")
    try {
      for (const batch of chunk(ids, BATCH)) await runSteps(client, batch, totals)
      await client.query(apply ? "COMMIT" : "ROLLBACK")
    } catch (e) {
      await client.query("ROLLBACK")
      throw e
    }
    for (const [table, n] of Object.entries(totals)) if (n > 0) console.log(`  ${table}: ${n}`)
    console.log(`  tệp MinIO: ${objects}`)
    console.log(apply ? "Đã xoá." : "Chạy lại với --apply để xoá.")
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error("Dọn thất bại:", e?.message ?? e)
  process.exit(1)
})
